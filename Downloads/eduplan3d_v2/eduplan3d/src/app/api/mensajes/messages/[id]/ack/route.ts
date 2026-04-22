// src/app/api/mensajes/messages/[id]/ack/route.ts
// POST → "Recibido ✓" del receptor de un boletín.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Verificar que el msg existe y el usuario es participante del hilo
  const { data: msg } = await (admin as any)
    .from('messages').select('id, conversation_id, kind').eq('id', params.id).single()
  if (!msg) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
  const { data: part } = await (admin as any)
    .from('conversation_participants').select('conversation_id')
    .eq('conversation_id', msg.conversation_id).eq('user_id', user.id).maybeSingle()
  if (!part) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { error } = await (admin as any)
    .from('message_read_receipts')
    .upsert({ message_id: params.id, user_id: user.id, acknowledged_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
