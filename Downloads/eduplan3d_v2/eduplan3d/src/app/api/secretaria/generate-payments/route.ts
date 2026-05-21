import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { v5 as uuidv5 } from 'uuid'
import { buildRecurringPaymentDescription, getRecurringPaymentPeriodKey } from '@/lib/payment-period'

export const dynamic = 'force-dynamic'

const PAYMENT_NAMESPACE = '5ff6c6b6-89ca-4e58-b8c6-b20fb690db5e'

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
  id?: string
  student_id: string
  type: string
  status?: string | null
  amount?: number | null
  description: string | null
  due_date?: string | null
}

function buildPaymentId(institutionId: string, studentId: string, type: 'matricula' | 'pension', cycleKey: string) {
  return uuidv5(`${institutionId}:${studentId}:${type}:${cycleKey}`, PAYMENT_NAMESPACE)
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
    .select('id, student_id, type, status, amount, description, due_date')
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
  const existingPeriodKeysByStudent: Record<string, Set<string>> = {}

  for (const [studentId, studentPayments] of Object.entries(paymentsByStudent)) {
    existingPeriodKeysByStudent[studentId] = new Set(
      studentPayments
        .map((payment) => getRecurringPaymentPeriodKey(payment))
        .filter((key): key is string => Boolean(key))
    )
  }

  for (const enrollment of Array.from(enrollmentByStudent.values())) {
    const studentPeriodKeys = existingPeriodKeysByStudent[enrollment.student_id] || new Set<string>()
    existingPeriodKeysByStudent[enrollment.student_id] = studentPeriodKeys
    const course = coursesById[enrollment.course_id]
    const courseName = course ? `${course.name} ${course.parallel || ''}`.trim() : ''
    const shift = (course?.shift?.toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina') as 'matutina' | 'vespertina'
    const prices = financial[shift] || { matricula: 35, pension: 60 }

    const matriculaPeriodKey = `matricula:${year}`
    if (!studentPeriodKeys.has(matriculaPeriodKey)) {
      const matriculaDue = new Date(year, now.getMonth(), now.getDate() + 15)
      const key = `${enrollment.student_id}::${matriculaPeriodKey}`
      if (!plannedKeys.has(key)) {
        plannedKeys.add(key)
        studentPeriodKeys.add(matriculaPeriodKey)
        allPayments.push({
          id: buildPaymentId(instId, enrollment.student_id, 'matricula', matriculaPeriodKey),
          institution_id: instId,
          student_id: enrollment.student_id,
          amount: prices.matricula || 35,
          description: buildRecurringPaymentDescription('matricula', year, null, courseName),
          type: 'matricula',
          status: 'pendiente',
          due_date: matriculaDue.toISOString().split('T')[0],
        })
      }
    }

    for (const month of pensionMonths) {
      const pensionYear = month.idx < 4 ? year + 1 : year
      const due = new Date(pensionYear, month.idx, 5)
      const periodMonth = String(month.idx + 1).padStart(2, '0')
      const pensionPeriodKey = `pension:${pensionYear}-${periodMonth}`

      if (!studentPeriodKeys.has(pensionPeriodKey)) {
        const key = `${enrollment.student_id}::${pensionPeriodKey}`
        if (!plannedKeys.has(key)) {
          plannedKeys.add(key)
          studentPeriodKeys.add(pensionPeriodKey)
          allPayments.push({
            id: buildPaymentId(instId, enrollment.student_id, 'pension', pensionPeriodKey),
            institution_id: instId,
            student_id: enrollment.student_id,
            amount: prices.pension || 60,
            description: buildRecurringPaymentDescription('pension', pensionYear, month.idx, courseName),
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
      const { error } = await admin.from('payments' as any).upsert(chunk, { onConflict: 'id' })
      if (error) {
        console.error('[secretaria/generate-payments] insert error', error)
        return NextResponse.json({ error: error.message, generated: successCount }, { status: 500 })
      }
      successCount += chunk.length
    }
  }

  return NextResponse.json({ generated: successCount })
}
