// src/app/api/mensajes/conversations/[id]/messages/route.ts
// GET  → lista mensajes de un hilo (paginado por cursor ?before=ISO)
// POST → envía un mensaje al hilo
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAppNotifications } from '@/lib/notifications'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  let part = null
  const { data: existingPart } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', params.id).eq('user_id', user.id).maybeSingle()
  part = existingPart

  // Si el usuario NO es participante, verificar si es un padre con acceso legítimo
  // (padre representante del estudiante vinculado a esta conversación).
  // Esto repara conversaciones antiguas creadas sin el padre como participante.
  if (!part) {
    const { data: me } = await (admin as any)
      .from('profiles').select('id, role').eq('id', user.id).single()

    if (me?.role === 'parent') {
      // Buscar la conversación para ver de qué estudiante se trata
      const { data: conv } = await (admin as any)
        .from('conversations')
        .select('id, student_id, type')
        .eq('id', params.id)
        .maybeSingle()

      if (conv?.student_id) {
        // Verificar que el padre tiene este estudiante vinculado
        const { data: link } = await (admin as any)
          .from('parent_links')
          .select('child_id')
          .eq('parent_id', user.id)
          .eq('child_id', conv.student_id)
          .maybeSingle()

        if (link) {
          // El padre tiene derecho: añadirlo como participante (reparación automática)
          await (admin as any)
            .from('conversation_participants')
            .upsert(
              { conversation_id: params.id, user_id: user.id, role: 'parent' },
              { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
            )
          part = { conversation_id: params.id }
        }
      }
    }
  }

  if (!part) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const before = req.nextUrl.searchParams.get('before')
  let q = (admin as any).from('messages')
    .select('id, conversation_id, sender_id, body, kind, metadata, created_at, edited_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (before) q = q.lt('created_at', before)
  const { data: rows, error: msgErr } = await q
  if (msgErr) return NextResponse.json({ error: msgErr.message, messages: [], receipts: {} }, { status: 500 })

  // Hidratar sender por separado (evita depender del join embebido de PostgREST)
  const senderIds = Array.from(new Set(((rows || []) as any[]).map((m: any) => m.sender_id).filter(Boolean)))
  const senderMap: Record<string, { id: string; full_name: string | null; role: string | null }> = {}
  if (senderIds.length > 0) {
    const { data: profs } = await (admin as any)
      .from('profiles').select('id, full_name, role').in('id', senderIds)
    for (const p of ((profs || []) as any[])) senderMap[p.id] = { id: p.id, full_name: p.full_name, role: p.role }
  }
  const messages = ((rows || []) as any[]).map((m: any) => ({
    ...m,
    sender: senderMap[m.sender_id] || null,
  })).reverse()

  // Acuses por mensaje (para boletines)
  const bulletinIds = messages.filter((m: any) => m.kind === 'bulletin').map((m: any) => m.id)
  let receiptsByMsg: Record<string, string[]> = {}
  if (bulletinIds.length > 0) {
    const { data: rr } = await (admin as any)
      .from('message_read_receipts')
      .select('message_id, user_id, acknowledged_at')
      .in('message_id', bulletinIds)
    for (const r of (rr || []) as any[]) {
      (receiptsByMsg[r.message_id] ||= []).push(r.user_id)
    }
  }

  return NextResponse.json({ messages, receipts: receiptsByMsg })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const text: string = String(body?.body ?? '').trim()
  if (!text) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  if (text.length > 4000) return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 400 })

  const admin = createAdminClient()

  let part = null
  const { data: existingPart } = await (admin as any)
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', params.id).eq('user_id', user.id).maybeSingle()
  part = existingPart

  if (!part) {
    const { data: me } = await (admin as any)
      .from('profiles').select('id, role').eq('id', user.id).single()

    if (me?.role === 'parent') {
      const { data: conv } = await (admin as any)
        .from('conversations').select('id, student_id').eq('id', params.id).maybeSingle()

      if (conv?.student_id) {
        const { data: link } = await (admin as any)
          .from('parent_links')
          .select('child_id')
          .eq('parent_id', user.id).eq('child_id', conv.student_id).maybeSingle()

        if (link) {
          await (admin as any)
            .from('conversation_participants')
            .upsert(
              { conversation_id: params.id, user_id: user.id, role: 'parent' },
              { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
            )
          part = { conversation_id: params.id }
        }
      }
    }
  }

  if (!part) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: msg, error } = await (admin as any)
    .from('messages')
    .insert({ conversation_id: params.id, sender_id: user.id, body: text, kind: 'text' })
    .select('id, conversation_id, sender_id, body, kind, metadata, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Marcar como leído para el emisor
  await (admin as any)
    .from('conversation_participants')
    .update({ last_read_at: msg.created_at })
    .eq('conversation_id', params.id).eq('user_id', user.id)

  const [{ data: me }, { data: participants }] = await Promise.all([
    (admin as any).from('profiles').select('full_name').eq('id', user.id).single(),
    (admin as any)
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', params.id),
  ])

  const recipientIds = ((participants || []) as any[])
    .map((p: any) => p.user_id)
    .filter((id: string) => id && id !== user.id)

  await createAppNotifications(
    admin as any,
    recipientIds.map((recipientId: string) => ({
      userId: recipientId,
      category: 'message',
      title: `Nuevo mensaje de ${me?.full_name || 'un contacto'}`,
      body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
      href: '/dashboard/mensajes',
      metadata: { conversationId: params.id, senderId: user.id },
    })),
  )

  return NextResponse.json({ message: msg })
}
