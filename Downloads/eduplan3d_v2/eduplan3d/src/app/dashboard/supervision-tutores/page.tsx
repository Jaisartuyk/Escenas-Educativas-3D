import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SupervisionTutoresClient } from '@/components/supervision/SupervisionTutoresClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function SupervisionTutoresPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(id, name, settings)')
    .eq('id', user.id)
    .single()

  // Only admin/assistant/supervisor can access
  if (!profile || !['admin', 'assistant', 'supervisor', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id
  if (!instId) redirect('/dashboard')

  // ── Fetch all institutional data in parallel ─────────────────────────────
  const [
    { data: teachers },
    { data: courses },
    { data: subjects },
    { data: enrollments },
    { data: categories },
    { data: scheduleConfig },
    { data: attendance },
    { data: assignments },
    { data: grades },
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('institution_id', instId).eq('role', 'teacher'),
    admin.from('courses').select('*').eq('institution_id', instId),
    admin.from('subjects' as any).select('*, course:courses(id, name, parallel, level, shift), teacher:profiles(id, full_name)').eq('institution_id', instId),
    admin.from('enrollments' as any).select('*, student:profiles(id, full_name, email)'),
    admin.from('grade_categories' as any).select('*').eq('institution_id', instId).order('sort_order'),
    admin.from('schedule_configs' as any).select('parciales_count, tutores').eq('institution_id', instId).maybeSingle(),
    admin.from('attendance' as any).select('*').eq('institution_id', instId),
    admin.from('assignments' as any).select('*').eq('is_draft', false),
    admin.from('grades' as any).select('*')
  ])

  // Filter relevant data by institution courses
  const courseIds = (courses || []).map((c: any) => c.id)
  const instSubjects = (subjects || []).filter((s: any) => courseIds.includes(s.course_id))
  const subjectIds = instSubjects.map((s: any) => s.id)
  
  const instEnrollments = (enrollments || []).filter((e: any) => courseIds.includes(e.course_id))
  
  // Filter assignments/grades/attendance by subjects belonging to this institution
  const instAssignments = (assignments || []).filter((a: any) => subjectIds.includes(a.subject_id))
  const instAssignmentIds = instAssignments.map((a: any) => a.id)
  
  const instGrades = (grades || []).filter((g: any) => instAssignmentIds.includes(g.assignment_id))
  const instAttendance = (attendance || []).filter((att: any) => subjectIds.includes(att.subject_id))

  // Extraer tutores de la configuración
  const tutoresMapping = (scheduleConfig as any)?.tutores || {}

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
          Supervisión de Tutores
        </h1>
        <p className="text-ink3 text-sm mt-1">
          Monitorea el desempeño académico y gestión de cada curso a través de sus tutores.
        </p>
      </div>

      <SupervisionTutoresClient
        teachers={teachers || []}
        courses={courses || []}
        subjects={instSubjects}
        enrollments={instEnrollments}
        assignments={instAssignments}
        grades={instGrades}
        categories={categories || []}
        attendance={instAttendance}
        parcialesCount={(scheduleConfig as any)?.parciales_count || 2}
        tutoresMapping={tutoresMapping}
        role={profile.role}
        institutionSettings={profile.institutions?.settings || {}}
      />
    </div>
  )
}
