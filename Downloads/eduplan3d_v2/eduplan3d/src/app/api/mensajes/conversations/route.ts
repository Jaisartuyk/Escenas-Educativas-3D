// src/app/api/mensajes/conversations/route.ts
// GET  → lista las conversaciones del usuario (con último mensaje y no leídos)
// POST → crea/obtiene una conversación directa con otro participante (idempotente)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTutorsForStudent, resolveStudentsForTutor } from '@/lib/mensajes/access'
import { getPrimaryLinkedChildForParent } from '@/lib/parents'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: parts } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)
  const convIds = ((parts || []) as any[]).map(p => p.conversation_id)
  if (convIds.length === 0) return NextResponse.json({ conversations: [] })

  const lastReadMap = new Map<string, string | null>(((parts || []) as any[]).map(p => [p.conversation_id, p.last_read_at]))

  const { data: convs } = await (admin as any)
    .from('conversations')
    .select('id, type, title, course_id, student_id, created_by, last_message_at, last_message_preview, created_at, institution_id')
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  // Participantes (para mostrar "con quién hablo")
  const { data: allParts } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id, user_id, role')
    .in('conversation_id', convIds)
  const partUserIds = Array.from(new Set(((allParts || []) as any[]).map((p: any) => p.user_id)))
  const userMap: Record<string, { full_name: string | null; role: string | null }> = {}
  if (partUserIds.length > 0) {
    const { data: profs } = await (admin as any)
      .from('profiles').select('id, full_name, role').in('id', partUserIds)
    for (const p of ((profs || []) as any[])) userMap[p.id] = { full_name: p.full_name, role: p.role }
  }

  // Unread count por conversación
  const unread: Record<string, number> = {}
  for (const c of (convs || []) as any[]) {
    const lr = lastReadMap.get(c.id)
    const q = (admin as any).from('messages').select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id).neq('sender_id', user.id)
    const { count } = lr
      ? await q.gt('created_at', lr)
      : await q
    unread[c.id] = count || 0
  }

  const byConv = new Map<string, any[]>()
  for (const p of (allParts || []) as any[]) {
    const list = byConv.get(p.conversation_id) || []
    const u = userMap[p.user_id]
    list.push({ user_id: p.user_id, role: p.role, full_name: u?.full_name || '', user_role: u?.role || '' })
    byConv.set(p.conversation_id, list)
  }

  const result = ((convs || []) as any[]).map((c: any) => ({
    ...c,
    participants: byConv.get(c.id) || [],
    unread:       unread[c.id] || 0,
  }))
  return NextResponse.json({ conversations: result })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const partnerId: string | undefined = body?.partnerId
  const studentContext: string | undefined = body?.studentId  // opcional: de qué estudiante trata
  if (!partnerId) return NextResponse.json({ error: 'partnerId requerido' }, { status: 400 })
  if (partnerId === user.id) return NextResponse.json({ error: 'No puedes crear un hilo contigo mismo' }, { status: 400 })

  const admin = createAdminClient()

  const { data: me } = await (admin as any)
    .from('profiles').select('id, role, institution_id, full_name').eq('id', user.id).single()
  const { data: other } = await (admin as any)
    .from('profiles').select('id, role, institution_id, full_name').eq('id', partnerId).single()
  if (!me || !other) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  if (me.institution_id !== other.institution_id) {
    return NextResponse.json({ error: 'Solo dentro de la misma institución' }, { status: 403 })
  }

  // Validar emparejamiento.
  // Casos permitidos:
  //  A) staff↔staff: cualquier rol del staff (admin, assistant, teacher,
  //     rector, supervisor, horarios_only) puede mensajear a cualquier otro
  //     staff de su misma institución (mensajería interna).
  //  B) student↔teacher: solo si el docente es tutor del curso del estudiante.
  //  C) admin/assistant↔student: permitido (admin puede contactar cualquier
  //     estudiante de su institución).
  const STAFF_ROLES = ['admin', 'assistant', 'teacher', 'rector', 'supervisor', 'horarios_only']
  const meIsStaff    = STAFF_ROLES.includes(me.role)
  const otherIsStaff = STAFF_ROLES.includes(other.role)

  let studentId = ''
  let tutorId = ''
  let isStaffPair = false
  let participantRole: 'student' | 'parent' = 'student'

  if (meIsStaff && otherIsStaff) {
    // Caso A: mensajería interna staff a staff. Sin validación de tutoría.
    isStaffPair = true
  } else if (me.role === 'student' && other.role === 'teacher') {
    studentId = me.id; tutorId = other.id
  } else if (me.role === 'parent' && other.role === 'teacher') {
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, me.id, studentContext || undefined)
    if (!linkedChild) {
      return NextResponse.json({ error: 'El representante no tiene un estudiante vinculado para este hilo' }, { status: 403 })
    }
    studentId = linkedChild.childId
    tutorId = other.id
    participantRole = 'parent'
  } else if (me.role === 'teacher' && other.role === 'student') {
    studentId = other.id; tutorId = me.id
  } else if ((me.role === 'admin' || me.role === 'assistant') && other.role === 'student') {
    studentId = other.id
    tutorId = ''
  } else if (other.role === 'admin' || other.role === 'assistant') {
    // estudiante o padre escribiendo a admin → permitido
    if (me.role === 'parent') {
      const linkedChild = await getPrimaryLinkedChildForParent(admin as any, me.id, studentContext || undefined)
      studentId = linkedChild?.childId || ''
      participantRole = 'parent'
    } else {
      studentId = me.role === 'student' ? me.id : (studentContext || '')
    }
    tutorId = ''
  } else {
    return NextResponse.json({ error: 'Combinación de roles no permitida' }, { status: 403 })
  }

  if (!isStaffPair && me.role === 'teacher' && other.role === 'student') {
    // Verificar que el teacher es tutor del curso del student
    const tutors = await resolveTutorsForStudent(admin as any, studentId)
    const ok = tutors.some(t => t.teacherId === tutorId)
    if (!ok) return NextResponse.json({ error: 'El docente no es tutor del estudiante' }, { status: 403 })
  }
  if (!isStaffPair && me.role === 'student' && other.role === 'teacher') {
    const tutors = await resolveTutorsForStudent(admin as any, studentId)
    const ok = tutors.some(t => t.teacherId === tutorId)
    if (!ok) return NextResponse.json({ error: 'El docente no es tutor del estudiante' }, { status: 403 })
  }
  if (!isStaffPair && me.role === 'parent' && other.role === 'teacher') {
    const tutors = await resolveTutorsForStudent(admin as any, studentId)
    const ok = tutors.some(t => t.teacherId === tutorId)
    if (!ok) return NextResponse.json({ error: 'El docente no es tutor del estudiante vinculado' }, { status: 403 })
  }

  // Buscar conversación directa existente entre los dos
  const { data: myConvs } = await (admin as any)
    .from('conversation_participants').select('conversation_id').eq('user_id', user.id)
  const { data: theirConvs } = await (admin as any)
    .from('conversation_participants').select('conversation_id').eq('user_id', partnerId)
  const mineIds  = new Set(((myConvs || []) as any[]).map(p => p.conversation_id))
  const sharedIds = ((theirConvs || []) as any[]).map(p => p.conversation_id).filter(id => mineIds.has(id))
  if (sharedIds.length > 0) {
    const { data: existingDirect } = await (admin as any)
      .from('conversations').select('*').in('id', sharedIds).eq('type', 'direct').limit(1).maybeSingle()
    if (existingDirect) return NextResponse.json({ conversation: existingDirect })
  }

  // Crear nueva
  const { data: conv, error } = await (admin as any)
    .from('conversations')
    .insert({
      institution_id: me.institution_id,
      type:           'direct',
      title:          null,
      student_id:     isStaffPair ? null : (studentId || null),
      created_by:     user.id,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const parts = isStaffPair
    ? [
        { conversation_id: conv.id, user_id: user.id,    role: 'staff' },
        { conversation_id: conv.id, user_id: partnerId,  role: 'staff' },
      ]
    : [
        { conversation_id: conv.id, user_id: user.id,                role: participantRole },
        { conversation_id: conv.id, user_id: tutorId   || partnerId, role: 'tutor'   },
      ]
  await (admin as any).from('conversation_participants').insert(parts)
  return NextResponse.json({ conversation: conv })
}
