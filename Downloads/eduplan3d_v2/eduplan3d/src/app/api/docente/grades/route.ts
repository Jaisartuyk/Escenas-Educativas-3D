import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsAssignment, studentEnrolledInAssignment } from '@/lib/auth/ownership'
import { createStudentFamilyNotifications } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// POST — crear o actualizar nota
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()
  let notifiedStudentId: string | null = null
  let notifiedAssignmentId: string | null = null
  let actionLabel = 'Tu calificación fue actualizada.'

  if (body.existingId) {
    // Resolver la tarea asociada a la nota y verificar ownership
    const { data: existing } = await admin
      .from('grades')
      .select('assignment_id')
      .eq('id', body.existingId)
      .single()
    const assignmentId = (existing as any)?.assignment_id
    if (!assignmentId) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    const { data: existingGrade } = await admin
      .from('grades')
      .select('student_id')
      .eq('id', body.existingId)
      .single()

    const owns = await teacherOwnsAssignment(user.id, assignmentId)
    if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta nota' }, { status: 403 })

    const { error } = await admin.from('grades').update({ score: body.score }).eq('id', body.existingId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    notifiedStudentId = (existingGrade as any)?.student_id || null
    notifiedAssignmentId = assignmentId
  } else {
    if (!body.assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })
    if (!body.student_id) return NextResponse.json({ error: 'Falta student_id' }, { status: 400 })

    const owns = await teacherOwnsAssignment(user.id, body.assignment_id)
    if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta tarea' }, { status: 403 })

    const enrolled = await studentEnrolledInAssignment(body.student_id, body.assignment_id)
    if (!enrolled) {
      return NextResponse.json({ error: 'El estudiante no pertenece al curso de esta tarea' }, { status: 403 })
    }

    const { error } = await admin.from('grades').insert({
      id:            body.id,
      assignment_id: body.assignment_id,
      student_id:    body.student_id,
      score:         body.score,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    notifiedStudentId = body.student_id
    notifiedAssignmentId = body.assignment_id
    actionLabel = 'Tu docente registró una nueva calificación.'
  }

  if (notifiedStudentId && notifiedAssignmentId) {
    const { data: assignment } = await admin
      .from('assignments')
      .select('title')
      .eq('id', notifiedAssignmentId)
      .single()

    await createStudentFamilyNotifications(admin as any, [notifiedStudentId], {
      category: 'grade',
      title: assignment?.title ? `Calificación: ${assignment.title}` : 'Nueva actualización de calificación',
      body: actionLabel,
      href: '/dashboard/notas',
      metadata: { assignmentId: notifiedAssignmentId, studentId: notifiedStudentId },
    })
  }

  return NextResponse.json({ success: true })
}
