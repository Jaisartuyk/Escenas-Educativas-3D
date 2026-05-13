import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type EnrollmentRow = {
  student_id: string
  course_id: string
}

type CourseRow = {
  id: string
  name: string
  parallel: string | null
  shift: string | null
}

type ExistingPayment = {
  student_id: string
  type: string
  description: string | null
  due_date?: string | null
}

function hasMatriculaForYear(payments: ExistingPayment[], year: number) {
  return payments.some((payment) => {
    if (payment.type !== 'matricula') return false
    if (payment.due_date) {
      const due = new Date(`${payment.due_date}T00:00:00`)
      if (!Number.isNaN(due.getTime()) && due.getFullYear() === year) return true
    }
    return (payment.description || '').includes(String(year))
  })
}

function hasPensionForMonth(payments: ExistingPayment[], monthName: string, targetYear: number, monthIndex: number) {
  return payments.some((payment) => {
    if (payment.type !== 'pension') return false

    if (payment.due_date) {
      const due = new Date(`${payment.due_date}T00:00:00`)
      if (!Number.isNaN(due.getTime())) {
        return due.getFullYear() === targetYear && due.getMonth() === monthIndex
      }
    }

    const description = (payment.description || '').toLowerCase()
    return description.includes(monthName) && description.includes(String(targetYear))
  })
}

// POST - generate pending payments for all enrolled students who do not have them yet
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const [coursesRes, instRes] = await Promise.all([
    admin.from('courses').select('id, name, parallel, shift').eq('institution_id', instId),
    admin.from('institutions').select('settings').eq('id', instId).single(),
  ])

  const courses = ((coursesRes.data || []) as CourseRow[])
  const financial = (instRes.data as any)?.settings?.financial || {}

  const courseIds = courses.map((c) => c.id)
  if (courseIds.length === 0) {
    return NextResponse.json({ generated: 0 })
  }

  const coursesById: Record<string, CourseRow> = {}
  for (const course of courses) {
    coursesById[course.id] = course
  }

  const { data: enrollments } = await admin
    .from('enrollments')
    .select('student_id, course_id')
    .in('course_id', courseIds)

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ generated: 0 })
  }

  const enrollmentByStudent = new Map<string, EnrollmentRow>()
  for (const enrollment of enrollments as EnrollmentRow[]) {
    if (!enrollmentByStudent.has(enrollment.student_id)) {
      enrollmentByStudent.set(enrollment.student_id, enrollment)
    }
  }

  const { data: existingPayments } = await admin
    .from('payments' as any)
    .select('student_id, type, description, due_date')
    .eq('institution_id', instId)

  const paymentsByStudent: Record<string, ExistingPayment[]> = {}
  for (const payment of (existingPayments || []) as ExistingPayment[]) {
    if (!paymentsByStudent[payment.student_id]) {
      paymentsByStudent[payment.student_id] = []
    }
    paymentsByStudent[payment.student_id].push(payment)
  }

  const now = new Date()
  const year = now.getFullYear()
  const pensionMonths = [
    { idx: 4, name: 'mayo' },
    { idx: 5, name: 'junio' },
    { idx: 6, name: 'julio' },
    { idx: 7, name: 'agosto' },
    { idx: 8, name: 'septiembre' },
    { idx: 9, name: 'octubre' },
    { idx: 10, name: 'noviembre' },
    { idx: 11, name: 'diciembre' },
    { idx: 0, name: 'enero' },
    { idx: 1, name: 'febrero' },
  ]

  const allPayments: any[] = []
  const plannedKeys = new Set<string>()

  for (const enrollment of Array.from(enrollmentByStudent.values())) {
    const studentPayments = paymentsByStudent[enrollment.student_id] || []
    const course = coursesById[enrollment.course_id]
    const courseName = course ? `${course.name} ${course.parallel || ''}`.trim() : ''
    const shift = (course?.shift?.toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina') as 'matutina' | 'vespertina'
    const prices = financial[shift] || { matricula: 35, pension: 60 }

    const hasMatricula = hasMatriculaForYear(studentPayments, year)
    if (!hasMatricula) {
      const matriculaDue = new Date(year, now.getMonth(), now.getDate() + 15)
      const key = `${enrollment.student_id}::matricula::${year}`
      if (!plannedKeys.has(key)) {
        plannedKeys.add(key)
        allPayments.push({
          id: crypto.randomUUID(),
          institution_id: instId,
          student_id: enrollment.student_id,
          amount: prices.matricula || 35,
          description: `Matricula ${year} - ${courseName}`,
          type: 'matricula',
          status: 'pendiente',
          due_date: matriculaDue.toISOString().split('T')[0],
        })
      }
    }

    for (const month of pensionMonths) {
      const pensionYear = month.idx < 4 ? year + 1 : year
      const due = new Date(pensionYear, month.idx, 5)
      const hasThisPension = hasPensionForMonth(studentPayments, month.name, pensionYear, month.idx)

      if (!hasThisPension) {
        const key = `${enrollment.student_id}::pension::${pensionYear}-${month.idx}`
        if (!plannedKeys.has(key)) {
          plannedKeys.add(key)
          allPayments.push({
            id: crypto.randomUUID(),
            institution_id: instId,
            student_id: enrollment.student_id,
            amount: prices.pension || 60,
            description: `Pension ${month.name.charAt(0).toUpperCase() + month.name.slice(1)} ${pensionYear} - ${courseName}`,
            type: 'pension',
            status: 'pendiente',
            due_date: due.toISOString().split('T')[0],
          })
        }
      }
    }
  }

  let successCount = 0

  if (allPayments.length > 0) {
    const CHUNK_SIZE = 500
    for (let i = 0; i < allPayments.length; i += CHUNK_SIZE) {
      const chunk = allPayments.slice(i, i + CHUNK_SIZE)
      const { error } = await admin.from('payments' as any).insert(chunk)
      if (error) {
        console.error('[secretaria/generate-payments] insert error', error)
        return NextResponse.json({ error: error.message, generated: successCount }, { status: 500 })
      }
      successCount += chunk.length
    }
  }

  return NextResponse.json({ generated: successCount })
}
