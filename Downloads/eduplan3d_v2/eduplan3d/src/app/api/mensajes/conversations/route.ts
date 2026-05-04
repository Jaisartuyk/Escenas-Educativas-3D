// src/app/api/mensajes/conversations/route.ts
// GET  → lista las conversaciones del usuario (con último mensaje y no leídos)
// POST → crea/obtiene una conversación directa con otro participante (idempotente)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTutorsForStudent, resolveStudentsForTutor } from '@/lib/mensajes/access'
import { getPrimaryLinkedChildForParent } from '@/lib/parents'

function toEpoch(iso?: string | null): number {
  if (!iso) return 0
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function buildConversationDedupKey(
  conv: any,
  participants: any[],
  currentUserId: string,
  currentUserRole: string,
) {
  if (conv.type !== 'direct') return `${conv.type}:${conv.id}`

  const others = participants.filter((p: any) => p.user_id !== currentUserId)
  if (conv.student_id) {
    const preferredOther =
      (currentUserRole === 'parent'
        ? others.find((p: any) => p.user_role !== 'student' && p.user_role !== 'parent')
        : undefined) ||
      others.find((p: any) => p.user_id !== conv.student_id) ||
      others[0]

    return `direct:${conv.student_id}:${preferredOther?.user_id || 'unknown'}`
  }

  const sortedIds = participants.map((p: any) => p.user_id).sort().join(':')
  return `direct:${sortedIds}`
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: me } = await (admin as any)
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .single()
  if (!me) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const requestedChildId = req.nextUrl.searchParams.get('child_id')

  const { data: parts } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)
  const partRows = (parts || []) as any[]
  const convIdSet = new Set<string>(partRows.map(p => p.conversation_id))

  if (me.role === 'parent') {
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, user.id, requestedChildId || undefined)
    if (!linkedChild) return NextResponse.json({ conversations: [] })

    const { data: parentConvs } = await (admin as any)
      .from('conversations')
      .select('id')
      .eq('student_id', linkedChild.childId)
      .eq('type', 'direct')

    for (const conv of ((parentConvs || []) as any[])) {
      convIdSet.add(conv.id)
      if (!partRows.some(p => p.conversation_id === conv.id)) {
        partRows.push({ conversation_id: conv.id, last_read_at: null })
      }
      await (admin as any)
        .from('conversation_participants')
        .upsert(
          { conversation_id: conv.id, user_id: user.id, role: 'parent' },
          { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
        )
    }
  }

  const convIds = Array.from(convIdSet)
  if (convIds.length === 0) return NextResponse.json({ conversations: [] })

  const lastReadMap = new Map<string, string | null>(partRows.map(p => [p.conversation_id, p.last_read_at]))

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

  const rawResult = ((convs || []) as any[]).map((c: any) => ({
    ...c,
    participants: byConv.get(c.id) || [],
    unread:       unread[c.id] || 0,
  }))

  const deduped = new Map<string, any>()
  for (const conv of rawResult) {
    const key = buildConversationDedupKey(conv, conv.participants || [], user.id, me.role)
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, conv)
      continue
    }

    const existingScore =
      (existing.participants?.length || 0) * 10 +
      ((existing.last_message_preview ? 1 : 0) * 3) +
      toEpoch(existing.last_message_at || existing.created_at)
    const candidateScore =
      (conv.participants?.length || 0) * 10 +
      ((conv.last_message_preview ? 1 : 0) * 3) +
      toEpoch(conv.last_message_at || conv.created_at)

    if (candidateScore > existingScore) {
      deduped.set(key, conv)
    }
  }

  const result = Array.from(deduped.values()).sort(
    (a, b) => toEpoch(b.last_message_at || b.created_at) - toEpoch(a.last_message_at || a.created_at)
  )

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
  } else if (me.role === 'teacher' && other.role === 'parent') {
    // Caso nuevo: docente escribe a padre/representante.
    // Identificamos al hijo vinculado al padre para validar tutoría.
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, other.id, studentContext || undefined)
    if (!linkedChild) {
      return NextResponse.json({ error: 'El representante no tiene un estudiante vinculado' }, { status: 403 })
    }
    studentId = linkedChild.childId
    tutorId = me.id
    participantRole = 'parent'  // el otro (padre) se registra con rol 'parent'
  } else if ((me.role === 'admin' || me.role === 'assistant') && other.role === 'student') {
    studentId = other.id
    tutorId = ''
  } else if ((me.role === 'admin' || me.role === 'assistant') && other.role === 'parent') {
    // admin/assistant → padre: permitido, identificamos hijo principal
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, other.id, studentContext || undefined)
    studentId = linkedChild?.childId || ''
    tutorId = ''
    participantRole = 'parent'
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
  // Para padre→docente y docente→padre: validar con settings; si no hay config,
  // verificar que el docente da clases al hijo vinculado.
  if (!isStaffPair && (
    (me.role === 'parent' && other.role === 'teacher') ||
    (me.role === 'teacher' && other.role === 'parent')
  )) {
    const tutors = await resolveTutorsForStudent(admin as any, studentId)
    const teacherInSettings = tutors.some(t => t.teacherId === tutorId)

    if (!teacherInSettings) {
      // Fallback: verificar que el docente realmente enseña al hijo
      const { data: enr } = await (admin as any)
        .from('enrollments').select('course_id').eq('student_id', studentId)
      const courseIds = ((enr || []) as any[]).map((e: any) => e.course_id)
      let teachesChild = false
      if (courseIds.length > 0) {
        const { data: subj } = await (admin as any)
          .from('subjects').select('id')
          .eq('teacher_id', tutorId)
          .in('course_id', courseIds)
          .limit(1).maybeSingle()
        teachesChild = !!subj
      }
      if (!teachesChild) {
        return NextResponse.json({ error: 'El docente no imparte clases al estudiante vinculado' }, { status: 403 })
      }
    }
  }

  // Buscar conversación directa existente entre los dos
  const involvesParent = me.role === 'parent' || other.role === 'parent'
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

  if (!isStaffPair) {
    let candidateQuery = (admin as any)
      .from('conversations')
      .select('id, type, title, course_id, student_id, created_by, last_message_at, last_message_preview, created_at, institution_id')
      .eq('institution_id', me.institution_id)
      .eq('type', 'direct')

    if (studentId) candidateQuery = candidateQuery.eq('student_id', studentId)
    else candidateQuery = candidateQuery.is('student_id', null)

    const { data: candidates } = await candidateQuery.order('last_message_at', { ascending: false, nullsFirst: false })
    const candidateRows = (candidates || []) as any[]

    if (candidateRows.length > 0) {
      const candidateIds = candidateRows.map((c: any) => c.id)
      const { data: candidateParts } = await (admin as any)
        .from('conversation_participants')
        .select('conversation_id, user_id, role')
        .in('conversation_id', candidateIds)

      const partsByConv = new Map<string, any[]>()
      for (const row of ((candidateParts || []) as any[])) {
        const list = partsByConv.get(row.conversation_id) || []
        list.push(row)
        partsByConv.set(row.conversation_id, list)
      }

      const existingByContext = candidateRows.find((conv: any) => {
        const parts = partsByConv.get(conv.id) || []
        const hasPartner = parts.some((p: any) => p.user_id === partnerId)
        if (!hasPartner) return false

        if (involvesParent) {
          const hasParent = parts.some((p: any) => p.user_id === user.id || p.user_id === partnerId)
          const hasStudentParticipant = !!studentId && parts.some((p: any) => p.user_id === studentId)
          return hasParent || hasStudentParticipant
        }

        return parts.some((p: any) => p.user_id === user.id)
      })

      if (existingByContext) {
        const parts = isStaffPair
          ? [
              { conversation_id: existingByContext.id, user_id: user.id,   role: 'staff' },
              { conversation_id: existingByContext.id, user_id: partnerId, role: 'staff' },
            ]
          : [
              { conversation_id: existingByContext.id, user_id: user.id,   role: me.role === 'parent' ? 'parent' : me.role === 'student' ? 'student' : 'tutor' },
              { conversation_id: existingByContext.id, user_id: partnerId, role: other.role === 'parent' ? 'parent' : other.role === 'student' ? 'student' : 'tutor' },
            ]

        await (admin as any)
          .from('conversation_participants')
          .upsert(parts, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true })

        const { data: fullParts } = await (admin as any)
          .from('conversation_participants')
          .select('user_id, role')
          .eq('conversation_id', existingByContext.id)

        const userIds = Array.from(new Set(((fullParts || []) as any[]).map((p: any) => p.user_id)))
        let participants: any[] = []
        if (userIds.length > 0) {
          const { data: profs } = await (admin as any)
            .from('profiles').select('id, full_name, role').in('id', userIds)

          const profMap = new Map(((profs || []) as any[]).map((p: any) => [p.id, p]))
          participants = ((fullParts || []) as any[]).map((p: any) => {
            const prof = profMap.get(p.user_id) as any
            return {
              user_id: p.user_id,
              role: p.role,
              full_name: prof?.full_name || '',
              user_role: prof?.role || '',
            }
          })
        }

        return NextResponse.json({
          conversation: {
            ...existingByContext,
            participants,
            unread: 0,
          },
        })
      }
    }
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
        // El iniciador siempre va con su propio rol
        { conversation_id: conv.id, user_id: user.id,   role: me.role === 'parent' ? 'parent' : me.role === 'student' ? 'student' : 'tutor' },
        // El receptor: si es padre se registra como 'parent', si es tutor como 'tutor', si es alumno como 'student'
        { conversation_id: conv.id, user_id: partnerId, role: other.role === 'parent' ? 'parent' : other.role === 'student' ? 'student' : 'tutor' },
      ]
  await (admin as any).from('conversation_participants').insert(parts)

  // Devolver la conversación con sus participantes para que el frontend pueda mostrarla correctamente de inmediato
  const { data: fullParts } = await (admin as any)
    .from('conversation_participants')
    .select('user_id, role')
    .eq('conversation_id', conv.id)
  
  const userIds = fullParts.map((p: any) => p.user_id)
  const { data: profs } = await (admin as any)
    .from('profiles').select('id, full_name, role').in('id', userIds)
  
  const profMap = new Map(profs.map((p: any) => [p.id, p]))
  const participants = fullParts.map((p: any) => {
    const prof = profMap.get(p.user_id) as any
    return {
      user_id: p.user_id,
      role: p.role,
      full_name: prof?.full_name || '',
      user_role: prof?.role || ''
    }
  })

  return NextResponse.json({ 
    conversation: { 
      ...conv, 
      participants,
      unread: 0
    } 
  })
}
