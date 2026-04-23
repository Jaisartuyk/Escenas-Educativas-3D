import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SupervisionClient } from '@/components/supervision/SupervisionClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function DocenciaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(id, name, settings)')
    .eq('id', user.id)
    .single()

  // Only admin/assistant can access supervision
  if (!profile || !['admin', 'assistant', 'supervisor', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id

  // ── Fetch all institutional data in parallel ─────────────────────────────
  const [
    { data: teachers },
    { data: courses },
    { data: subjects },
    { data: enrollments },
    { data: categories },
    { data: scheduleConfig },
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('institution_id', instId).eq('role', 'teacher'),
    admin.from('courses').select('*').eq('institution_id', instId),
    admin.from('subjects' as any).select('*, course:courses(id, name, parallel, level, shift), teacher:profiles!subjects_teacher_id_fkey(id, full_name)'),
    admin.from('enrollments' as any).select('*, student:profiles(id, full_name, email)'),
    admin.from('grade_categories' as any).select('*').eq('institution_id', instId).order('sort_order'),
    admin.from('schedule_configs' as any).select('parciales_count, tutores').eq('institution_id', instId).maybeSingle(),
  ])

  // Filter subjects to institution courses
  const courseIds = (courses || []).map((c: any) => c.id)
  const instSubjects = (subjects || []).filter((s: any) => courseIds.includes(s.course_id))
  const subjectIds = instSubjects.map((s: any) => s.id)

  // Filter enrollments to institution courses
  const instEnrollments = (enrollments || []).filter((e: any) => courseIds.includes(e.course_id))

  // ── Fetch assignments, grades, attendance, behavior ──────────────────────
  let assignments: any[] = []
  let grades: any[] = []
  let attendance: any[] = []
  let behaviors: any[] = []
  let submissions: any[] = []

  if (subjectIds.length > 0) {
    const [aRes, attRes, behRes] = await Promise.all([
      admin.from('assignments')
        .select('id, subject_id, title, description, trimestre, parcial, category_id, due_date, created_at')
        .in('subject_id', subjectIds)
        .order('created_at', { ascending: false }),
      admin.from('attendance')
        .select('id, student_id, subject_id, status, date, justification_status, justification_text, justification_file_url')
        .in('subject_id', subjectIds),
      admin.from('behavior_records' as any)
        .select('id, student_id, subject_id, type, description, date, created_at')
        .in('subject_id', subjectIds)
        .order('created_at', { ascending: false }),
    ])

    assignments = aRes.data || []
    attendance = attRes.data || []
    behaviors = behRes.data || []

    if (assignments.length > 0) {
      const [gRes, subRes] = await Promise.all([
        admin
          .from('grades')
          .select('assignment_id, student_id, score')
          .in('assignment_id', assignments.map((a: any) => a.id)),
        admin
          .from('assignment_submissions' as any)
          .select('id, assignment_id, student_id, comment, file_url, submitted_at, student:profiles(id, full_name)')
          .in('assignment_id', assignments.map((a: any) => a.id))
      ])
      grades = gRes.data || []
      submissions = subRes.data || []
    }
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
          Supervisión Docente
        </h1>
        <p className="text-ink3 text-sm mt-1">
          Monitorea la actividad académica de cada docente: tareas enviadas, calificaciones, asistencia y comportamiento.
        </p>
      </div>

      <SupervisionClient
        teachers={teachers || []}
        courses={courses || []}
        subjects={instSubjects}
        enrollments={instEnrollments}
        assignments={assignments}
        grades={grades}
        categories={categories || []}
        attendance={attendance}
        behaviors={behaviors}
        parcialesCount={(scheduleConfig as any)?.parciales_count || 2}
        submissions={submissions}
        role={profile.role}
      />
    </div>
  )
}
