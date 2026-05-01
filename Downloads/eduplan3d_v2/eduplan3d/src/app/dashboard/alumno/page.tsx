import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlumnoClient } from '@/components/alumno/AlumnoClient'
import { ChildScopeSelector } from '@/components/family/ChildScopeSelector'
import { getLinkedChildrenForParent, getPrimaryLinkedChildForParent } from '@/lib/parents'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AlumnoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['student', 'parent'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const params = await Promise.resolve(searchParams || {})
  const requestedChildId = typeof params.child_id === 'string' ? params.child_id : undefined

  const instId = profile.institution_id
  let effectiveStudentId = user.id
  let studentProfile = profile
  let linkedChildren: Awaited<ReturnType<typeof getLinkedChildrenForParent>> = []
  let selectedChildId: string | null = null

  if (profile.role === 'parent') {
    linkedChildren = await getLinkedChildrenForParent(admin as any, user.id)
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, user.id, requestedChildId)
    if (!linkedChild) {
      return (
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="font-display text-3xl font-bold">Seguimiento Académico</h1>
          <p className="text-ink3 mt-3">Tu cuenta de representante todavía no tiene un estudiante vinculado. Pide a la institución que complete ese enlace.</p>
        </div>
      )
    }
    effectiveStudentId = linkedChild.childId
    selectedChildId = linkedChild.childId

    const { data: childProfile } = await admin
      .from('profiles')
      .select('id, full_name, institution_id, role')
      .eq('id', effectiveStudentId)
      .single()

    if (!childProfile) {
      return (
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="font-display text-3xl font-bold">Seguimiento Académico</h1>
          <p className="text-ink3 mt-3">No pudimos cargar la ficha del estudiante vinculado. Revisa el vínculo con la institución.</p>
        </div>
      )
    }
    studentProfile = childProfile as any
  }

  // ── 1. Matrícula del Alumno ────────────────────────────────────────────────
  // Para saber en qué curso está
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('student_id', effectiveStudentId)

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
      .eq('student_id', effectiveStudentId)
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
      .eq('student_id', effectiveStudentId)
      .in('subject_id', subjectIds)
      .order('date', { ascending: false })
    attendance = data || []
  }

  // ── 7. Comportamiento del Alumno ───────────────────────────────────────────
  let behaviors: any[] = []
  if (subjectIds.length > 0) {
      const { data } = await admin
      .from('behaviors')
      .select('*')
      .eq('student_id', effectiveStudentId)
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
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
    <div className="max-w-7xl mx-auto">
      {profile.role === 'parent' && selectedChildId && (
        <ChildScopeSelector
          childrenOptions={linkedChildren}
          selectedChildId={selectedChildId}
          title="Seguimiento por estudiante"
          description="Cambia el hijo que quieres revisar en seguimiento, tareas, asistencia y comportamiento."
        />
      )}

      <AlumnoClient
        profile={profile}
        studentProfile={studentProfile}
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
    </div>
  )
}
