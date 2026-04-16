import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { EntregasClient } from '@/components/docente/EntregasClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function EntregasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'assistant', 'teacher'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Materias (Subjects)
  let mySubjects: any[] = []
  if (['admin', 'assistant'].includes(profile.role)) {
    // Admin sees all subjects in the institution
    const { data } = await admin
      .from('subjects')
      .select('*, course:courses(id, name, parallel, level, shift)')
      .eq('course.institution_id', profile.institution_id)
      .order('name', { ascending: true })
    if (data) {
      mySubjects = data.filter((s:any) => s.course) // Only subjects linked to institution courses
    }
  } else {
    // Teacher sees their assigned subjects
    const { data } = await admin
      .from('subjects')
      .select('*, course:courses(id, name, parallel, level, shift)')
      .eq('teacher_id', user.id)
      .order('name', { ascending: true })
    mySubjects = data || []
  }

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
    <EntregasClient
      profile={profile}
      subjects={mySubjects}
      assignments={assignments}
      submissions={submissions}
      grades={grades}
    />
  )
}
