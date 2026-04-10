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

  // ── Alumnos matriculados en esos cursos ─────────────────────────────────
  // Dos queries separadas (más fiable que el join de Supabase con admin client)
  let enrollments: any[] = []
  if (courseIds.length > 0) {
    const { data: rawEnrollments } = await admin
      .from('enrollments')
      .select('course_id, student_id')
      .in('course_id', courseIds)

    const studentIds = Array.from(new Set((rawEnrollments || []).map((e: any) => e.student_id as string)))

    let studentsMap: Record<string, any> = {}
    if (studentIds.length > 0) {
      const { data: studentProfiles } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', studentIds)
      ;(studentProfiles || []).forEach((p: any) => { studentsMap[p.id] = p })
    }

    enrollments = (rawEnrollments || []).map((e: any) => ({
      course_id: e.course_id,
      student:   studentsMap[e.student_id] || null,
    })).filter((e: any) => e.student !== null)
  }

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
      enrollments={enrollments}
      initialAssignments={assignments}
      initialGrades={grades}
      scheduleConfig={scheduleConfig}
      teacherId={user.id}
    />
  )
}
