import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'

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

// POST — crear o actualizar categoría (solo admin/assistant)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (profile.role !== 'admin' && profile.role !== 'assistant' && profile.role !== 'teacher') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  if (body.id) {
    // Verificar que la categoría pertenece a la misma institución
    const { data: cat } = await admin
      .from('grade_categories' as any)
      .select('institution_id')
      .eq('id', body.id)
      .single()
    if ((cat as any)?.institution_id !== profile.institution_id) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

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

  const { data } = await admin
    .from('grade_categories' as any)
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ data: data || [] })
}

// DELETE — eliminar categoría (solo admin/assistant, y verificar institución)
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (profile.role !== 'admin' && profile.role !== 'assistant') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: cat } = await admin
    .from('grade_categories' as any)
    .select('institution_id')
    .eq('id', id)
    .single()
  if ((cat as any)?.institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  await admin.from('grade_categories' as any).delete().eq('id', id)
  return NextResponse.json({ success: true })
}
