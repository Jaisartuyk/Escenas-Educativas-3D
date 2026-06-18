'use server'
// src/lib/actions/subscriptions.ts
// Server actions para gestionar suscripciones del planificador IA.
// Modelo: $20/mes, registro manual desde SuperAdmin.

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'

const PERIOD_DAYS = 30

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getSuperAdminUserId(): Promise<string | null> {
  try {
    const sb = createServerClient()
    const { data: { user } } = await sb.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Registra un pago de suscripción del planificador.
 * - Si no hay suscripción → crea una nueva (period_end = now + 30 días)
 * - Si la suscripción está activa y aún no vence → extiende period_end +30 días
 * - Si está vencida o suspendida → reinicia con period_start = now, period_end = now+30
 * - Quita la bandera planner_suspended automáticamente.
 */
export async function recordPlannerPayment(opts: {
  userId: string
  amount?: number
  method?: 'efectivo' | 'transferencia' | 'deposito' | 'otro'
  notes?: string
}) {
  const { userId } = opts
  const amount = opts.amount ?? 20
  const method = opts.method ?? 'efectivo'

  const sb = admin()
  const recordedBy = await getSuperAdminUserId()

  // Suscripción actual (si existe)
  const { data: sub } = await sb
    .from('planner_subscriptions')
    .select('id, current_period_start, current_period_end, status')
    .eq('user_id', userId)
    .maybeSingle() as { data: any }

  const now = new Date()
  const nowMs = now.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  let periodStart: Date
  let periodEnd: Date

  if (!sub) {
    // Primera suscripción
    periodStart = now
    periodEnd = new Date(nowMs + PERIOD_DAYS * dayMs)

    const { error: insErr } = await sb.from('planner_subscriptions').insert({
      user_id: userId,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      status: 'active',
      monthly_amount: amount,
    })
    if (insErr) return { error: 'No se pudo crear la suscripción: ' + insErr.message }
  } else {
    const existingEnd = new Date(sub.current_period_end)
    const isStillActive = sub.status === 'active' && existingEnd.getTime() > nowMs

    if (isStillActive) {
      // Extiende desde el fin actual
      periodStart = existingEnd
      periodEnd = new Date(existingEnd.getTime() + PERIOD_DAYS * dayMs)
    } else {
      // Reinicia (vencida/suspendida/cancelada)
      periodStart = now
      periodEnd = new Date(nowMs + PERIOD_DAYS * dayMs)
    }

    const { error: updErr } = await sb
      .from('planner_subscriptions')
      .update({
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        status: 'active',
      })
      .eq('id', sub.id)
    if (updErr) return { error: 'No se pudo actualizar la suscripción: ' + updErr.message }
  }

  // Insertar el pago en el historial
  const { data: subRow } = await sb
    .from('planner_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single() as { data: { id: string } | null }

  const { error: payErr } = await sb.from('planner_payments').insert({
    user_id: userId,
    subscription_id: subRow?.id ?? null,
    amount,
    paid_at: now.toISOString(),
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    method,
    notes: opts.notes ?? null,
    recorded_by: recordedBy,
  })
  if (payErr) return { error: 'Pago registrado parcialmente: ' + payErr.message }

  // Quitar suspensión
  const { error: profErr } = await sb
    .from('profiles')
    .update({ planner_suspended: false })
    .eq('id', userId)
  if (profErr) return { error: 'Pago OK pero no se pudo reactivar: ' + profErr.message }

  revalidatePath('/superadmin')
  return {
    success: true,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
  }
}

/**
 * Suspende o reactiva manualmente al docente desde el SuperAdmin.
 * Si suspende: planner_suspended=true, status='suspended'
 * Si reactiva: planner_suspended=false; el status vuelve a 'active' SOLO si
 * la suscripción aún no vence (de lo contrario queda 'expired').
 */
export async function setPlannerSuspended(userId: string, suspended: boolean) {
  const sb = admin()

  const { error: profErr } = await sb
    .from('profiles')
    .update({ planner_suspended: suspended })
    .eq('id', userId)
  if (profErr) return { error: profErr.message }

  // Sincronizar estado de la suscripción
  const { data: sub } = await sb
    .from('planner_subscriptions')
    .select('current_period_end, status')
    .eq('user_id', userId)
    .maybeSingle() as { data: any }

  if (sub) {
    let newStatus = sub.status
    if (suspended) {
      newStatus = 'suspended'
    } else {
      newStatus = new Date(sub.current_period_end).getTime() > Date.now() ? 'active' : 'expired'
    }
    await sb.from('planner_subscriptions').update({ status: newStatus }).eq('user_id', userId)
  }

  revalidatePath('/superadmin')
  return { success: true }
}

/**
 * Cron: marca como expired y suspende a los docentes cuya suscripción venció.
 * Llamar desde /api/cron/expire-subscriptions diariamente.
 */
export async function expireOverdueSubscriptions() {
  const sb = admin()
  const now = new Date().toISOString()

  // Buscar suscripciones activas con period_end < ahora
  const { data: overdue, error } = await sb
    .from('planner_subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('current_period_end', now)

  if (error) return { error: error.message, expired: 0 }
  if (!overdue || overdue.length === 0) return { success: true, expired: 0 }

  const userIds = overdue.map((o: any) => o.user_id)
  const subIds = overdue.map((o: any) => o.id)

  // Actualizar suscripciones a expired
  await sb.from('planner_subscriptions').update({ status: 'expired' }).in('id', subIds)

  // Suspender docentes
  await sb.from('profiles').update({ planner_suspended: true }).in('id', userIds)

  return { success: true, expired: overdue.length, userIds }
}

/**
 * Devuelve el estado de suscripción de un usuario (para el guard del API).
 */
export async function getSubscriptionStatus(userId: string) {
  const sb = admin()
  const { data: prof } = await sb
    .from('profiles')
    .select('planner_suspended')
    .eq('id', userId)
    .single() as { data: { planner_suspended: boolean } | null }

  const { data: sub } = await sb
    .from('planner_subscriptions')
    .select('current_period_end, status, monthly_amount')
    .eq('user_id', userId)
    .maybeSingle() as { data: any }

  return {
    suspended: !!prof?.planner_suspended,
    subscription: sub,
  }
}
