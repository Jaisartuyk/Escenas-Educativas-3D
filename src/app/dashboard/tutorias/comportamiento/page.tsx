import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ComportamientoTutorClient } from '@/components/tutorias/ComportamientoTutorClient'
import { resolveTutoredCoursesForTeacher } from '@/lib/mensajes/access'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function ComportamientoTutorPage({
  searchParams,
}: {
  searchParams?: Promise<{ course_id?: string }> | { course_id?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(id, name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'teacher', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id
  if (!instId) {
    return <div className="p-8 text-center text-ink3">No tienes una institución asignada.</div>
  }

  const resolvedParams = await Promise.resolve(searchParams || {})
  const isTeacher = profile.role === 'teacher'
  const isTutorOnly = isTeacher

  // Obtener cursos
  let courses: { id: string; name: string }[] = []
  if (isTeacher) {
    const tutoredCourses = await resolveTutoredCoursesForTeacher(admin as any, user.id)
    courses = tutoredCourses.map((c: any) => ({ id: c.id, name: c.name }))
  } else {
    const { data: allCourses } = await admin
      .from('courses')
      .select('id, name')
      .eq('institution_id', instId)
      .order('name')
    courses = allCourses || []
  }

  if (courses.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-bold text-ink">Sin cursos asignados</h2>
        <p className="text-sm text-ink3 mt-2">
          {isTeacher
            ? 'No eres tutor de ningún curso en esta institución. Si consideras que es un error, contacta a la administración.'
            : 'No hay cursos registrados en la institución.'}
        </p>
      </div>
    )
  }

  const activeCourseId = resolvedParams.course_id && courses.some(c => c.id === resolvedParams.course_id)
    ? resolvedParams.course_id
    : courses[0].id

  const courseIds = courses.map(c => c.id)

  // Obtener estudiantes de los cursos tutoreados
  const enrollments = await fetchAllRows(async (from, to) => {
    const { data } = await admin
      .from('enrollments')
      .select('course_id, student:profiles(id, full_name, cedula, status)')
      .in('course_id', courseIds)
      .range(from, to)
    return data
  })

  const studentsByCourse: Record<string, { id: string; full_name: string; cedula?: string }[]> = {}
  for (const c of courses) {
    studentsByCourse[c.id] = []
  }

  for (const en of (enrollments || [])) {
    const st = (en as any).student
    if (st && (!st.status || st.status === 'active')) {
      if (!studentsByCourse[en.course_id]) {
        studentsByCourse[en.course_id] = []
      }
      studentsByCourse[en.course_id].push({
        id: st.id,
        full_name: st.full_name || 'Estudiante',
        cedula: st.cedula || undefined,
      })
    }
  }

  // Ordenar alfabéticamente
  for (const cid of Object.keys(studentsByCourse)) {
    studentsByCourse[cid].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }

  // Obtener notas de comportamiento existentes
  let existingNotes: any[] = []
  try {
    const { data: notesData, error: notesError } = await admin
      .from('libreta_tutor_notes' as any)
      .select('id, student_id, trimestre, behavior_grade, observation')
      .eq('institution_id', instId)
      .in('course_id', courseIds)

    if (!notesError && notesData) {
      existingNotes = notesData
    }
  } catch (e) {
    console.warn('Error reading libreta_tutor_notes:', e)
  }

  const settings = (profile as any).institutions?.settings || {}
  const libretasPublished = settings.libretas_published === true

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-ink">
          Calificación de Comportamiento y Observaciones
        </h1>
        <p className="text-ink3 text-sm mt-1">
          Espacio para que el tutor registre la nota cualitativa de comportamiento y las observaciones individuales para la libreta escolar.
        </p>
      </div>

      <ComportamientoTutorClient
        courses={courses}
        initialCourseId={activeCourseId}
        studentsByCourse={studentsByCourse}
        existingNotes={existingNotes}
        libretasPublished={libretasPublished}
        isTutorOnly={isTutorOnly}
      />
    </div>
  )
}
