import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST — crear tarea
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { error } = await admin.from('assignments').insert({
    id:          body.id,
    subject_id:  body.subject_id,
    title:       body.title,
    description: body.description || null,
    due_date:    body.due_date || null,
    trimestre:   body.trimestre ?? 1,
    parcial:     body.parcial ?? 1,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — eliminar tarea
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('assignments').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
