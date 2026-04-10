import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DocenteClient } from '@/components/docente/DocenteClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function DocentePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'teacher'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id

  // ── Materias asignadas a este docente ────────────────────────────────────
  const { data: mySubjects } = await admin
    .from('subjects' as any)
    .select('*, course:courses(id, name, parallel, level, shift)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  const courseIds  = (mySubjects  || []).map((s: any) => s.course?.id).filter(Boolean)
  const subjectIds = (mySubjects  || []).map((s: any) => s.id)

  // ── Matrículas: course_id → student_id ──────────────────────────────────
  let enrollments: any[] = []      // [{ course_id, student_id }]
  let studentProfiles: any[] = []  // [{ id, full_name, email, avatar_url }]

  if (courseIds.length > 0) {
    const { data: rawEnr } = await admin
      .from('enrollments')
      .select('course_id, student_id')
      .in('course_id', courseIds)

    enrollments = rawEnr || []

    const studentIds = Array.from(new Set(enrollments.map((e: any) => e.student_id as string)))
    console.log('[docente/page] enrollment count:', enrollments.length, 'studentIds:', studentIds)

    if (studentIds.length > 0) {
      const { data: profs, error: profsError } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', studentIds)
      console.log('[docente/page] profiles fetched:', profs?.length, 'error:', profsError?.message)
      studentProfiles = profs || []
    }
  }

  // Merge profiles into enrollments server-side to avoid client join issues
  const profilesById: Record<string, any> = {}
  studentProfiles.forEach((p: any) => { profilesById[p.id] = p })
  const mergedEnrollments = enrollments.map((e: any) => ({
    course_id:  e.course_id,
    student_id: e.student_id,
    student:    profilesById[e.student_id] ?? null,
  }))

  // ── Tareas de las materias del docente (con parcial/trimestre) ───────────
  let assignments: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('assignments')
      .select('id, subject_id, title, description, due_date, trimestre, parcial, created_at, updated_at')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    assignments = data || []
  }

  // ── Calificaciones de esas tareas ────────────────────────────────────────
  let grades: any[] = []
  const assignmentIds = assignments.map((a: any) => a.id)
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('grades')
      .select('*')
      .in('assignment_id', assignmentIds)
    grades = data || []
  }

  // ── Config de horario (períodos, recesos) ────────────────────────────────
  let scheduleConfig: any = null
  if (instId) {
    const { data } = await admin
      .from('schedule_configs' as any)
      .select('*')
      .eq('institution_id', instId)
      .maybeSingle()
    scheduleConfig = data
  }

  return (
    <DocenteClient
      profile={profile}
      mySubjects={mySubjects || []}
      enrollments={mergedEnrollments}
      initialAssignments={assignments}
      initialGrades={grades}
      teacherId={user.id}
    />
  )
}
