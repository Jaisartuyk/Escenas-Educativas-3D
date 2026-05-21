import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'

const ALLOWED_ROLES = new Set(['admin', 'secretary', 'rector', 'assistant'])
export const dynamic = 'force-dynamic'

// GET — obtener todas las deudas históricas de la institución
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('historical_debts' as any)
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

// POST — crear nueva deuda histórica
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!ALLOWED_ROLES.has(profile.role || '')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await req.json()
  const { student_id, period, description, type, amount, notes } = body

  if (!student_id || !description || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('historical_debts' as any)
    .insert({
      institution_id: profile.institution_id,
      student_id,
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
  return NextResponse.json({ data })
}
