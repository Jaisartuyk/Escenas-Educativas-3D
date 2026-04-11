import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PlannerClient } from '@/components/planner/PlannerClient'

export const dynamic = 'force-dynamic'

export default async function PlanificadorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, role, institution_id, plan')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const instId = profile.institution_id

  // Teacher's subjects with course info
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, name, course_id, weekly_hours, course:courses(id, name, parallel, level, shift)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  // Schedule config (period duration)
  let scheduleConfig: any = null
  if (instId) {
    const { data } = await admin
      .from('schedule_configs' as any)
      .select('period_minutes, parciales_count')
      .eq('institution_id', instId)
      .maybeSingle()
    scheduleConfig = data
  }

  // Institution name
  let institutionName = ''
  if (instId) {
    const { data } = await admin
      .from('institutions')
      .select('name')
      .eq('id', instId)
      .single()
    institutionName = data?.name || ''
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Planificador</h1>
        <p className="text-ink3 text-sm mt-1">Genera planificaciones curriculares MINEDUC con IA</p>
      </div>
      <PlannerClient
        teacherName={profile.full_name || ''}
        teacherPlan={profile.plan || 'free'}
        institutionName={institutionName}
        subjects={subjects || []}
        periodMinutes={scheduleConfig?.period_minutes || 40}
        parcialesCount={scheduleConfig?.parciales_count || 2}
      />
    </div>
  )
}
