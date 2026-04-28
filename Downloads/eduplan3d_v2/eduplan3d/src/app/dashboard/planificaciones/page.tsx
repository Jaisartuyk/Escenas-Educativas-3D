// src/app/dashboard/planificaciones/page.tsx
// Vista de tarjetas: una por cada materia/curso del docente institucional.
// Click en tarjeta → editor rich-text de la planificación anual (Fase 4).

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveYearContext } from '@/lib/academic-year/server'
import { PlanificacionesCards } from '@/components/planificaciones/PlanificacionesCards'

export const metadata: Metadata = { title: 'Planificaciones' }
export const dynamic = 'force-dynamic'

export default async function PlanificacionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, institution_id, full_name, plan')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const { data: institution } = profile.institution_id
    ? await admin
        .from('institutions')
        .select('name')
        .eq('id', profile.institution_id)
        .single()
    : { data: null }

  const institutionName = institution?.name || ''
  const isLetamendi = institutionName.toUpperCase().includes('LETAMENDI')

  // Solo docentes institucionales (planner_solo no tiene plan manual MinEduc).
  const isInstitutionalTeacher =
    !!profile.institution_id &&
    ['teacher', 'rector', 'supervisor'].includes(profile.role)
  if (!isInstitutionalTeacher) {
    redirect('/dashboard')
  }

  // Materias del docente con su curso.
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, name, course_id, course:courses(id, name, parallel, level)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  // Año lectivo actual (para asociar la planificación a un año).
  const ycx = await resolveYearContext(user.id)
  const academicYearId = ycx.viewingYearId || ycx.currentYearId || null

  // Planificaciones manuales existentes del docente para este año.
  // PostgreSQL: NULL ≠ NULL, así que para academic_year_id null se usa
  // .is(...) en vez de .eq(...) — sino no devuelve filas guardadas con NULL.
  let plansQuery = (admin as any)
    .from('planificaciones_manuales')
    .select('id, subject_id, course_id, status, type, unit_number, updated_at, title')
    .eq('user_id', user.id)
  plansQuery = academicYearId === null
    ? plansQuery.is('academic_year_id', null)
    : plansQuery.eq('academic_year_id', academicYearId)
  const { data: manualPlans } = await plansQuery

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Planificaciones</h1>
        <p className="text-ink3 text-sm mt-1">
          {isLetamendi
            ? 'Crea tu planificación anual y semanal por cada materia/curso. Edita el documento como un Word y publícalo cuando esté listo para que el rector lo revise.'
            : 'Una planificación anual por cada materia/curso. Edita el documento como un Word y publícalo cuando esté listo para que el rector lo revise.'}
        </p>
      </div>
      <PlanificacionesCards
        subjects={(subjects as any[]) || []}
        manualPlans={(manualPlans as any[]) || []}
        academicYearId={academicYearId}
        institutionName={institutionName}
      />
    </div>
  )
}
