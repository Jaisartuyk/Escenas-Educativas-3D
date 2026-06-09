import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile, canManageFinances } from '@/lib/auth/ownership'
import { createStudentFamilyNotifications } from '@/lib/notifications'
import { attachAbonosToPayments, getAppliedAmount, getRemainingAmount } from '@/lib/payment-progress'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!canManageFinances(profile.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const paymentId = String(body?.payment_id || '')
  const amount = Number(body?.amount || 0)
  const paidAt = body?.paid_at || new Date().toISOString().split('T')[0]
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!paymentId) return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: payment, error: paymentError } = await admin
    .from('payments' as any)
    .select('*')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message || 'Cobro no encontrado' }, { status: 404 })
  }

  if ((payment as any).institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  if ((payment as any).status === 'pagado') {
    return NextResponse.json({ error: 'Este cobro ya está pagado' }, { status: 400 })
  }

  const { data: existingAbonos, error: abonosError } = await admin
    .from('payment_abonos' as any)
    .select('*')
    .eq('payment_id', paymentId)
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (abonosError) return NextResponse.json({ error: abonosError.message }, { status: 500 })

  const enrichedPayment = attachAbonosToPayments([payment as any], (existingAbonos || []) as any[])[0]
  const remainingBefore = getRemainingAmount(enrichedPayment)

  if (remainingBefore <= 0) {
    return NextResponse.json({ error: 'Este cobro ya está cubierto por completo' }, { status: 400 })
  }

  const safeAmount = Math.min(amount, remainingBefore)

  const { data: createdAbono, error: createError } = await admin
    .from('payment_abonos' as any)
    .insert({
      payment_id: paymentId,
      institution_id: profile.institution_id,
      student_id: (payment as any).student_id,
      amount: safeAmount,
      paid_at: paidAt,
      note: note || null,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })

  const finalAbonos = [createdAbono, ...(existingAbonos || [])]
  const finalPayment = attachAbonosToPayments([payment as any], finalAbonos as any[])[0]
  const appliedAmount = getAppliedAmount(finalPayment)
  const remainingAmount = getRemainingAmount(finalPayment)
  const isFullyPaid = remainingAmount <= 0

  const { data: updatedPayment, error: updateError } = await admin
    .from('payments' as any)
    .update({
      status: isFullyPaid ? 'pagado' : 'parcial',
      paid_date: isFullyPaid ? paidAt : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select('*')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await createStudentFamilyNotifications(admin as any, [(payment as any).student_id], {
    category: 'finance',
    title: isFullyPaid ? 'Pago completado' : 'Abono registrado',
    body: isFullyPaid
      ? `${(payment as any).description || 'Se completó un pago.'}`
      : `${(payment as any).description || 'Se registró un abono.'} · Abonado ${safeAmount.toFixed(2)}`,
    href: '/dashboard/finanzas',
    metadata: {
      paymentId,
      abonoId: (createdAbono as any).id,
      amount: safeAmount,
      remainingAmount,
      appliedAmount,
      status: isFullyPaid ? 'pagado' : 'parcial',
    },
  })

  return NextResponse.json({
    data: {
      payment: { ...updatedPayment, abonos: finalAbonos, applied_amount: appliedAmount, remaining_amount: remainingAmount },
      abono: createdAbono,
    },
  })
}
