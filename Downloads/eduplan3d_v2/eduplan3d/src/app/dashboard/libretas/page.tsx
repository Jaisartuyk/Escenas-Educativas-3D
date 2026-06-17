import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ChildScopeSelector } from '@/components/family/ChildScopeSelector'
import { LibretasClient } from '@/components/libretas/LibretasClient'
import { filterSubjectsForLibretas } from '@/lib/subject-visibility'
import { getLinkedChildrenForParent, getPrimaryLinkedChildForParent } from '@/lib/parents'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function LibretasPage({
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
    .select('*, institutions(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')

  const params = await Promise.resolve(searchParams || {})
  const requestedChildId = typeof params.child_id === 'string' ? params.child_id : undefined

  const instId = profile.institution_id
  const viewAsParent = params.view_as === 'parent'
  const linkedChildren = await getLinkedChildrenForParent(admin as any, user.id)
  const isParentMode = profile.role === 'parent' || (viewAsParent && linkedChildren.length > 0)

  let linkedStudentId: string | null = null
  if (isParentMode) {
    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, user.id, requestedChildId)
    if (!linkedChild) {
      return (
        <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
          <div className="print:hidden">
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Libretas de Calificaciones</h1>
            <p className="text-ink3 text-sm mt-1">Tu cuenta de representante todavía no tiene un estudiante vinculado.</p>
          </div>
        </div>
      )
    }
    linkedStudentId = linkedChild.childId
  }

  // â”€â”€ Fetch all institutional data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [
    { data: courses },
    { data: enrollments },
    { data: subjects },
    { data: categories },
    { data: scheduleConfig },
    { data: instData },
  ] = await Promise.all([
    admin.from('courses').select('*').eq('institution_id', instId),
    admin.from('enrollments').select('*, student:profiles(id, full_name, email)'),
    admin.from('subjects').select('*, course:courses(id, name, parallel), teacher:profiles!subjects_teacher_id_fkey(id, full_name)'),
    admin.from('grade_categories').select('*').eq('institution_id', instId).order('sort_order'),
    admin.from('schedule_configs' as any).select('parciales_count, tutores').eq('institution_id', instId).maybeSingle(),
    admin.from('institutions').select('settings').eq('id', instId).single(),
  ])

  const instSettings = (instData as any)?.settings || {}
  const libretasPublished = !!instSettings.libretas_published

  // For teachers: only show the course(s) they are tutor of
  // For teachers: only show the course(s) they are tutor of
  const tutores: Record<string, string> = (scheduleConfig as any)?.tutores || {}
  const isTeacher = profile.role === 'teacher'
  const isSupervisor = ['admin', 'assistant', 'supervisor', 'rector', 'secretary'].includes(profile.role)

  let filteredCourses = courses || []
  if (isTeacher) {
    // tutores map: "CourseName Parallel" â†’ teacherName (full_name string)
    const teacherName = profile.full_name || ''
    const tutorCourseNames = Object.entries(tutores)
      .filter(([, name]) => name === teacherName)
      .map(([courseName]) => courseName)

    if (tutorCourseNames.length > 0) {
      // Match by "name parallel" or just "name"
      filteredCourses = (courses || []).filter((c: any) => {
        const key = `${c.name} ${c.parallel || ''}`.trim()
        const keyNoParallel = c.name
        return tutorCourseNames.includes(key) || tutorCourseNames.includes(keyNoParallel)
      })
    } else {
      // Teacher not assigned as tutor of any course â†’ empty
      filteredCourses = []
    }
  }
  if (isParentMode && linkedStudentId) {
    const parentCourseIds = (enrollments || [])
      .filter((e: any) => e.student_id === linkedStudentId)
      .map((e: any) => e.course_id)
    filteredCourses = (courses || []).filter((c: any) => parentCourseIds.includes(c.id))
  }

  const courseIds = filteredCourses.map((c: any) => c.id)
  const institutionName = profile.institutions?.name || ''
  const instSubjects = filterSubjectsForLibretas(
    institutionName,
    ((subjects || []) as any[]).filter((s: any) => courseIds.includes(s.course_id)),
  )
  const subjectIds = instSubjects.map((s: any) => s.id)

  // Assignments and grades
  let assignments: any[] = []
  let grades: any[] = []

  if (subjectIds.length > 0) {
    const { data: aData } = await admin
      .from('assignments')
      .select('id, subject_id, title, trimestre, parcial, category_id, created_at')
      .in('subject_id', subjectIds)
      .limit(50000)
    assignments = aData || []

    if (assignments.length > 0) {
      const { data: gData } = await admin
        .from('grades')
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignments.map((a: any) => a.id))
        .limit(50000)
      grades = gData || []
    }
  }

  // Attendance data for annual report
  let attendance: any[] = []
  if (subjectIds.length > 0) {
    const { data: attData } = await admin
      .from('attendance')
      .select('student_id, subject_id, status, date')
      .in('subject_id', subjectIds)
    attendance = attData || []
  }

  // Behavior data for annual report
  let behaviors: any[] = []
  if (subjectIds.length > 0) {
    const { data: behData } = await admin
      .from('behaviors')
      .select('student_id, subject_id, type, description, created_at')
      .in('subject_id', subjectIds)
    behaviors = behData || []
  }

  // Check visibility for parents/students
  const isFamilyRole = profile.role === 'student' || isParentMode
  if (isFamilyRole && !libretasPublished) {
    return (
      <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
        <div className="print:hidden">
          <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Libretas de Calificaciones</h1>
          <p className="text-ink3 text-sm mt-1">
            Las libretas de calificaciones aún no han sido publicadas por la institución.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-ink">Calificaciones no disponibles</h2>
          <p className="text-ink3 mt-2 max-w-sm">
            La secretaría académica publicará las calificaciones cuando estén listas. Por favor, vuelve a revisar más adelante.
          </p>
        </div>
      </div>
    )
  }

  // For students, filter to their own data
  const isStudent = profile.role === 'student'
  const isParent = isParentMode
  const filteredEnrollments = isStudent
    ? (enrollments || []).filter((e: any) => e.student_id === user.id)
    : isParent
    ? (enrollments || []).filter((e: any) => e.student_id === linkedStudentId)
    : (enrollments || []).filter((e: any) => courseIds.includes(e.course_id))


  const filteredGrades = isStudent
    ? grades.filter((g: any) => g.student_id === user.id)
    : isParent
    ? grades.filter((g: any) => g.student_id === linkedStudentId)
    : grades

  const filteredAttendance = isStudent
    ? attendance.filter((a: any) => a.student_id === user.id)
    : isParent
    ? attendance.filter((a: any) => a.student_id === linkedStudentId)
    : attendance

  const filteredBehaviors = isStudent
    ? behaviors.filter((b: any) => b.student_id === user.id)
    : isParent
    ? behaviors.filter((b: any) => b.student_id === linkedStudentId)
    : behaviors

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Libretas de Calificaciones</h1>
        <p className="text-ink3 text-sm mt-1">Generacion e impresion de record academico automatizado.</p>
      </div>

      {isParentMode && linkedStudentId && (
        <ChildScopeSelector
          childrenOptions={linkedChildren}
          selectedChildId={linkedStudentId}
          title="Libreta por estudiante"
          description="Cambia el hijo para generar e imprimir su libreta sin mezclar datos de otros estudiantes."
        />
      )}

      <LibretasClient
        role={isParentMode ? 'parent' : profile.role}
        institutionName={profile.institutions?.name}
        courses={filteredCourses}
        enrollments={filteredEnrollments}
        subjects={instSubjects}
        assignments={assignments}
        grades={filteredGrades}
        categories={categories || []}
        currentUserId={linkedStudentId || user.id}
        parcialesCount={(scheduleConfig as any)?.parciales_count || 2}
        tutores={tutores}
        attendance={filteredAttendance}
        behaviors={filteredBehaviors}
        libretasPublished={libretasPublished}
        institutionId={instId}
      />
    </div>
  )
}

