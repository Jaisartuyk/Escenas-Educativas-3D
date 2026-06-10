import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { RendimientoClient } from '@/components/tutorias/RendimientoClient'
import { resolveTutoredCoursesForTeacher } from '@/lib/mensajes/access'
import { filterSubjectsForInstitution } from '@/lib/subject-visibility'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function RendimientoTutorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Get user profile
  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(id, name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'assistant', 'teacher', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id
  if (!instId) {
    return <div className="p-8 text-center text-ink3">No tienes una institución asignada.</div>
  }

  // Fetch all basic active data for the institution
  const [
    tutoredCourses,
    { data: allSubjects },
    { data: enrollments },
    { data: categories }
  ] = await Promise.all([
    resolveTutoredCoursesForTeacher(admin as any, user.id),
    admin.from('subjects').select('id, course_id, name'),
    admin.from('enrollments').select('*, student:profiles(id, full_name)'),
    admin.from('grade_categories').select('*').eq('institution_id', instId)
  ])

  const tutoredCourseIds = tutoredCourses.map(c => c.id)

  if (tutoredCourseIds.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-surface2 rounded-2xl max-w-2xl mx-auto mt-10">
        <h3 className="text-lg font-bold text-ink mb-2">Sin Cursos a Cargo</h3>
        <p className="text-ink3 text-sm">No figuras como tutor de ningún curso en este momento. Comunícate con Administración si esto es un error.</p>
      </div>
    )
  }

  // Find specific enrollments and subjects
  const relatedEnrollments = (enrollments || []).filter(e => tutoredCourseIds.includes(e.course_id))
  const relatedStudentIds = Array.from(new Set(relatedEnrollments.map(e => e.student_id)))
  const rawRelatedSubjects = (allSubjects || []).filter(s => tutoredCourseIds.includes(s.course_id))
  const relatedSubjects = filterSubjectsForInstitution(profile?.institutions?.name, rawRelatedSubjects)
  const relatedSubjectIds = relatedSubjects.map(s => s.id)

  // Fetch assignments & grades
  let assignments: any[] = []
  let grades: any[] = []

  if (relatedSubjectIds.length > 0) {
    const { data: aData } = await admin
      .from('assignments')
      .select('id, subject_id, title, trimestre, parcial, category_id, is_draft')
      .in('subject_id', relatedSubjectIds)
      .eq('is_draft', false) // Sólo tareas publicadas

    assignments = aData || []

    if (assignments.length > 0) {
      const { data: gData } = await admin
        .from('grades')
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignments.map(a => a.id))
      grades = gData || []
    }
  }

  // Extraer información del Schedule Config para los parciales actuales
  const { data: scheduleConfig } = await admin.from('schedule_configs' as any).select('parciales_count, tutores').eq('institution_id', instId).maybeSingle()
  const parcialesCount = scheduleConfig?.parciales_count || 2

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto space-y-6 pt-4 pb-24">
      <div className="px-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Rendimiento Acad&eacute;mico</h1>
        <p className="text-ink3 text-sm mt-1">
          Supervisa las calificaciones de tus cursos en una matriz de calor. Identifica rápidamente estudiantes en riesgo.
        </p>
      </div>

      <RendimientoClient
        courses={tutoredCourses}
        enrollments={relatedEnrollments}
        subjects={relatedSubjects}
        assignments={assignments}
        grades={grades}
        categories={categories || []}
        parcialesCount={parcialesCount}
      />
    </div>
  )
}
