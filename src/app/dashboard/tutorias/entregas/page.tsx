import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { EntregasClient } from '@/components/docente/EntregasClient'
import { resolveTutoredCoursesForTeacher } from '@/lib/mensajes/access'
import { filterSubjectsForInstitution } from '@/lib/subject-visibility'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function TutoriasEntregasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'assistant', 'teacher', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id
  if (!instId) {
    return <div className="p-8 text-center text-ink3">No tienes una institución asignada.</div>
  }

  const tutoredCourses = await resolveTutoredCoursesForTeacher(admin as any, user.id)
  const tutoredCourseIds = tutoredCourses.map(c => c.id)

  if (tutoredCourseIds.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-surface2 rounded-2xl max-w-2xl mx-auto mt-10">
        <h3 className="text-lg font-bold text-ink mb-2">Sin Cursos a Cargo</h3>
        <p className="text-ink3 text-sm">No figuras como tutor de ningún curso en este momento. No hay deberes por supervisar.</p>
      </div>
    )
  }

  // Obtener TODAS las materias de estos cursos tutoreados
  const { data: dbSubjects } = await admin
    .from('subjects')
    .select('*, course:courses(id, name, parallel, level, shift)')
    .in('course_id', tutoredCourseIds)
    .order('name', { ascending: true })
    
  const mySubjects = filterSubjectsForInstitution(profile?.institutions?.name, dbSubjects || [])
  const subjectIds = mySubjects.map((s: any) => s.id)

  // Assignments
  let assignments: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('assignments')
      .select('id, subject_id, title, description, start_date, due_date, due_time, trimestre, parcial, category_id, attachment_urls, created_at, updated_at')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    assignments = data || []
  }

  // Submissions (Entregas)
  let submissions: any[] = []
  const assignmentIds = assignments.map((a: any) => a.id)
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('assignment_submissions')
      .select('*, student:profiles(id, full_name, email)')
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false })
    submissions = data || []
  }
  
  // Grades (Calificaciones)
  let grades: any[] = []
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('grades')
      .select('*')
      .in('assignment_id', assignmentIds)
    grades = data || []
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-ink">Supervisión de Deberes</h1>
        <p className="text-ink3 text-sm">Visualiza todas las entregas para los cursos donde eres tutor.</p>
      </div>
      <EntregasClient
        profile={profile}
        subjects={mySubjects}
        assignments={assignments}
        submissions={submissions}
        grades={grades}
      />
    </>
  )
}
