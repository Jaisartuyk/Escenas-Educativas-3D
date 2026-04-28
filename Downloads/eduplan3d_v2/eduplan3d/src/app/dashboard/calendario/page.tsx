// src/app/dashboard/calendario/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarioClient } from '@/components/calendario/CalendarioClient'

export const metadata: Metadata = { title: 'Calendario' }
export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Cargar todas las planificaciones del usuario para el sidebar (drag source).
  const { data: planificaciones } = await (supabase as any)
    .from('planificaciones')
    .select('id, title, subject, grade, topic, type, grupo, content, metadata, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  // Cargar days_of_week por materia (para sugerir días al asignar sesiones).
  // Indexado por nombre de asignatura (subjects.name / planner_subjects.materia).
  const subjectDaysMap: Record<string, number[]> = {}
  const [{ data: subj }, { data: psubj }] = await Promise.all([
    (supabase as any)
      .from('subjects')
      .select('name, days_of_week')
      .eq('teacher_id', user.id),
    (supabase as any)
      .from('planner_subjects')
      .select('materia, days_of_week')
      .eq('user_id', user.id),
  ])
  ;(subj || []).forEach((s: any) => {
    if (s.name && Array.isArray(s.days_of_week) && s.days_of_week.length > 0) {
      subjectDaysMap[s.name] = s.days_of_week
    }
  })
  ;(psubj || []).forEach((s: any) => {
    if (s.materia && Array.isArray(s.days_of_week) && s.days_of_week.length > 0) {
      subjectDaysMap[s.materia] = s.days_of_week
    }
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Calendario docente</h1>
        <p className="text-ink3 text-sm mt-1">
          Arrastra tus planificaciones a los días de la semana. Reutiliza la misma planificación en distintos grupos o fechas.
        </p>
      </div>
      <CalendarioClient
        planificaciones={planificaciones || []}
        subjectDaysMap={subjectDaysMap}
      />
    </div>
  )
}
