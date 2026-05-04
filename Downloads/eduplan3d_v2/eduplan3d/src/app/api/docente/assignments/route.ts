import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsSubject, teacherOwnsAssignment } from '@/lib/auth/ownership'
import { createStudentFamilyNotifications } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// POST — crear tarea
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  if (!body.subject_id) return NextResponse.json({ error: 'Falta subject_id' }, { status: 400 })

  // Verificar que el docente es dueño de la materia
  const owns = await teacherOwnsSubject(user.id, body.subject_id)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta materia' }, { status: 403 })

  const admin = createAdminClient()
  const { data: subject } = await (admin as any)
    .from('subjects')
    .select('course_id, name')
    .eq('id', body.subject_id)
    .single()

  const { error } = await admin.from('assignments').insert({
    id:          body.id,
    subject_id:  body.subject_id,
    title:       body.title,
    description: body.description || null,
    due_date:    body.due_date || null,
    trimestre:   body.trimestre ?? 1,
    parcial:     body.parcial ?? 1,
    category_id: body.category_id || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ((subject as any)?.course_id) {
    const { data: enrollments } = await (admin as any)
      .from('enrollments')
      .select('student_id')
      .eq('course_id', (subject as any).course_id)

    const studentIds = ((enrollments || []) as any[]).map((row: any) => row.student_id).filter(Boolean)
    await createStudentFamilyNotifications(admin as any, studentIds, {
      category: 'assignment',
      title: `Nueva tarea: ${body.title}`,
      body: (subject as any)?.name ? `Materia: ${(subject as any).name}` : 'Tu docente publicó una nueva tarea.',
      href: '/dashboard/alumno',
      metadata: { assignmentId: body.id, subjectId: body.subject_id },
    })
  }

  return NextResponse.json({ success: true })
}

// PUT — actualizar tarea
export async function PUT(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const owns = await teacherOwnsAssignment(user.id, body.id)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('assignments').update({
    title:       body.title,
    description: body.description || null,
    start_date:  body.start_date || null,
    due_date:    body.due_date || null,
    due_time:    body.due_time || '23:59',
    category_id: body.category_id || null,
  }).eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — eliminar tarea
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const owns = await teacherOwnsAssignment(user.id, id)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })

  const admin = createAdminClient()
  await admin.from('assignments').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
