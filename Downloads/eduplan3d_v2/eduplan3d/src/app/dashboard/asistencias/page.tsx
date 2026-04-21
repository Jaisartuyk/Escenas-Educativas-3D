import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AsistenciasClient } from '@/components/asistencias/AsistenciasClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()
  
  // Validar rol del usuario
  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(settings)')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect('/dashboard') // Redirigir si no tiene permisos
  }

  const instId = profile.institution_id
  const teacherName = (profile.full_name || '').trim().toLowerCase()

  // Buscar los cursos tutoreados
  const settings = profile.institutions?.settings || {}
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

  let tutoredCourses: any[] = []
  let enrollmentsRes: any[] = []
  let attendanceGlobal: any[] = []

  if (instId && tutoredCourseNames.length > 0) {
    const { data: allCourses } = await admin.from('courses').select('id, name, parallel').eq('institution_id', instId)
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    
    const tutoredNormalized = tutoredCourseNames.map(normalize)
    tutoredCourses = (allCourses || []).filter(c => tutoredNormalized.includes(normalize(c.name)) || tutoredNormalized.includes(normalize(`${c.name} ${c.parallel || ''}`)))
    const tutoredCourseIds = tutoredCourses.map(c => c.id)

    if (tutoredCourseIds.length > 0) {
      const { data: eData } = await admin.from('enrollments').select('*, student:profiles(id, full_name, email)').in('course_id', tutoredCourseIds)
      enrollmentsRes = eData || []

      const studentIds = enrollmentsRes.map(e => e.student_id)
      if (studentIds.length > 0) {
        const { data: attData } = await admin.from('attendance').select('student_id, status').in('student_id', studentIds)
        attendanceGlobal = attData || []
      }
    }
  }

  return <AsistenciasClient 
    tutoredCourses={tutoredCourses}
    enrollments={enrollmentsRes}
    attendanceGlobal={attendanceGlobal}
  />
}
