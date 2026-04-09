import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocenteClient } from '@/components/docente/DocenteClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function DocentePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*, institutions(name)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'teacher'].includes(profile.role)) {
    redirect('/dashboard') // Redirigir si no es profe o admin
  }

  // Pre-cargar materias que dicta este profe
  const { data: mySubjects } = await (supabase as any)
    .from('subjects')
    .select('*, course:courses(id, name, parallel)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  // Extraer course_ids para buscar los alumnos enlazados
  const courseIds = (mySubjects || []).map((s: any) => s.course.id)
  
  let studentsInCourses: any[] = []
  if (courseIds.length > 0) {
    const { data: enrolls } = await (supabase as any)
      .from('enrollments')
      .select('course_id, student:profiles(id, full_name, email)')
      .in('course_id', courseIds)
      
    studentsInCourses = enrolls || []
  }

  // Todas las tareas de mis materias
  const subjectIds = (mySubjects || []).map((s: any) => s.id)
  let assignments: any[] = []
  let grades: any[] = []
  if (subjectIds.length > 0) {
    const { data: asgs } = await (supabase as any)
      .from('assignments')
      .select('*')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    assignments = asgs || []

    const asgsIds = assignments.map(a => a.id)
    if (asgsIds.length > 0) {
      const { data: grs } = await (supabase as any)
        .from('grades')
        .select('*')
        .in('assignment_id', asgsIds)
      grades = grs || []
    }
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Panel Docente</h1>
        <p className="text-ink3 text-sm mt-1">Sube tareas a tus cursos y califica las entregas de los estudiantes.</p>
      </div>
      
      <DocenteClient 
        initialSubjects={mySubjects || []}
        enrollments={studentsInCourses}
        initialAssignments={assignments}
        initialGrades={grades}
        teacherId={user.id}
      />
    </div>
  )
}
