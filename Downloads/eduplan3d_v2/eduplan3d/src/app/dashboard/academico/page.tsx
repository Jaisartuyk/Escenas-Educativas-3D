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
  const instId = profile.institution_id

  // ── Paso 1: queries que no dependen de otras ────────────────────────────────
  const [coursesRes, studentsRes, subjectsRes, teachersRes, scheduleRes] =
    await Promise.all([
      admin.from('courses' as any)
        .select('*')
        .eq('institution_id', instId)
        .order('name', { ascending: true }),

      admin.from('profiles' as any)
        .select('id, full_name, email, avatar_url, role')
        .eq('institution_id', instId)
        .eq('role', 'student')
        .order('full_name', { ascending: true }),

      admin.from('subjects' as any)
        .select('id, name, weekly_hours, course_id, teacher_id, teacher:profiles(full_name), course:courses(name)')
        .eq('institution_id', instId)
        .order('name', { ascending: true }),

      admin.from('profiles' as any)
        .select('id, full_name, email, avatar_url')
        .eq('institution_id', instId)
        .eq('role', 'teacher')
        .order('full_name', { ascending: true }),

      // schedule_configs puede no existir aún → usamos maybeSingle para no lanzar error
      admin.from('schedule_configs' as any)
        .select('tutores')
        .eq('institution_id', instId)
        .maybeSingle(),
    ])

  // ── Paso 2: enrollments necesita los IDs de cursos del paso 1 ───────────────
  const courseIds: string[] = (coursesRes.data || []).map((c: any) => c.id)
  const { data: enrollments } = courseIds.length > 0
    ? await admin
        .from('enrollments' as any)
        .select('course_id, student_id')
        .in('course_id', courseIds)
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
        initialCourses={coursesRes.data   || []}
        initialStudents={studentsRes.data  || []}
        initialSubjects={subjectsRes.data  || []}
        initialEnrollments={enrollments    || []}
        teachers={teachersRes.data         || []}
        horariosDocentes={profile.institutions?.settings?.horarios?.docentes || []}
        institutionId={instId}
        directoryMetadata={directoryMetadata}
        tutores={tutores}
      />
    </div>
  )
}
