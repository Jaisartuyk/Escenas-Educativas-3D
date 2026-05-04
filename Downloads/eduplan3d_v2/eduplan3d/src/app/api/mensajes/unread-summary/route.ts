import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLinkedChildrenForParent } from '@/lib/parents'

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

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ totalUnread: 0, unreadConversations: 0 })

  const admin = createAdminClient()

  const { data: me } = await (admin as any)
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!me) return NextResponse.json({ totalUnread: 0, unreadConversations: 0 })

  const { data: parts } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  const partRows = (parts || []) as any[]
  const convIdSet = new Set<string>(partRows.map((p: any) => p.conversation_id))

  if (me.role === 'parent') {
    const linkedChildren = await getLinkedChildrenForParent(admin as any, user.id)
    const childIds = linkedChildren.map((child) => child.childId)
    if (childIds.length > 0) {
      const { data: parentConvs } = await (admin as any)
        .from('conversations')
        .select('id')
        .in('student_id', childIds)
        .eq('type', 'direct')

      for (const conv of ((parentConvs || []) as any[])) {
        convIdSet.add(conv.id)
        if (!partRows.some((p: any) => p.conversation_id === conv.id)) {
          partRows.push({ conversation_id: conv.id, last_read_at: null })
        }
        await (admin as any)
          .from('conversation_participants')
          .upsert(
            { conversation_id: conv.id, user_id: user.id, role: 'parent' },
            { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
          )
      }
    }
  }

  const convIds = Array.from(convIdSet)
  if (convIds.length === 0) return NextResponse.json({ totalUnread: 0, unreadConversations: 0 })

  const lastReadMap = new Map<string, string | null>(partRows.map((p: any) => [p.conversation_id, p.last_read_at]))

  const { data: convs } = await (admin as any)
    .from('conversations')
    .select('id, type, student_id, last_message_at, created_at')
    .in('id', convIds)

  const { data: allParts } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds)

  const partUserIds = Array.from(new Set(((allParts || []) as any[]).map((p: any) => p.user_id)))
  const userRoleMap = new Map<string, string>()
  if (partUserIds.length > 0) {
    const { data: profs } = await (admin as any)
      .from('profiles')
      .select('id, role')
      .in('id', partUserIds)
    for (const p of ((profs || []) as any[])) userRoleMap.set(p.id, p.role || '')
  }

  const byConv = new Map<string, any[]>()
  for (const p of ((allParts || []) as any[])) {
    const list = byConv.get(p.conversation_id) || []
    list.push({ ...p, user_role: userRoleMap.get(p.user_id) || '' })
    byConv.set(p.conversation_id, list)
  }

  const deduped = new Map<string, { conv: any; unread: number }>()

  for (const conv of ((convs || []) as any[])) {
    const lr = lastReadMap.get(conv.id)
    const q = (admin as any)
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', user.id)
    const { count } = lr ? await q.gt('created_at', lr) : await q
    const unread = count || 0

    const key = buildConversationDedupKey(conv, byConv.get(conv.id) || [], user.id, me.role)
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, { conv, unread })
      continue
    }

    const existingScore =
      unread +
      toEpoch(existing.conv.last_message_at || existing.conv.created_at)
    const candidateScore =
      unread +
      toEpoch(conv.last_message_at || conv.created_at)

    if (candidateScore > existingScore) {
      deduped.set(key, { conv, unread })
    }
  }

  const values = Array.from(deduped.values())
  const totalUnread = values.reduce((sum, item) => sum + item.unread, 0)
  const unreadConversations = values.filter((item) => item.unread > 0).length

  return NextResponse.json({ totalUnread, unreadConversations })
}
