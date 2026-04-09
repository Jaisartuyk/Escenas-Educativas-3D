import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AcademicoClient } from '@/components/academico/AcademicoClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AcademicoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.institution_id) {
    redirect('/dashboard') // Redirigir si no tiene institución
  }

  // Pre-cargar datos para el cliente
  const [coursesRes, studentsRes, subjectsRes] = await Promise.all([
    // get courses
    (supabase as any).from('courses').select('*').eq('institution_id', profile.institution_id).order('name', { ascending: true }),
    // get students of this institution
    (supabase as any).from('profiles').select('*').eq('institution_id', profile.institution_id).eq('role', 'student').order('full_name', { ascending: true }),
    // get subjects with teacher relations
    (supabase as any).from('subjects').select('*, teacher:profiles(full_name, email), course:courses(name)').order('name', { ascending: true }) // Not ideal matching course_id, we'll map later
  ])

  // Need enrollments too
  const { data: enrollments } = await (supabase as any)
    .from('enrollments')
    .select('course_id, student_id')

  // get ALL teachers of this institution for subject assignment
  const { data: teachers } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('institution_id', profile.institution_id)
    .in('role', ['teacher', 'admin'])
    .order('full_name', { ascending: true })

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Gestión Académica</h1>
        <p className="text-ink3 text-sm mt-1">Crea cursos, asigna materias a docentes y matricula estudiantes.</p>
      </div>
      
      <AcademicoClient 
        initialCourses={coursesRes.data || []}
        initialStudents={studentsRes.data || []}
        initialSubjects={subjectsRes.data || []}
        initialEnrollments={enrollments || []}
        teachers={teachers || []}
        horariosDocentes={profile.institutions?.settings?.horarios?.docentes || []}
        institutionId={profile.institution_id}
      />
    </div>
  )
}
