// src/app/api/academic-years/route.ts
// GET  → lista los años lectivos de la institución del usuario autenticado
// POST → crea un año lectivo nuevo (solo admin). Opcionalmente lo marca como current.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CreateAcademicYearInput } from '@/types/academic-year'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Buscar la institución del usuario
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('institution_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.institution_id) {
    // planner_solo u otros sin institución: no aplica el sistema
    return NextResponse.json({ years: [], currentId: null, role: profile?.role || null })
  }

  const { data: years, error } = await (admin as any)
    .from('academic_years')
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('label', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const current = (years || []).find((y: any) => y.is_current)
  return NextResponse.json({
    years:     years || [],
    currentId: current?.id || null,
    role:      profile.role,
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('institution_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.institution_id) {
    return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  }
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede crear años lectivos' }, { status: 403 })
  }

  const body = (await req.json()) as CreateAcademicYearInput
  const label = String(body?.label || '').trim()
  if (!label) return NextResponse.json({ error: 'label requerido' }, { status: 400 })

  // Si viene is_current=true, primero desmarcamos el anterior
  if (body.is_current) {
    await (admin as any)
      .from('academic_years')
      .update({ is_current: false })
      .eq('institution_id', profile.institution_id)
      .eq('is_current', true)
  }

  const { data: created, error } = await (admin as any)
    .from('academic_years')
    .insert({
      institution_id: profile.institution_id,
      label,
      start_date:     body.start_date || null,
      end_date:       body.end_date || null,
      is_current:     !!body.is_current,
      status:         'active',
    })
    .select()
    .single()

  if (error) {
    // Conflicto de label duplicado
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un año con esa etiqueta' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ year: created })
}
