// src/app/api/mensajes/bulletins/route.ts
// POST → publica un boletín (broadcast) a una audiencia.
// Crea UNA conversation tipo 'bulletin' con participantes = sender + todos los
// destinatarios; el primer mensaje se inserta con kind='bulletin'.
//
// Autorizado para:
//   - admin/assistant  → audiencia = toda la institución (students)
//   - teacher (tutor)  → audiencia = students de cursos que tutoriza
//
// Body: {
//   title: string,
//   body:  string,
//   category?: 'academico'|'administrativo'|'evento'|'urgente',
//   requiresAck?: boolean,
//   scope: 'institution' | { courseIds: string[] }
// }
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveStudentsForTutor } from '@/lib/mensajes/access'

type Scope = 'institution' | { courseIds: string[] }

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const title: string = String(body?.title || '').trim()
  const text: string  = String(body?.body  || '').trim()
  const category: string = ['academico','administrativo','evento','urgente'].includes(body?.category) ? body.category : 'administrativo'
  const requiresAck: boolean = !!body?.requiresAck
  const scope: Scope = body?.scope

  if (!title || !text) return NextResponse.json({ error: 'title y body requeridos' }, { status: 400 })
  if (!scope) return NextResponse.json({ error: 'scope requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: me } = await (admin as any)
    .from('profiles').select('id, role, institution_id, full_name').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const isAdmin   = me.role === 'admin' || me.role === 'assistant'
  const isTeacher = me.role === 'teacher'
  if (!isAdmin && !isTeacher) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Resolver audiencia (studentIds)
  let audience: string[] = []
  let courseLabel = ''
  if (scope === 'institution') {
    if (!isAdmin) return NextResponse.json({ error: 'Solo admin puede enviar a toda la institución' }, { status: 403 })
    const { data: students } = await (admin as any)
      .from('profiles').select('id').eq('institution_id', me.institution_id).eq('role', 'student')
    audience = ((students || []) as any[]).map(s => s.id)
    courseLabel = 'Toda la institución'
  } else if (typeof scope === 'object' && Array.isArray((scope as any).courseIds)) {
    const courseIds: string[] = (scope as any).courseIds
    // Validar que los cursos pertenecen a la institución y — si es tutor — que los tutoriza
    const { data: courses } = await (admin as any)
      .from('courses').select('id, name, parallel, institution_id').in('id', courseIds)
    const valid = ((courses || []) as any[]).filter((c: any) => c.institution_id === me.institution_id)
    const validIds = valid.map((c: any) => c.id)
    if (isTeacher) {
      const myStudents = await resolveStudentsForTutor(admin as any, me.id)
      const myCourseIds = new Set(myStudents.map(s => s.courseId))
      const allMine = validIds.every((id: string) => myCourseIds.has(id))
      if (!allMine) return NextResponse.json({ error: 'No eres tutor de todos los cursos indicados' }, { status: 403 })
    }
    const { data: enr } = await (admin as any)
      .from('enrollments').select('student_id').in('course_id', validIds)
    audience = Array.from(new Set(((enr || []) as any[]).map(e => e.student_id)))
    courseLabel = valid.map((c: any) => `${c.name}${c.parallel ? ' ' + c.parallel : ''}`).join(', ')
  } else {
    return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
  }

  if (audience.length === 0) return NextResponse.json({ error: 'Sin destinatarios' }, { status: 400 })

  // Crear conversación
  const { data: conv, error } = await (admin as any)
    .from('conversations')
    .insert({
      institution_id: me.institution_id,
      type:           'bulletin',
      title:          title,
      created_by:     me.id,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const participants = [
    { conversation_id: conv.id, user_id: me.id, role: isAdmin ? 'admin' : 'tutor', last_read_at: new Date().toISOString() },
    ...audience.map(uid => ({ conversation_id: conv.id, user_id: uid, role: 'student' as const })),
  ]
  await (admin as any).from('conversation_participants').insert(participants)

  const { data: msg } = await (admin as any)
    .from('messages')
    .insert({
      conversation_id: conv.id,
      sender_id:       me.id,
      body:            text,
      kind:            'bulletin',
      metadata:        { category, requiresAck, courseLabel },
    })
    .select().single()

  return NextResponse.json({ conversation: conv, message: msg, recipients: audience.length })
}
