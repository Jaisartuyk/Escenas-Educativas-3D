import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { LibretasClient } from '@/components/libretas/LibretasClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function LibretasPage() {
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

  const instId = profile.institution_id

  // ── Fetch all institutional data ───────────────────────────────────────
  const [
    { data: courses },
    { data: enrollments },
    { data: subjects },
    { data: categories },
    { data: scheduleConfig },
  ] = await Promise.all([
    admin.from('courses').select('*').eq('institution_id', instId),
    admin.from('enrollments').select('*, student:profiles(id, full_name, email)'),
    admin.from('subjects').select('*, course:courses(id, name, parallel)'),
    admin.from('grade_categories').select('*').eq('institution_id', instId).order('sort_order'),
    admin.from('schedule_configs' as any).select('parciales_count').eq('institution_id', instId).maybeSingle(),
  ])

  // Filter subjects by institution courses
  const courseIds = (courses || []).map((c: any) => c.id)
  const instSubjects = (subjects || []).filter((s: any) => courseIds.includes(s.course_id))
  const subjectIds = instSubjects.map((s: any) => s.id)

  // Assignments and grades
  let assignments: any[] = []
  let grades: any[] = []

  if (subjectIds.length > 0) {
    const { data: aData } = await admin
      .from('assignments')
      .select('id, subject_id, title, trimestre, parcial, category_id, created_at')
      .in('subject_id', subjectIds)
    assignments = aData || []

    if (assignments.length > 0) {
      const { data: gData } = await admin
        .from('grades')
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignments.map((a: any) => a.id))
      grades = gData || []
    }
  }

  // For students, filter to their own data
  const isStudent = profile.role === 'student'
  const filteredEnrollments = isStudent
    ? (enrollments || []).filter((e: any) => e.student_id === user.id)
    : (enrollments || []).filter((e: any) => courseIds.includes(e.course_id))

  const filteredGrades = isStudent
    ? grades.filter((g: any) => g.student_id === user.id)
    : grades

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Libretas de Calificaciones</h1>
        <p className="text-ink3 text-sm mt-1">Generación e impresión de récord académico automatizado.</p>
      </div>

      <LibretasClient
        role={profile.role}
        institutionName={profile.institutions?.name}
        courses={courses || []}
        enrollments={filteredEnrollments}
        subjects={instSubjects}
        assignments={assignments}
        grades={filteredGrades}
        categories={categories || []}
        currentUserId={user.id}
        parcialesCount={(scheduleConfig as any)?.parciales_count || 2}
      />
    </div>
  )
}
