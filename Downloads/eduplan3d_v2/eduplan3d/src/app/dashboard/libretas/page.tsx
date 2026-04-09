import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LibretasClient } from '@/components/libretas/LibretasClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function LibretasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*, institutions(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')

  // Obtener toda la data institucional
  let coursesData: any[] = []
  let studentsData: any[] = []
  let enrollsData: any[] = []
  let subjectsData: any[] = []
  let gradesData: any[] = []
  let assignmentsData: any[] = []

  if (profile.role === 'admin' || profile.role === 'teacher') {
    // Para roles administrativos se obtiene la vista global de la institución
    const [courses, students, enrollments, subjects] = await Promise.all([
      (supabase as any).from('courses').select('*').eq('institution_id', profile.institution_id),
      (supabase as any).from('profiles').select('id, full_name, email').eq('institution_id', profile.institution_id).eq('role', 'student'),
      (supabase as any).from('enrollments').select('*'),
      (supabase as any).from('subjects').select('*')
    ])
    coursesData = courses.data || []
    studentsData = students.data || []
    enrollsData = enrollments.data || []
    subjectsData = subjects.data || []

    const { data: globalAssignments } = await (supabase as any).from('assignments').select('*')
    assignmentsData = globalAssignments || []
    
    if (assignmentsData.length > 0) {
      const { data: globalGrades } = await (supabase as any).from('grades').select('*').in('assignment_id', assignmentsData.map((a:any) => a.id))
      gradesData = globalGrades || []
    }
  } else if (profile.role === 'student') {
    // Para estudiantes se obtiene solo su propia data
    coursesData = []
    studentsData = [profile] // Solo a sí mismo
    const { data: myEnrolls } = await (supabase as any).from('enrollments').select('course_id').eq('student_id', user.id)
    
    const courseIds = (myEnrolls || []).map((e:any) => e.course_id)
    if (courseIds.length > 0) {
      const { data: crs } = await (supabase as any).from('courses').select('*').in('id', courseIds)
      coursesData = crs || []
      
      const { data: sbs } = await (supabase as any).from('subjects').select('*').in('course_id', courseIds)
      subjectsData = sbs || []
      
      if (subjectsData.length > 0) {
         const { data: asgs } = await (supabase as any).from('assignments').select('*').in('subject_id', subjectsData.map((s:any) => s.id))
         assignmentsData = asgs || []
         
         if (assignmentsData.length > 0) {
           const { data: grs } = await (supabase as any).from('grades').select('*').in('assignment_id', assignmentsData.map((a:any)=>a.id)).eq('student_id', user.id)
           gradesData = grs || []
         }
      }
    }
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-bold tracking-tight">Libretas de Calificaciones</h1>
        <p className="text-ink3 text-sm mt-1">Generación e impresión de récord académico automatizado.</p>
      </div>

      <LibretasClient 
        role={profile.role}
        institutionName={profile.institutions?.name}
        courses={coursesData}
        students={studentsData}
        subjects={subjectsData}
        assignments={assignmentsData}
        grades={gradesData}
      />
    </div>
  )
}
