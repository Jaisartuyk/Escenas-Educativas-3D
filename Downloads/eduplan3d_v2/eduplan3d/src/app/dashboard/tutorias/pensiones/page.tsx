import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SecretariaClient } from '@/components/secretaria/SecretariaClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function TutoriasPensionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'assistant', 'teacher', 'rector'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const instId = profile.institution_id
  if (!instId) {
    return <div className="p-8 text-center text-ink3">No tienes una institución asignada.</div>
  }

  const teacherName = (profile.full_name || '').trim().toLowerCase()

  // Buscar los cursos tutoreados
  const { data: inst } = await admin.from('institutions').select('settings').eq('id', instId).single()
  const settings = inst?.settings || {}
  const tutoredCourseNames: string[] = []

  Object.keys(settings).forEach(key => {
    if (key.startsWith('horarios')) {
      const config = settings[key]?.config
      if (config && config.tutores) {
        Object.entries(config.tutores).forEach(([cursoName, tutorName]) => {
          if (typeof tutorName === 'string' && tutorName.trim().toLowerCase() === teacherName) {
            tutoredCourseNames.push(cursoName)
          }
        })
      }
    }
  })

  // Mapear nombres a IDs de cursos
  const { data: allCoursesData } = await admin
    .from('courses')
    .select('id, name, parallel, level, shift')
    .eq('institution_id', instId)

  const allCourses = allCoursesData || []
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  
  const tutoredNormalized = tutoredCourseNames.map(normalize)
  const tutoredCourses = allCourses.filter(c => tutoredNormalized.includes(normalize(c.name)))
  const tutoredCourseIds = tutoredCourses.map(c => c.id)

  if (tutoredCourseIds.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-surface2 rounded-2xl max-w-2xl mx-auto mt-10">
        <h3 className="text-lg font-bold text-ink mb-2">Sin Cursos a Cargo</h3>
        <p className="text-ink3 text-sm">No figuras como tutor de ningún curso en este momento. No hay cobros que visualizar.</p>
      </div>
    )
  }

  // Filtrar matrículas solo de alumnos de esos cursos
  const { data: enrollmentsData } = await admin
    .from('enrollments')
    .select('course_id, student_id')
    .in('course_id', tutoredCourseIds)
    
  const enrollments = enrollmentsData || []
  const studentIds = enrollments.map(e => e.student_id)

  if (studentIds.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-surface2 rounded-2xl max-w-2xl mx-auto mt-10">
        <h3 className="text-lg font-bold text-ink mb-2">Alumnos No Registrados</h3>
        <p className="text-ink3 text-sm">Hay un curso a tu cargo, pero no hay alumnos inscritos en este. No hay cobros que visualizar.</p>
      </div>
    )
  }

  // Cargar estudiantes y pagos de esos estudiantes exclusivamente
  const [studentsRes, paymentsRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('institution_id', instId).eq('role', 'student').in('id', studentIds).order('full_name'),
    admin.from('payments' as any).select('*').eq('institution_id', instId).in('student_id', studentIds).order('created_at', { ascending: false }),
  ])

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6 pt-4 pb-24">
      <div className="px-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Supervisi&oacute;n de Pensiones</h1>
        <p className="text-ink3 text-sm mt-1">Monitorea el estado financiero y los cobros de tus estudiantes al mando.</p>
      </div>
      <SecretariaClient
        institutionId={instId}
        students={studentsRes.data || []}
        courses={tutoredCourses}
        enrollments={enrollments}
        initialPayments={paymentsRes.data || []}
        isTutorMode={true}
      />
    </div>
  )
}
