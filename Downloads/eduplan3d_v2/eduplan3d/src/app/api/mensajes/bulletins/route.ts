// src/app/api/mensajes/bulletins/route.ts
// POST → publica un boletín (broadcast) a una audiencia.
// Crea UNA conversation tipo 'bulletin' con participantes = sender + todos los
// destinatarios; el primer mensaje se inserta con kind='bulletin'.
//
// SOLO ADMINISTRACIÓN puede crear boletines (admin / assistant / rector).
// El boletín alcanza a TODA la institución (todos los roles), no solo
// estudiantes.
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
// (Helpers de tutoría ya no necesarios — solo admin crea boletines.)

const PUBLISHER_ROLES = ['admin', 'assistant', 'rector']
const STUDENT_ROLES   = ['student']                       // los demás se marcan como 'staff'

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

  // Solo administración (admin / assistant / rector) puede publicar boletines.
  if (!PUBLISHER_ROLES.includes(me.role)) {
    return NextResponse.json({ error: 'Solo la administración puede publicar boletines.' }, { status: 403 })
  }

  // Resolver audiencia: lista de profiles de la institución.
  // Cada destinatario lleva su rol real para asignarle el role correcto en
  // conversation_participants ('student' o 'staff').
  let audienceProfiles: Array<{ id: string; role: string }> = []
  let courseLabel = ''

  if (scope === 'institution') {
    // Toda la institución: TODOS los profiles, todos los roles, excepto el sender.
    const { data: profs } = await (admin as any)
      .from('profiles')
      .select('id, role')
      .eq('institution_id', me.institution_id)
      .neq('id', me.id)
    audienceProfiles = ((profs || []) as any[]).map(p => ({ id: p.id, role: p.role || 'student' }))
    courseLabel = 'Toda la institución'
  } else if (typeof scope === 'object' && Array.isArray((scope as any).courseIds)) {
    const courseIds: string[] = (scope as any).courseIds
    const { data: courses } = await (admin as any)
      .from('courses').select('id, name, parallel, institution_id').in('id', courseIds)
    const valid = ((courses || []) as any[]).filter((c: any) => c.institution_id === me.institution_id)
    const validIds = valid.map((c: any) => c.id)

    // 1) estudiantes matriculados en esos cursos
    const { data: enr } = await (admin as any)
      .from('enrollments').select('student_id').in('course_id', validIds)
    const studentIds = Array.from(new Set(((enr || []) as any[]).map(e => e.student_id)))

    // 2) docentes que dictan materias en esos cursos
    const { data: subjs } = await (admin as any)
      .from('subjects').select('teacher_id').in('course_id', validIds)
    const teacherIds = Array.from(new Set(((subjs || []) as any[])
      .map(s => s.teacher_id).filter(Boolean)))

    const allIds = Array.from(new Set([...studentIds, ...teacherIds])).filter(id => id !== me.id)
    if (allIds.length > 0) {
      const { data: profs } = await (admin as any)
        .from('profiles').select('id, role').in('id', allIds)
      audienceProfiles = ((profs || []) as any[]).map(p => ({ id: p.id, role: p.role || 'student' }))
    }
    courseLabel = valid.map((c: any) => `${c.name}${c.parallel ? ' ' + c.parallel : ''}`).join(', ')
  } else {
    return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
  }

  if (audienceProfiles.length === 0) {
    return NextResponse.json({ error: 'Sin destinatarios' }, { status: 400 })
  }

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
    { conversation_id: conv.id, user_id: me.id, role: 'admin' as const, last_read_at: new Date().toISOString() },
    ...audienceProfiles.map(p => ({
      conversation_id: conv.id,
      user_id: p.id,
      role: STUDENT_ROLES.includes(p.role) ? ('student' as const) : ('staff' as const),
    })),
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

  return NextResponse.json({ conversation: conv, message: msg, recipients: audienceProfiles.length })
}
