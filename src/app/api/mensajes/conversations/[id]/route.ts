// src/app/api/mensajes/conversations/[id]/route.ts
// DELETE → elimina una conversación.
//   - Boletines (type='bulletin'): solo admin/assistant/rector de la
//     institución puede borrarlo. Borra el hilo para todos.
//   - Conversaciones directas: solo el creador o un admin de la institución
//     puede borrarlas. (Por ahora prefiramos no exponer borrado de DMs.)
//
// Borrar el hilo cascadea (FK ON DELETE CASCADE) → messages, participants,
// receipts también se eliminan.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLES = ['admin', 'assistant', 'rector']

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: me } = await (admin as any)
    .from('profiles').select('id, role, institution_id').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const { data: conv } = await (admin as any)
    .from('conversations')
    .select('id, type, created_by, institution_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  if (conv.institution_id !== me.institution_id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  if (conv.type === 'bulletin') {
    // Solo administración puede borrar boletines.
    if (!ADMIN_ROLES.includes(me.role)) {
      return NextResponse.json(
        { error: 'Solo la administración puede eliminar boletines.' },
        { status: 403 }
      )
    }
  } else {
    // DM: solo el creador o un admin
    const isCreator = conv.created_by === me.id
    const isAdmin = ADMIN_ROLES.includes(me.role)
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Sin permiso para eliminar' }, { status: 403 })
    }
  }

  // Borrar la conversación. ON DELETE CASCADE en messages /
  // conversation_participants se encarga del resto.
  const { error } = await (admin as any)
    .from('conversations').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deletedId: params.id })
}
