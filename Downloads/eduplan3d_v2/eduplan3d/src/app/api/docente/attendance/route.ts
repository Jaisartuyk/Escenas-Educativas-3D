import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsSubject, studentEnrolledInSubject } from '@/lib/auth/ownership'
import { getSharedAttendancePolicy } from '@/lib/attendance-policy'

async function loadSubjectContext(subjectId: string) {
  const admin = createAdminClient()
  const { data: subject, error } = await admin
    .from('subjects')
    .select('id, name, course_id, courses(id, name, parallel, institution_id)')
    .eq('id', subjectId)
    .single()

  if (error || !subject) {
    throw new Error(error?.message || 'No se encontró la materia')
  }

  const course = (subject as any).courses
  if (!course?.id) {
    throw new Error('La materia no tiene un curso asociado')
  }

  const institutionId = course.institution_id as string | null
  let settings: Record<string, any> = {}

  if (institutionId) {
    const { data: institution } = await admin
      .from('institutions')
      .select('settings')
      .eq('id', institutionId)
      .single()
    settings = ((institution as any)?.settings || {}) as Record<string, any>
  }

  const { data: courseSubjects } = await admin
    .from('subjects')
    .select('id, name')
    .eq('course_id', course.id)

  return {
    admin,
    subject: {
      id: subject.id as string,
      name: (subject as any).name as string,
      course_id: course.id as string,
    },
    course: {
      id: course.id as string,
      name: (course.name as string | null) || '',
      parallel: (course.parallel as string | null) || '',
    },
    institutionId,
    settings,
    courseSubjects: (courseSubjects || []) as Array<{ id: string; name: string | null }>,
  }
}

// GET /api/docente/attendance?subjectId=X&weekStart=YYYY-MM-DD
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('subjectId')
  const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Monday)
  const date = searchParams.get('date')
  if (!subjectId || (!weekStart && !date))
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const owns = await teacherOwnsSubject(user.id, subjectId)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta materia' }, { status: 403 })

  if (date) {
    try {
      const { admin, course, settings, courseSubjects } = await loadSubjectContext(subjectId)
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const policy = getSharedAttendancePolicy({
        settings,
        course,
        date,
        teacherName: ((profile as any)?.full_name as string | undefined) || '',
      })

      const subjectIds = courseSubjects.map(subject => subject.id)
      const { data, error } = await admin
        .from('attendance' as any)
        .select('id, subject_id, student_id, date, status')
        .in('subject_id', subjectIds.length > 0 ? subjectIds : [subjectId])
        .eq('date', date)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const byStudent = new Map<string, any>()
      for (const row of (data || []) as any[]) {
        if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, row)
      }

      return NextResponse.json({
        data: Array.from(byStudent.values()),
        policy,
      })
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Error al obtener asistencia' }, { status: 500 })
    }
  }

  const safeWeekStart = weekStart as string

  // weekEnd = Friday
  const start = new Date(safeWeekStart)
  const end   = new Date(safeWeekStart)
  end.setDate(end.getDate() + 4)
  const weekEnd = end.toISOString().split('T')[0]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('attendance' as any)
    .select('id, student_id, date, status')
    .eq('subject_id', subjectId)
    .gte('date', safeWeekStart)
    .lte('date', weekEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/docente/attendance  → upsert one record
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { subject_id, student_id, date, status, entries } = body

  if (!subject_id) return NextResponse.json({ error: 'Missing subject_id' }, { status: 400 })
  const owns = await teacherOwnsSubject(user.id, subject_id)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta materia' }, { status: 403 })

  if (Array.isArray(entries)) {
    try {
      const { admin, course, institutionId, settings, courseSubjects } = await loadSubjectContext(subject_id)
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const policy = getSharedAttendancePolicy({
        settings,
        course,
        date,
        teacherName: ((profile as any)?.full_name as string | undefined) || '',
      })

      if (!policy.canTeacherEdit) {
        const authority = policy.authorityTeacherName || 'el docente responsable'
        return NextResponse.json(
          { error: `La asistencia oficial de ${policy.courseLabel} la registra ${authority}.` },
          { status: 403 }
        )
      }

      const studentIds = entries
        .map((entry: any) => entry?.student_id)
        .filter((value: any): value is string => typeof value === 'string' && value.trim().length > 0)
      const uniqueStudentIds = Array.from(new Set(studentIds))

      const { data: enrollments } = await admin
        .from('enrollments')
        .select('student_id')
        .eq('course_id', course.id)
        .in('student_id', uniqueStudentIds)

      const enrolledIds = new Set((enrollments || []).map((row: any) => row.student_id))
      const invalidStudentId = uniqueStudentIds.find(id => !enrolledIds.has(id))
      if (invalidStudentId) {
        return NextResponse.json(
          { error: 'Uno de los estudiantes no pertenece al curso de esta materia.' },
          { status: 403 }
        )
      }

      const subjectIds = courseSubjects.map(subject => subject.id)
      await admin
        .from('attendance' as any)
        .delete()
        .in('subject_id', subjectIds.length > 0 ? subjectIds : [subject_id])
        .eq('date', date)

      const rows = (subjectIds.length > 0 ? subjectIds : [subject_id]).flatMap(currentSubjectId =>
        entries.map((entry: any) => ({
          subject_id: currentSubjectId,
          student_id: entry.student_id,
          institution_id: institutionId,
          date,
          status: entry.status || 'present',
        }))
      )

      if (rows.length > 0) {
        const { error } = await admin.from('attendance' as any).insert(rows)
        if (error) {
          console.error('[attendance BULK INSERT error]', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, shared: true, policy })
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Error al guardar asistencia' }, { status: 500 })
    }
  }

  if (!student_id) return NextResponse.json({ error: 'Missing student_id' }, { status: 400 })

  const enrolled = await studentEnrolledInSubject(student_id, subject_id)
  if (!enrolled) {
    return NextResponse.json({ error: 'El estudiante no pertenece al curso de esta materia' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('attendance' as any)
    .upsert(
      { subject_id, student_id, date, status },
      { onConflict: 'subject_id,student_id,date' }
    )

  if (error) {
    console.error('[attendance UPSERT error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
