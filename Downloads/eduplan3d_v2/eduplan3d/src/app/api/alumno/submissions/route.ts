import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsAssignment, getProfile, studentEnrolledInAssignment } from '@/lib/auth/ownership'
import { getPrimaryLinkedChildForParent } from '@/lib/parents'

export const dynamic = 'force-dynamic'

async function resolveEffectiveStudentId(userId: string, requestedStudentId?: string | null) {
  const admin = createAdminClient()
  const profile = await getProfile(userId)
  if (!profile) return { error: 'Perfil no encontrado', status: 404, studentId: null as string | null }

  if (profile.role === 'student') {
    return { error: null, status: 200, studentId: userId }
  }

  if (profile.role === 'parent') {
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, userId, requestedStudentId || undefined)
    if (!linkedChild) {
      return { error: 'No tienes un estudiante vinculado para esta acción', status: 403, studentId: null as string | null }
    }
    return { error: null, status: 200, studentId: linkedChild.childId }
  }

  return { error: 'Sin permiso', status: 403, studentId: null as string | null }
}

// GET — fetch submissions for the current student or for a given assignment (teacher)
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignment_id')
  const requestedStudentId = searchParams.get('student_id')

  const admin = createAdminClient()

  if (assignmentId) {
    // Solo el docente dueño de la tarea (o admin/assistant de la misma institución) puede ver todas las entregas
    const owns = await teacherOwnsAssignment(user.id, assignmentId)
    if (!owns) {
      // Fallback: admin/assistant de la institución de la tarea
      const profile = await getProfile(user.id)
      const { data: asgn } = await admin
        .from('assignments')
        .select('subjects:subject_id(courses:course_id(institution_id))')
        .eq('id', assignmentId)
        .single()
      const asgnInst = (asgn as any)?.subjects?.courses?.institution_id
      const isInstAdmin =
        profile?.institution_id &&
        profile.institution_id === asgnInst &&
        (profile.role === 'admin' || profile.role === 'assistant')
      if (!isInstAdmin) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
    }

    const { data, error } = await admin
      .from('assignment_submissions')
      .select('*, student:profiles(id, full_name, email)')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submissions: data })
  }

  // Student/parent fetching submissions for the linked student
  const studentCtx = await resolveEffectiveStudentId(user.id, requestedStudentId)
  if (studentCtx.error || !studentCtx.studentId) {
    return NextResponse.json({ error: studentCtx.error }, { status: studentCtx.status })
  }

  const { data, error } = await admin
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', studentCtx.studentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data })
}

// POST — create or update a student submission (upsert)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { assignment_id, student_id, comment, file_url } = body

  if (!assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })

  const studentCtx = await resolveEffectiveStudentId(user.id, student_id)
  if (studentCtx.error || !studentCtx.studentId) {
    return NextResponse.json({ error: studentCtx.error }, { status: studentCtx.status })
  }

  const enrolled = await studentEnrolledInAssignment(studentCtx.studentId, assignment_id)
  if (!enrolled) {
    return NextResponse.json({ error: 'No tienes permiso para entregar en esta tarea' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assignment_submissions')
    .upsert(
      { assignment_id, student_id: studentCtx.studentId, comment: comment || null, file_url: file_url || null, submitted_at: new Date().toISOString() },
      { onConflict: 'assignment_id,student_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submission: data })
}

// DELETE — student deletes their own submission
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const requestedStudentId = searchParams.get('student_id')

  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const studentCtx = await resolveEffectiveStudentId(user.id, requestedStudentId)
  if (studentCtx.error || !studentCtx.studentId) {
    return NextResponse.json({ error: studentCtx.error }, { status: studentCtx.status })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('assignment_submissions')
    .delete()
    .eq('id', id)
    .eq('student_id', studentCtx.studentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
