import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — listar categorías de la institución
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('institution_id').eq('id', user.id).single()
  if (!profile?.institution_id) return NextResponse.json({ data: [] })

  const { data, error } = await admin
    .from('grade_categories' as any)
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

// POST — crear o actualizar categoría
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('institution_id').eq('id', user.id).single()
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })

  if (body.id) {
    // Actualizar
    const { error } = await admin
      .from('grade_categories' as any)
      .update({
        name:           body.name,
        color:          body.color,
        weight_percent: body.weight_percent,
        sort_order:     body.sort_order ?? 0,
      })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Crear
    const { error } = await admin
      .from('grade_categories' as any)
      .insert({
        institution_id: profile.institution_id,
        name:           body.name,
        color:          body.color,
        weight_percent: body.weight_percent,
        sort_order:     body.sort_order ?? 0,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Retornar la lista actualizada
  const { data } = await admin
    .from('grade_categories' as any)
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ data: data || [] })
}

// DELETE — eliminar categoría
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('grade_categories' as any).delete().eq('id', id)
  return NextResponse.json({ success: true })
}
