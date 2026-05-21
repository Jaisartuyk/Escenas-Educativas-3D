import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'

const ALLOWED_ROLES = new Set(['admin', 'secretary', 'rector', 'assistant'])
export const dynamic = 'force-dynamic'

// PATCH — registrar un abono a una deuda histórica
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!ALLOWED_ROLES.has(profile.role || '')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await req.json()
  const { abono_amount } = body
  const debtId = params.id

  if (!abono_amount || Number(abono_amount) <= 0) {
    return NextResponse.json({ error: 'Monto de abono inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Obtener deuda actual
  const { data: debt, error: debtError } = await admin
    .from('historical_debts' as any)
    .select('*')
    .eq('id', debtId)
    .eq('institution_id', profile.institution_id)
    .single()

  if (debtError || !debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

  const currentDebt = debt as any
  const remaining = currentDebt.amount - currentDebt.paid_amount
  if (remaining <= 0) return NextResponse.json({ error: 'Esta deuda ya está pagada' }, { status: 400 })

  const safeAbono = Math.min(Number(abono_amount), remaining)
  const newPaid = currentDebt.paid_amount + safeAbono
  const newStatus = newPaid >= currentDebt.amount ? 'pagado' : newPaid > 0 ? 'parcial' : 'pendiente'

  const { data: updated, error: updateError } = await admin
    .from('historical_debts' as any)
    .update({
      paid_amount: newPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', debtId)
    .select('*')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ data: updated })
}

// DELETE — eliminar una deuda histórica
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!ALLOWED_ROLES.has(profile.role || '')) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('historical_debts' as any)
    .delete()
    .eq('id', params.id)
    .eq('institution_id', profile.institution_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
