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
      .select('id, name, join_code, created_at')
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
    />
  )
}
