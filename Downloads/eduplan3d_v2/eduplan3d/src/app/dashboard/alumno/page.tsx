import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlumnoClient } from '@/components/alumno/AlumnoClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AlumnoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') {
    // Si no es estudiante, redirigir al dashboard principal
    redirect('/dashboard')
  }

  const instId = profile.institution_id

  // ── 1. Matrícula del Alumno ────────────────────────────────────────────────
  // Para saber en qué curso está
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('student_id', user.id)

  const courseIds = (enrollments || []).map((e: any) => e.course_id)

  // ── 2. Curso y Materias ─────────────────────────────────────────────────────
  let courses: any[] = []
  let subjects: any[] = []
  let subjectIds: string[] = []

  if (courseIds.length > 0) {
    const { data: courseData } = await admin
      .from('courses')
      .select('*')
      .in('id', courseIds)
    courses = courseData || []

    const { data: subData } = await admin
      .from('subjects')
      .select('*, teacher:profiles(full_name)')
      .in('course_id', courseIds)
      .order('name', { ascending: true })
    subjects = subData || []
    subjectIds = subjects.map((s: any) => s.id)
  }

  // ── 3. Tareas Asignadas (Assignments) ──────────────────────────────────────
  let assignments: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('assignments')
      .select('*')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    assignments = data || []
  }

  // ── 4. Calificaciones del Alumno (Grades) ──────────────────────────────────
  let grades: any[] = []
  const assignmentIds = assignments.map((a: any) => a.id)
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('grades')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('student_id', user.id)
    grades = data || []
  }

  // ── 5. Categorías de calificación ──────────────────────────────────────────
  let categories: any[] = []
  if (instId) {
    const { data } = await admin
      .from('grade_categories' as any)
      .select('*')
      .eq('institution_id', instId)
      .order('sort_order', { ascending: true })
    categories = data || []
  }

  // ── 6. Asistencia del Alumno ───────────────────────────────────────────────
  let attendance: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('attendance')
      .select('*')
      .eq('student_id', user.id)
      .in('subject_id', subjectIds)
      .order('date', { ascending: false })
    attendance = data || []
  }

  // ── 7. Comportamiento del Alumno ───────────────────────────────────────────
  let behaviors: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('behavior_records')
      .select('*')
      .eq('student_id', user.id)
      .in('subject_id', subjectIds)
      .order('date', { ascending: false })
    behaviors = data || []
  }

  // ── 8. Config de horario e Institución (para el personal grid) ────────────
  const scheduleConfig = instId 
    ? await admin.from('schedule_configs' as any).select('*').eq('institution_id', instId).maybeSingle().then(r => r.data)
    : null

  const instSettings = (profile as any)?.institutions?.settings || {}
  const allHorarios: Record<string, any> = {}
  Object.keys(instSettings).forEach(key => {
    if (key.startsWith('horarios_') || key === 'horarios') {
      const slot = instSettings[key]
      if (slot?.horario) allHorarios[key] = slot
    }
  })

  return (
    <AlumnoClient
      profile={profile}
      courses={courses}
      subjects={subjects}
      assignments={assignments}
      grades={grades}
      categories={categories}
      attendance={attendance}
      behaviors={behaviors}
      scheduleConfig={scheduleConfig}
      horariosData={allHorarios}
    />
  )
}
