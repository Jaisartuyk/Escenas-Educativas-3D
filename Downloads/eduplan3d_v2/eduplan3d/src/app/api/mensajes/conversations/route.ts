// src/app/api/mensajes/conversations/route.ts
// GET  → lista las conversaciones del usuario (con último mensaje y no leídos)
// POST → crea/obtiene una conversación directa con otro participante (idempotente)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTutorsForStudent, resolveStudentsForTutor } from '@/lib/mensajes/access'

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
    .select('conversation_id, user_id, role, user:profiles(id, full_name, role)')
    .in('conversation_id', convIds)

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
    const u = Array.isArray(p.user) ? p.user[0] : p.user
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

  // Validar emparejamiento: student↔tutor-del-curso
  let studentId = ''
  let tutorId = ''
  if (me.role === 'student' && other.role === 'teacher') { studentId = me.id; tutorId = other.id }
  else if (me.role === 'teacher' && other.role === 'student') { studentId = other.id; tutorId = me.id }
  else if (me.role === 'admin' || me.role === 'assistant') {
    // admin puede iniciar directo con cualquiera de su institución (no se valida tutoría)
    studentId = other.role === 'student' ? other.id : (studentContext || '')
    tutorId = other.role === 'teacher' ? other.id : ''
  } else {
    return NextResponse.json({ error: 'Combinación de roles no permitida' }, { status: 403 })
  }

  if (me.role !== 'admin' && me.role !== 'assistant') {
    // Verificar que el teacher es tutor del curso del student
    const tutors = await resolveTutorsForStudent(admin as any, studentId)
    const ok = tutors.some(t => t.teacherId === tutorId)
    if (!ok) return NextResponse.json({ error: 'El docente no es tutor del estudiante' }, { status: 403 })
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
      student_id:     studentId || null,
      created_by:     user.id,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const parts = [
    { conversation_id: conv.id, user_id: studentId || user.id, role: 'student' },
    { conversation_id: conv.id, user_id: tutorId   || partnerId, role: 'tutor'   },
  ]
  await (admin as any).from('conversation_participants').insert(parts)
  return NextResponse.json({ conversation: conv })
}
