import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { EntregasClient } from '@/components/docente/EntregasClient'
import { filterSubjectsForInstitution } from '@/lib/subject-visibility'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

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

  if (!profile || !['admin', 'assistant', 'teacher', 'supervisor', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Materias (Subjects)
  let mySubjects: any[] = []
  if (['admin', 'assistant', 'supervisor'].includes(profile.role)) {
    // Admin/Supervisor sees all subjects in the institution.
    // Use !inner so the course filter actually restricts parent rows
    // (sin !inner, PostgREST solo nullifica el join y puede dejar subjects huérfanas).
    const { data, error } = await admin
      .from('subjects')
      .select('*, course:courses!inner(id, name, parallel, level, shift, institution_id)')
      .eq('course.institution_id', profile.institution_id)
      .order('name', { ascending: true })
    if (error) console.error('[entregas] subjects query error:', error)
    mySubjects = data || []
  } else {
    // Teacher sees their assigned subjects
    const { data } = await admin
      .from('subjects')
      .select('*, course:courses(id, name, parallel, level, shift)')
      .eq('teacher_id', user.id)
      .order('name', { ascending: true })
    mySubjects = data || []
  }

  const visibleSubjects = filterSubjectsForInstitution((profile as any)?.institutions?.name, mySubjects || [])
  const subjectIds = visibleSubjects.map((s: any) => s.id)

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
  
  const chunkArray = <T,>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size))

  if (assignmentIds.length > 0) {
    const assignmentChunks = chunkArray(assignmentIds, 50)
    
    for (const chunk of assignmentChunks) {
      const { data, error } = await admin
        .from('assignment_submissions')
        .select('*, student:profiles(id, full_name, email)')
        .in('assignment_id', chunk)
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('[entregas] submissions embed failed, trying fallback:', error.message)
        const { data: subs, error: err2 } = await admin
          .from('assignment_submissions')
          .select('*')
          .in('assignment_id', chunk)
          .order('submitted_at', { ascending: false })
        if (err2) {
          console.error('[entregas] submissions fallback error:', err2)
        } else if (subs && subs.length > 0) {
          const studentIds = Array.from(new Set(subs.map((s: any) => s.student_id).filter(Boolean)))
          const { data: students } = await admin
            .from('profiles')
            .select('id, full_name, email')
            .in('id', studentIds)
          const byId = new Map((students || []).map((p: any) => [p.id, p]))
          submissions.push(...subs.map((s: any) => ({ ...s, student: byId.get(s.student_id) || null })))
        }
      } else if (data) {
        submissions.push(...data)
      }
    }
  }
  
  // Grades (Calificaciones)
  let grades: any[] = []
  if (assignmentIds.length > 0) {
    const assignmentChunks = chunkArray(assignmentIds, 50)
    for (const chunk of assignmentChunks) {
      const chunkGrades = await fetchAllRows(async (from, to) => {
        const { data } = await admin
          .from('grades')
          .select('*')
          .in('assignment_id', chunk)
          .range(from, to)
        return data
      })
      grades.push(...chunkGrades)
    }
  }

  return (
    <EntregasClient
      profile={profile}
      subjects={visibleSubjects}
      assignments={assignments}
      submissions={submissions}
      grades={grades}
    />
  )
}
