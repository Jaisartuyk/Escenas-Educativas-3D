// src/app/superadmin/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SuperAdminClient } from '@/components/superadmin/SuperAdminClient'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Only allow the superadmin email defined in env
  const superAdminEmail = process.env.SUPERADMIN_EMAIL
  if (!superAdminEmail || user.email !== superAdminEmail) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  // ── Stats globales ───────────────────────────────────────────────────────
  const [
    { count: totalInstitutions },
    { count: totalUsers },
    { count: plannerSoloCount },
    { count: totalPlans },
    { data: institutions },
    { data: plannerUsers },
  ] = await Promise.all([
    admin.from('institutions').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'planner_solo'),
    // Planificaciones generadas por el planificador IA (no docs subidos por docentes)
    (admin as any).from('planificaciones').select('*', { count: 'exact', head: true }),
    admin
      .from('institutions')
      .select('id, name, join_code, created_at, planner_ia_enabled')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('profiles')
      .select('id, full_name, email, plan, created_at')
      .eq('plan', 'planner_solo')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // For each institution, get member counts
  const instIds = (institutions || []).map((i: any) => i.id)
  let memberCounts: Record<string, number> = {}
  if (instIds.length > 0) {
    const { data: members } = await admin
      .from('profiles')
      .select('institution_id')
      .in('institution_id', instIds)
    ;(members || []).forEach((m: any) => {
      memberCounts[m.institution_id] = (memberCounts[m.institution_id] || 0) + 1
    })
  }

  // Recent signups (all plans, last 30 days)
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: newUsersMonth } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since30)

  // ── Suscripciones del planificador (todos los docentes) ─────────────────
  // Trae TODOS los docentes (institucional o externo) + su suscripcion + ultimo pago.
  const [
    { data: teachersRaw },
    { data: subscriptions },
  ] = await Promise.all([
    (admin as any)
      .from('profiles')
      .select('id, full_name, email, plan, role, planner_suspended, institution_id, created_at')
      .in('role', ['teacher', 'rector', 'supervisor'])
      .order('full_name', { ascending: true }),
    (admin as any)
      .from('planner_subscriptions')
      .select('user_id, current_period_start, current_period_end, status, monthly_amount'),
  ])

  // Tambien incluir externos planner_solo (que no tienen role='teacher' necesariamente)
  const { data: externos } = await (admin as any)
    .from('profiles')
    .select('id, full_name, email, plan, role, planner_suspended, institution_id, created_at')
    .in('plan', ['planner_solo', 'planner_pro'])

  // Map institution name
  const instMap = new Map((institutions || []).map((i: any) => [i.id, i.name]))

  // Combinar y deduplicar
  const allTeachers = [...(teachersRaw || []), ...(externos || [])]
  const uniqueMap = new Map<string, any>()
  for (const t of allTeachers) uniqueMap.set(t.id, t)
  const teachers = Array.from(uniqueMap.values())

  const subMap = new Map<string, any>((subscriptions || []).map((s: any) => [s.user_id, s]))

  const teacherSubs = teachers.map((t: any) => {
    const sub: any = subMap.get(t.id)
    return {
      id: t.id,
      full_name: t.full_name,
      email: t.email,
      plan: t.plan,
      role: t.role,
      planner_suspended: !!t.planner_suspended,
      institution_id: t.institution_id,
      institution_name: t.institution_id ? (instMap.get(t.institution_id) || '—') : '— Externo —',
      current_period_end: sub?.current_period_end ?? null,
      sub_status: sub?.status ?? 'never',
      monthly_amount: sub?.monthly_amount ?? 20,
    }
  })

  // Stats de pagos del mes
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: monthPayments } = await (admin as any)
    .from('planner_payments')
    .select('amount')
    .gte('paid_at', monthStart)

  const monthRevenue = (monthPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
  const activeCount = teacherSubs.filter(t => t.sub_status === 'active').length
  const expiredCount = teacherSubs.filter(t => t.sub_status === 'expired' || t.planner_suspended).length

  return (
    <SuperAdminClient
      stats={{
        totalInstitutions: totalInstitutions ?? 0,
        totalUsers:        totalUsers ?? 0,
        plannerSoloCount:  plannerSoloCount ?? 0,
        totalPlans:        totalPlans ?? 0,
        newUsersMonth:     newUsersMonth ?? 0,
      }}
      institutions={(institutions || []).map((i: any) => ({
        ...i,
        memberCount: memberCounts[i.id] || 0,
      }))}
      plannerUsers={plannerUsers || []}
      teacherSubs={teacherSubs}
      paymentStats={{
        activeCount,
        expiredCount,
        monthRevenue,
        totalTeachers: teacherSubs.length,
      }}
    />
  )
}
