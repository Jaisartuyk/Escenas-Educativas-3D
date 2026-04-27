import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [], diag: null }, { status: 401 })

  const admin = createAdminClient()

  // 1) Materias del docente
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, course_id, name')
    .eq('teacher_id', user.id)

  const subjectsCount = (subjects || []).length
  const subjectsWithCourse = (subjects || []).filter((s: any) => !!s.course_id).length
  const subjectsWithoutCourse = subjectsCount - subjectsWithCourse

  if (subjectsCount === 0) {
    return NextResponse.json({
      data: [],
      diag: {
        reason: 'no_subjects',
        message: 'No tienes materias asignadas. Pide al admin que te asigne materias en "Académico".',
        subjectsCount: 0,
      },
    })
  }

  if (subjectsWithCourse === 0) {
    return NextResponse.json({
      data: [],
      diag: {
        reason: 'subjects_without_course',
        message: `Tienes ${subjectsCount} materia(s) pero ninguna está asignada a un curso. Pide al admin asignar curso a tus materias.`,
        subjectsCount,
        subjectsWithoutCourse,
      },
    })
  }

  // 2) Cursos
  const courseIds = Array.from(new Set((subjects || []).map((s: any) => s.course_id).filter(Boolean)))

  // 3) Matrículas (enrollments)
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id, student_id')
    .in('course_id', courseIds)

  const enrollmentsCount = (enrollments || []).length

  if (enrollmentsCount === 0) {
    return NextResponse.json({
      data: [],
      diag: {
        reason: 'no_enrollments',
        message: `Tus ${courseIds.length} curso(s) no tienen estudiantes matriculados. El admin debe matricular alumnos en "Académico → Cursos".`,
        subjectsCount,
        coursesCount: courseIds.length,
        enrollmentsCount: 0,
      },
    })
  }

  // 4) Perfiles de estudiantes
  const studentIds = Array.from(new Set((enrollments || []).map((e: any) => e.student_id as string)))
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds)

  const profilesById: Record<string, any> = {}
  ;(profiles || []).forEach((p: any) => { profilesById[p.id] = p })

  const merged = (enrollments || []).map((e: any) => ({
    course_id:  e.course_id,
    student_id: e.student_id,
    student:    profilesById[e.student_id] || null,
  }))

  return NextResponse.json({
    data: merged,
    diag: {
      reason: 'ok',
      subjectsCount,
      coursesCount: courseIds.length,
      enrollmentsCount,
      profilesCount: (profiles || []).length,
    },
  })
}
