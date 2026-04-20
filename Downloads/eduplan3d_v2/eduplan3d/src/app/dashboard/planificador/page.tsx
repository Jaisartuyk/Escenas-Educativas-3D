import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PlannerClient } from '@/components/planner/PlannerClient'
import Link from 'next/link'

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
  const isPlannerSolo = (profile as any).plan === 'planner_solo'

  // Teacher's subjects with course info
  let subjects: any[] = []
  if (isPlannerSolo) {
    // Docente externo: materias creadas por él mismo en Mis Materias
    const { data: plannerSubjects } = await admin
      .from('planner_subjects' as any)
      .select('id, materia, curso, paralelo, nivel')
      .eq('user_id', user.id)
      .order('materia', { ascending: true })

    // Adaptar al shape esperado por PlannerClient
    subjects = (plannerSubjects || []).map((s: any) => ({
      id: s.id,
      name: s.materia,
      course_id: null,
      weekly_hours: 2,
      course: {
        id: null,
        name: s.curso,
        parallel: s.paralelo || '',
        level: s.nivel || '',
        shift: null,
      },
    }))
  } else {
    const { data } = await admin
      .from('subjects' as any)
      .select('id, name, course_id, weekly_hours, course:courses(id, name, parallel, level, shift)')
      .eq('teacher_id', user.id)
      .order('name', { ascending: true })
    subjects = data || []
  }

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

  // Empty state: planner_solo sin materias creadas
  if (isPlannerSolo && subjects.length === 0) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Planificador</h1>
          <p className="text-ink3 text-sm mt-1">Genera planificaciones curriculares MINEDUC con IA</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet2/10 flex items-center justify-center text-2xl mb-3">📚</div>
          <h2 className="font-display text-xl font-bold tracking-tight mb-1">
            Primero registra tus materias
          </h2>
          <p className="text-ink3 text-sm mb-5">
            Para generar planificaciones necesitas tener al menos una materia y curso creados en
            <strong> Mis Materias</strong>. Allí también puedes subir los libros/PDFs que la IA usará como referencia.
          </p>
          <Link
            href="/dashboard/biblioteca"
            className="inline-block px-5 py-2.5 rounded-xl bg-violet2 text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Ir a Mis Materias →
          </Link>
        </div>
      </div>
    )
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
        subjects={subjects}
        periodMinutes={scheduleConfig?.period_minutes || 40}
        parcialesCount={scheduleConfig?.parciales_count || 2}
      />
    </div>
  )
}
