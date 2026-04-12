import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DocenteClient } from '@/components/docente/DocenteClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function DocentePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'teacher'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id

  // ── Materias asignadas a este docente ────────────────────────────────────
  const { data: mySubjects } = await admin
    .from('subjects' as any)
    .select('*, course:courses(id, name, parallel, level, shift)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  const subjectIds = (mySubjects || []).map((s: any) => s.id)

  // ── Tareas de las materias del docente (con parcial/trimestre) ───────────
  let assignments: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('assignments')
      .select('id, subject_id, title, description, start_date, due_date, due_time, trimestre, parcial, category_id, created_at, updated_at')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    assignments = data || []
  }

  // ── Calificaciones de esas tareas ────────────────────────────────────────
  let grades: any[] = []
  const assignmentIds = assignments.map((a: any) => a.id)
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('grades')
      .select('*')
      .in('assignment_id', assignmentIds)
    grades = data || []
  }

  // ── Categorías de calificación ────────────────────────────────────────────
  let categories: any[] = []
  if (instId) {
    const { data } = await admin
      .from('grade_categories' as any)
      .select('*')
      .eq('institution_id', instId)
      .order('sort_order', { ascending: true })
    categories = data || []
  }

  // ── Config de horario (períodos, recesos) ────────────────────────────────
  let scheduleConfig: any = null
  if (instId) {
    const { data } = await admin
      .from('schedule_configs' as any)
      .select('*')
      .eq('institution_id', instId)
      .maybeSingle()
    scheduleConfig = data
  }

  // ── Horarios guardados (para mostrar horario personal del docente) ────────
  const instSettings = (profile as any)?.institutions?.settings || {}

  // Collect all saved horario grids
  const allHorarios: Record<string, any> = {}
  Object.keys(instSettings).forEach(key => {
    if (key.startsWith('horarios_') || key === 'horarios') {
      const slot = instSettings[key]
      if (slot?.horario) allHorarios[key] = slot
    }
  })

  return (
    <DocenteClient
      profile={profile}
      mySubjects={mySubjects || []}
      initialAssignments={assignments}
      initialGrades={grades}
      initialCategories={categories}
      teacherId={user.id}
      parcialesCount={scheduleConfig?.parciales_count || 2}
      horariosData={allHorarios}
    />
  )
}
