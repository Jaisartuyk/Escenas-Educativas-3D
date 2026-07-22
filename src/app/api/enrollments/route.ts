import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'
import { v5 as uuidv5 } from 'uuid'
import { buildRecurringPaymentDescription } from '@/lib/payment-period'
import { getScholarshipAmount } from '@/lib/student-scholarships'

// POST /api/enrollments  body: { student_id, course_id }  → insert + auto-create payments
// DELETE /api/enrollments?student_id=X&course_id=Y       → delete enrollment + related payments

// Roles autorizados a matricular/desmatricular alumnos
const ENROLL_ROLES = new Set(['admin', 'assistant', 'secretary'])
const PAYMENT_NAMESPACE = '5ff6c6b6-89ca-4e58-b8c6-b20fb690db5e'

function buildPaymentId(institutionId: string, studentId: string, type: 'matricula' | 'pension', cycleKey: string) {
  return uuidv5(`${institutionId}:${studentId}:${type}:${cycleKey}`, PAYMENT_NAMESPACE)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!ENROLL_ROLES.has(profile.role || '')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { student_id, course_id } = await req.json()
  if (!student_id || !course_id)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que el curso pertenece a la institución del admin
  const { data: course } = await admin
    .from('courses')
    .select('institution_id, name, shift')
    .eq('id', course_id)
    .single()
  if (!course || (course as any).institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Curso no pertenece a tu institución' }, { status: 403 })
  }

  // Verificar que el alumno pertenece a la misma institución
  const { data: student } = await admin
    .from('profiles')
    .select('institution_id, role')
    .eq('id', student_id)
    .single()
  if (!student || (student as any).institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Alumno no pertenece a tu institución' }, { status: 403 })
  }

  // 1. Insert enrollment
  const { error } = await admin
    .from('enrollments')
    .insert({ student_id, course_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const instId = (course as any).institution_id
  const courseName = (course as any).name || ''
  const shift = String((course as any).shift || '').toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina'

  const [{ data: institution }, { data: scholarship }] = await Promise.all([
    admin.from('institutions').select('settings').eq('id', instId).single(),
    admin.from('student_scholarships' as any)
      .select('id, amount_to_pay, active')
      .eq('institution_id', instId)
      .eq('student_id', student_id)
      .eq('active', true)
      .maybeSingle(),
  ])

  const financial = (institution as any)?.settings?.financial || {}
  const prices = financial?.[shift] || { matricula: 35, pension: 60 }

  // 3. Create pending payments with deterministic ids so re-enrollment or later generation
  // never creates a second cobro for the same academic period.
  const now = new Date()
  const year = now.getFullYear()
  const pensionMonths = [4, 5, 6, 7, 8, 9, 10, 11, 0, 1]

  const payments: any[] = []

  const matriculaDue = new Date(year, now.getMonth(), now.getDate() + 30)
  payments.push({
    id: buildPaymentId(instId, student_id, 'matricula', `matricula:${year}`),
    institution_id: instId,
    student_id,
    amount: Number(prices.matricula ?? 35),
    description: buildRecurringPaymentDescription('matricula', year, null, courseName),
    status: 'pendiente',
    type: 'matricula',
    due_date: matriculaDue.toISOString().split('T')[0],
  })

  pensionMonths.forEach((month) => {
    const pensionYear = month < 4 ? year + 1 : year // Jan-Feb go to next year
    const due = new Date(pensionYear, month, 5)
    const periodMonth = String(month + 1).padStart(2, '0')
    payments.push({
      id: buildPaymentId(instId, student_id, 'pension', `pension:${pensionYear}-${periodMonth}`),
      institution_id: instId,
      student_id,
      amount: getScholarshipAmount(scholarship as any, Number(prices.pension ?? 60)),
      scholarship_id: (scholarship as any)?.id || null,
      description: buildRecurringPaymentDescription('pension', pensionYear, month, courseName),
      status: 'pendiente',
      type: 'pension',
      due_date: due.toISOString().split('T')[0],
    })
  })

  await admin.from('payments' as any).upsert(payments, { onConflict: 'id' })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(user.id)
  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })
  if (!ENROLL_ROLES.has(profile.role || '')) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const student_id = searchParams.get('student_id')
  const course_id  = searchParams.get('course_id')
  if (!student_id || !course_id)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que el curso pertenece a la institución del admin
  const { data: course } = await admin
    .from('courses')
    .select('institution_id')
    .eq('id', course_id)
    .single()
  if (!course || (course as any).institution_id !== profile.institution_id) {
    return NextResponse.json({ error: 'Curso no pertenece a tu institución' }, { status: 403 })
  }

  const { error } = await admin
    .from('enrollments')
    .delete()
    .match({ student_id, course_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
