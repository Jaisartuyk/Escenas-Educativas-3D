import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsAssignment, getProfile } from '@/lib/auth/ownership'

export const dynamic = 'force-dynamic'

// POST — save attachment URLs for an assignment (docente dueño de la tarea)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { assignment_id, file_urls } = body

  if (!assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })

  const owns = await teacherOwnsAssignment(user.id, assignment_id)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('assignments')
    .update({ attachment_urls: file_urls } as any)
    .eq('id', assignment_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// GET — get attachment URLs for an assignment (cualquier miembro de la institución o alumno matriculado)
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignment_id = searchParams.get('assignment_id')
  if (!assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que el usuario pertenece a la misma institución que la tarea
  const { data: asgn } = await admin
    .from('assignments')
    .select('attachment_urls, subjects:subject_id(teacher_id, courses:course_id(institution_id))')
    .eq('id', assignment_id)
    .single()

  const asgnInst = (asgn as any)?.subjects?.courses?.institution_id
  const profile = await getProfile(user.id)
  if (!asgnInst || !profile?.institution_id || profile.institution_id !== asgnInst) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  return NextResponse.json({ file_urls: (asgn as any)?.attachment_urls || [] })
}
