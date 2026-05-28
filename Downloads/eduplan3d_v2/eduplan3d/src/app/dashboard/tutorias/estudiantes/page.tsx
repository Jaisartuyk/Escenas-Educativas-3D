import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DirectorioTutorClient } from '@/components/tutorias/DirectorioTutorClient'
import { resolveTutoredCoursesForTeacher } from '@/lib/mensajes/access'

export const dynamic = 'force-dynamic'

export default async function EstudiantesTutorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Validar rol
  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(id, settings)')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher' && profile?.role !== 'admin' && profile?.role !== 'rector') {
    redirect('/dashboard')
  }

  const instId = profile.institution_id
  if (!instId) {
    return <div className="p-8 text-center text-ink3">No tienes una instituci&oacute;n asignada.</div>
  }

  const tutoredCourses = await resolveTutoredCoursesForTeacher(admin as any, user.id)

  const tutoredCourseIds = tutoredCourses.map(c => c.id)

  let enrollmentsRes: any[] = []

  if (tutoredCourseIds.length > 0) {
    // Join perfiles de estudiantes
    const { data: eData } = await admin
      .from('enrollments')
      .select('*, student:profiles(*)')
      .in('course_id', tutoredCourseIds)
    enrollmentsRes = eData || []
  }

  // Injectar metadata rica desde la institución (directorio admin)
  const settings = profile.institutions?.settings || {}
  const masterDirectoryData = settings.directory || {}

  const mergedStudents = enrollmentsRes.map(en => {
    const stId = en.student?.id || ''
    const extraData = masterDirectoryData[stId] || {}
    return {
      courseId: en.course_id,
      id: stId,
      full_name: en.student?.full_name || 'Desconocido',
      email: en.student?.email || '',
      avatar_url: extraData.avatar_url || en.student?.avatar_url || null,
      ...extraData // Expands mother_name, representative, phone, dni, etc.
    }
  })

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto space-y-6 pt-4 pb-24">
      <div className="px-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Estudiantes</h1>
        <p className="text-ink3 text-sm mt-1">
          Directorio completo de tus alumnos asesorados. Visualiza sus fichas, estado de emergencia y datos de representantes.
        </p>
      </div>

      <DirectorioTutorClient 
        courses={tutoredCourses}
        students={mergedStudents}
      />
    </div>
  )
}
