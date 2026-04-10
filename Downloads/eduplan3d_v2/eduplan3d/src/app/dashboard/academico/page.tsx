import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AcademicoClient } from '@/components/academico/AcademicoClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AcademicoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.institution_id) redirect('/dashboard')

  const admin = createAdminClient()

  // Cargar datos en paralelo
  const [coursesRes, studentsRes, subjectsRes, enrollmentsRes, teachersRes, scheduleRes] =
    await Promise.all([
      admin.from('courses' as any)
        .select('*')
        .eq('institution_id', profile.institution_id)
        .order('name', { ascending: true }),

      admin.from('profiles' as any)
        .select('id, full_name, email, avatar_url, role')
        .eq('institution_id', profile.institution_id)
        .eq('role', 'student')
        .order('full_name', { ascending: true }),

      // Subjects filtrados por institución con teacher y course embebidos
      admin.from('subjects' as any)
        .select('id, name, weekly_hours, course_id, teacher_id, teacher:profiles(full_name), course:courses(name)')
        .eq('institution_id', profile.institution_id)
        .order('name', { ascending: true }),

      admin.from('enrollments' as any)
        .select('course_id, student_id')
        .in('course_id',
          // sub-select de cursos de esta institución se hace filtrando en el cliente
          // (Supabase no soporta sub-selects en .in() via JS client)
          [] // se rellena abajo
        ),

      admin.from('profiles' as any)
        .select('id, full_name, email, avatar_url')
        .eq('institution_id', profile.institution_id)
        .eq('role', 'teacher')
        .order('full_name', { ascending: true }),

      // Config de horarios: tiene los tutores por curso
      admin.from('schedule_configs' as any)
        .select('tutores, jornada, nivel, anio')
        .eq('institution_id', profile.institution_id)
        .single(),
    ])

  // Enrollments: re-query con los IDs de cursos reales
  const courseIds: string[] = (coursesRes.data || []).map((c: any) => c.id)
  const { data: enrollments } = courseIds.length > 0
    ? await admin.from('enrollments' as any).select('course_id, student_id').in('course_id', courseIds)
    : { data: [] }

  const directoryMetadata = profile.institutions?.settings?.directory || {}
  const tutores: Record<string, string> = (scheduleRes.data as any)?.tutores || {}

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Gestión Académica</h1>
        <p className="text-ink3 text-sm mt-1">Crea cursos, asigna materias a docentes y matricula estudiantes.</p>
      </div>

      <AcademicoClient
        initialCourses={coursesRes.data || []}
        initialStudents={studentsRes.data || []}
        initialSubjects={subjectsRes.data || []}
        initialEnrollments={enrollments || []}
        teachers={teachersRes.data || []}
        horariosDocentes={profile.institutions?.settings?.horarios?.docentes || []}
        institutionId={profile.institution_id}
        directoryMetadata={directoryMetadata}
        tutores={tutores}
      />
    </div>
  )
}
