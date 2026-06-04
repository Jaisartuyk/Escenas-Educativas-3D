import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'

const ALLOWED_ROLES = new Set(['admin', 'secretary', 'rector', 'assistant'])
export const dynamic = 'force-dynamic'

function normalizeDebtorType(row: any): 'student' | 'external' {
  return row?.debtor_type === 'external' || (!row?.student_id && row?.external_name) ? 'external' : 'student'
}

// GET - obtener deudas historicas de la institucion
export async function GET(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ data: [] })
  if (!ALLOWED_ROLES.has(profile.role || '')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('historical_debts' as any)
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scope = (new URL(req.url).searchParams.get('scope') || 'student').toLowerCase()
  const normalized = (data || []).map((row: any) => ({
    ...row,
    debtor_type: normalizeDebtorType(row),
  }))

  const filtered = normalized.filter((row: any) => {
    if (scope === 'external') return row.debtor_type === 'external'
    if (scope === 'all') return true
    return row.debtor_type === 'student'
  })

  return NextResponse.json({ data: filtered })
}

// POST - crear nueva deuda historica
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institucion' }, { status: 400 })
  if (!ALLOWED_ROLES.has(profile.role || '')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await req.json()
  const {
    student_id,
    period,
    description,
    type,
    amount,
    notes,
    debtor_type,
    external_name,
    external_identifier,
    external_phone,
  } = body

  const normalizedDebtorType: 'student' | 'external' =
    debtor_type === 'external' || (!student_id && String(external_name || '').trim()) ? 'external' : 'student'

  if (!description || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (normalizedDebtorType === 'student' && !student_id) {
    return NextResponse.json({ error: 'Selecciona un alumno' }, { status: 400 })
  }

  if (normalizedDebtorType === 'external' && !String(external_name || '').trim()) {
    return NextResponse.json({ error: 'Escribe el nombre de la persona' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('historical_debts' as any)
    .insert({
      institution_id: profile.institution_id,
      student_id: normalizedDebtorType === 'student' ? student_id : null,
      debtor_type: normalizedDebtorType,
      external_name: normalizedDebtorType === 'external' ? String(external_name || '').trim() : null,
      external_identifier: normalizedDebtorType === 'external' ? String(external_identifier || '').trim() || null : null,
      external_phone: normalizedDebtorType === 'external' ? String(external_phone || '').trim() || null : null,
      period: period || '2024-2025',
      description,
      type: type || 'pension',
      amount: Number(amount),
      paid_amount: 0,
      status: 'pendiente',
      notes: notes || null,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: {
      ...(data as any),
      debtor_type: normalizeDebtorType(data),
    },
  })
}
