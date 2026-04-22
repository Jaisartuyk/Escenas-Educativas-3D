// src/lib/mensajes/access.ts
// Helpers para resolver emparejamientos estudiante↔tutor a partir del JSONB
// institutions.settings.horarios*.config.tutores (mapa "CursoNombre" → "Nombre del tutor").
import type { SupabaseClient } from '@supabase/supabase-js'

export function norm(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Devuelve los nombres normalizados de cursos que `teacherFullName` tutoriza.
 */
export function tutoredCourseNamesFromSettings(settings: any, teacherFullName: string): string[] {
  const teacherN = norm(teacherFullName)
  if (!teacherN || !settings) return []
  const out: string[] = []
  for (const key of Object.keys(settings)) {
    if (!key.startsWith('horarios')) continue
    const tutores = settings[key]?.config?.tutores
    if (!tutores || typeof tutores !== 'object') continue
    for (const [cursoName, tutorName] of Object.entries(tutores)) {
      if (typeof tutorName === 'string' && norm(tutorName) === teacherN) {
        out.push(norm(cursoName))
      }
    }
  }
  return Array.from(new Set(out))
}

/**
 * Devuelve [{teacherId, teacherName, courseId, courseName}] con los tutores del estudiante.
 * Un estudiante puede estar en N cursos; cada curso puede tener tutor asignado (o no).
 */
export async function resolveTutorsForStudent(
  admin: SupabaseClient,
  studentId: string
): Promise<Array<{ teacherId: string; teacherName: string; courseId: string; courseName: string }>> {
  const { data: stu } = await (admin as any)
    .from('profiles')
    .select('institution_id, institutions(settings)')
    .eq('id', studentId)
    .single()
  if (!stu?.institution_id) return []
  const settings = stu.institutions?.settings

  const { data: enr } = await (admin as any)
    .from('enrollments')
    .select('course_id, course:courses(id, name, parallel)')
    .eq('student_id', studentId)
  const courses = ((enr || []) as any[])
    .flatMap(e => (Array.isArray(e.course) ? e.course : [e.course]))
    .filter(Boolean) as Array<{ id: string; name: string; parallel: string | null }>
  if (courses.length === 0) return []

  // Mapa normalized(cursoName) → tutorName bruto, mirando todos los blocks horarios*
  const tutorByCourseN = new Map<string, string>()
  for (const key of Object.keys(settings || {})) {
    if (!key.startsWith('horarios')) continue
    const tutores = settings[key]?.config?.tutores
    if (!tutores || typeof tutores !== 'object') continue
    for (const [cursoName, tutorName] of Object.entries(tutores)) {
      if (typeof tutorName !== 'string') continue
      tutorByCourseN.set(norm(cursoName), tutorName)
    }
  }

  const result: Array<{ teacherId: string; teacherName: string; courseId: string; courseName: string }> = []
  const resolvedTeachers = new Map<string, { id: string; full_name: string }>()

  for (const c of courses) {
    const n1 = norm(c.name)
    const n2 = norm(`${c.name} ${c.parallel || ''}`)
    const tutorRawName = tutorByCourseN.get(n1) || tutorByCourseN.get(n2)
    if (!tutorRawName) continue
    const tKey = norm(tutorRawName)
    let t = resolvedTeachers.get(tKey)
    if (!t) {
      // Buscar el profile del tutor en la institución — match por nombre normalizado
      const { data: teachers } = await (admin as any)
        .from('profiles')
        .select('id, full_name')
        .eq('institution_id', stu.institution_id)
        .eq('role', 'teacher')
      const found = ((teachers || []) as any[]).find((p: any) => norm(p.full_name) === tKey)
      if (!found) continue
      t = { id: found.id, full_name: found.full_name }
      resolvedTeachers.set(tKey, t)
    }
    result.push({
      teacherId:   t.id,
      teacherName: t.full_name,
      courseId:    c.id,
      courseName:  `${c.name}${c.parallel ? ' ' + c.parallel : ''}`,
    })
  }
  return result
}

/**
 * Devuelve los estudiantes (ids) de los cursos que un docente tutoriza.
 */
export async function resolveStudentsForTutor(
  admin: SupabaseClient,
  teacherId: string
): Promise<Array<{ studentId: string; studentName: string; courseId: string; courseName: string }>> {
  const { data: prof } = await (admin as any)
    .from('profiles')
    .select('full_name, institution_id, institutions(settings)')
    .eq('id', teacherId)
    .single()
  if (!prof?.institution_id) return []

  const tutoredN = tutoredCourseNamesFromSettings(prof.institutions?.settings, prof.full_name || '')
  if (tutoredN.length === 0) return []

  const { data: courses } = await (admin as any)
    .from('courses')
    .select('id, name, parallel')
    .eq('institution_id', prof.institution_id)
  const myCourses = ((courses || []) as any[]).filter((c: any) =>
    tutoredN.includes(norm(c.name)) || tutoredN.includes(norm(`${c.name} ${c.parallel || ''}`))
  )
  if (myCourses.length === 0) return []

  const { data: enr } = await (admin as any)
    .from('enrollments')
    .select('student_id, course_id, student:profiles(id, full_name)')
    .in('course_id', myCourses.map((c: any) => c.id))

  const cMap = new Map<string, string>(myCourses.map((c: any) => [c.id, `${c.name}${c.parallel ? ' ' + c.parallel : ''}`]))
  return ((enr || []) as any[]).map((e: any) => {
    const student = Array.isArray(e.student) ? e.student[0] : e.student
    return {
      studentId:   student?.id || e.student_id,
      studentName: student?.full_name || 'Alumno',
      courseId:    e.course_id,
      courseName:  cMap.get(e.course_id) || '',
    }
  })
}
