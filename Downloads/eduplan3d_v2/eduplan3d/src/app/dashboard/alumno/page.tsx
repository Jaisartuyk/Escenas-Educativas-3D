import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlumnoClient } from '@/components/alumno/AlumnoClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AlumnoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') {
    redirect('/dashboard') // Redirigir si no es estudiante
  }

  // 1. Obtener cursos en los que el estudiante está enrollado
  const { data: enrolls } = await (supabase as any)
    .from('enrollments')
    .select('course:courses(id, name, parallel)')
    .eq('student_id', user.id)

  const myCourses = (enrolls || []).map((e: any) => e.course)
  const courseIds = myCourses.map((c: any) => c.id)

  let subjects: any[] = []
  let assignments: any[] = []
  let grades: any[] = []

  if (courseIds.length > 0) {
    // 2. Obtener materias de esos cursos
    const { data: subs } = await (supabase as any)
      .from('subjects')
      .select('*, teacher:profiles(full_name)')
      .in('course_id', courseIds)
    subjects = subs || []

    const subjectIds = subjects.map((s:any) => s.id)
    if (subjectIds.length > 0) {
      // 3. Obtener todas las tareas de esas materias
      const { data: asgs } = await (supabase as any)
        .from('assignments')
        .select('*')
        .in('subject_id', subjectIds)
        .order('created_at', { ascending: false })
      assignments = asgs || []

      const asgIds = assignments.map((a:any) => a.id)
      if (asgIds.length > 0) {
        // 4. Obtener MIS notas/entregas
        const { data: grs } = await (supabase as any)
          .from('grades')
          .select('*')
          .in('assignment_id', asgIds)
          .eq('student_id', user.id)
        grades = grs || []
      }
    }
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Mis Tareas</h1>
        <p className="text-ink3 text-sm mt-1">Revisa tus actividades pendientes, entrega tus trabajos y consulta tus notas.</p>
      </div>
      
      <AlumnoClient 
        courses={myCourses}
        subjects={subjects}
        assignments={assignments}
        initialGrades={grades}
        studentId={user.id}
      />
    </div>
  )
}
