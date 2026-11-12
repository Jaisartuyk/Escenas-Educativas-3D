import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AsistenciasClient } from '@/components/asistencias/AsistenciasClient'
import { resolveTutoredCoursesForTeacher } from '@/lib/mensajes/access'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

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

  if (profile?.role !== 'teacher' && profile?.role !== 'admin' && profile?.role !== 'rector' && profile?.role !== 'secretary' && profile?.role !== 'supervisor') {
    redirect('/dashboard') // Redirigir si no tiene permisos
  }

  const instId = profile.institution_id

  let tutoredCourses: any[] = []
  let enrollmentsRes: any[] = []
  let attendanceGlobal: any[] = []
  let justifications: any[] = []

  if (instId) {
    if (profile?.role === 'teacher') {
      tutoredCourses = await resolveTutoredCoursesForTeacher(admin as any, user.id)
    } else {
      const { data: allCourses } = await admin
        .from('courses')
        .select('id, name, parallel, shift')
        .eq('institution_id', instId)
        .order('name', { ascending: true })
      tutoredCourses = allCourses || []
    }

    const tutoredCourseIds = tutoredCourses.map(c => c.id)

    const chunkArray = <T,>(arr: T[], size: number): T[][] =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

    if (tutoredCourseIds.length > 0) {
      const courseChunks = chunkArray(tutoredCourseIds, 50)
      for (const cChunk of courseChunks) {
        const { data: eData } = await admin
          .from('enrollments')
          .select('*, student:profiles(id, full_name, email)')
          .in('course_id', cChunk)
        if (eData) enrollmentsRes.push(...eData)
      }

      const studentIds = Array.from(new Set(enrollmentsRes.map(e => e.student_id).filter(Boolean)))
      if (studentIds.length > 0) {
        const studentChunks = chunkArray(studentIds, 50)

        // Traer todas las asistencias chunked por student_id sin límites ni truncamiento
        for (const sChunk of studentChunks) {
          const attChunk = await fetchAllRows(async (from, to) => {
            const { data } = await admin
              .from('attendance')
              .select('id, student_id, status, date, justification_status, justification_text')
              .in('student_id', sChunk)
              .order('date', { ascending: false })
              .range(from, to)
            return data
          })
          if (attChunk) attendanceGlobal.push(...attChunk)
        }

        // Traer justificaciones de los estudiantes tutorados (con nombre + materia)
        let rawJustifications: any[] = []
        for (const sChunk of studentChunks) {
          const justChunk = await fetchAllRows(async (from, to) => {
            const { data } = await admin
              .from('attendance')
              .select('id, student_id, subject_id, status, date, justification_status, justification_text, justification_file_url')
              .in('student_id', sChunk)
              .not('justification_status', 'is', null)
              .order('date', { ascending: false })
              .range(from, to)
            return data
          })
          if (justChunk) rawJustifications.push(...justChunk)
        }

        // Enriquecer con nombre del estudiante + nombre de la materia
        const subjIds = Array.from(new Set(rawJustifications.map((j: any) => j.subject_id).filter(Boolean)))
        let subjMap = new Map<string, string>()
        if (subjIds.length > 0) {
          const subjChunks = chunkArray(subjIds, 50)
          for (const sjChunk of subjChunks) {
            const { data: subj } = await admin
              .from('subjects')
              .select('id, name')
              .in('id', sjChunk)
            for (const s of subj || []) {
              subjMap.set(s.id as string, (s.name as string) || '')
            }
          }
        }
        const studMap = new Map<string, string>(
          enrollmentsRes.map((e: any) => [e.student_id, e.student?.full_name || 'Alumno'])
        )
        justifications = rawJustifications.map((j: any) => ({
          ...j,
          student_name: studMap.get(j.student_id) || 'Alumno',
          subject_name: subjMap.get(j.subject_id) || 'Materia',
        }))
      }
    }
  }

  return <AsistenciasClient
    tutoredCourses={tutoredCourses}
    enrollments={enrollmentsRes}
    attendanceGlobal={attendanceGlobal}
    justifications={justifications}
  />
}
