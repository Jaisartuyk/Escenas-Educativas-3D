import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST — generate pending payments for all enrolled students who don't have them yet
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('institution_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id || !['admin', 'secretary'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const instId = profile.institution_id

  // Get all enrollments with course info
  const { data: courses } = await admin
    .from('courses')
    .select('id, name, parallel')
    .eq('institution_id', instId)

  const courseIds = (courses || []).map((c: any) => c.id)
  if (courseIds.length === 0) return NextResponse.json({ generated: 0 })

  const coursesById: Record<string, any> = {}
    ; (courses || []).forEach((c: any) => { coursesById[c.id] = c })

  const { data: enrollments } = await admin
    .from('enrollments')
    .select('student_id, course_id')
    .in('course_id', courseIds)

  if (!enrollments || enrollments.length === 0) return NextResponse.json({ generated: 0 })

  // Get all existing payments per student to check for gaps
  const { data: existingPayments } = await admin
    .from('payments' as any)
    .select('student_id, type, description')
    .eq('institution_id', instId)

  const studentsWithPayments = new Set((existingPayments || []).map((p: any) => p.student_id))

  // Generate payments only for students who don't have any
  const now = new Date()
  const year = now.getFullYear()
  const pensionMonths = [4, 5, 6, 7, 8, 9, 10, 11, 0, 1]

  const allPayments: any[] = []

  for (const enr of enrollments) {
    if (studentsWithPayments.has(enr.student_id)) continue

    const course = coursesById[enr.course_id]
    const courseName = course ? `${course.name} ${course.parallel || ''}`.trim() : ''

    // Matrícula
    const matriculaDue = new Date(year, now.getMonth(), now.getDate() + 30)
    allPayments.push({
      institution_id: instId,
      student_id: enr.student_id,
      amount: 35,
      description: `Matricula ${year} — ${courseName}`,
      type: 'matricula',
      status: 'pendiente',
      due_date: matriculaDue.toISOString().split('T')[0],
    })

    // 10 pensiones
    pensionMonths.forEach((month) => {
      const pensionYear = month < 4 ? year + 1 : year
      const due = new Date(pensionYear, month, 5)
      allPayments.push({
        institution_id: instId,
        student_id: enr.student_id,
        amount: 60,
        description: `Pension ${due.toLocaleString('es', { month: 'long' })} ${pensionYear} — ${courseName}`,
        type: 'pension',
        status: 'pendiente',
        due_date: due.toISOString().split('T')[0],
      })
    })

    studentsWithPayments.add(enr.student_id) // mark so we don't duplicate for multi-course students
  }

  if (allPayments.length > 0) {
    await admin.from('payments' as any).insert(allPayments)
  }

  return NextResponse.json({ generated: allPayments.length })
}
