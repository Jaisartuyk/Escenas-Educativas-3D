import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageFinances, getProfile } from '@/lib/auth/ownership'
import { getScholarshipCourseGroup, SCHOLARSHIP_AMOUNTS } from '@/lib/student-scholarships'

export const dynamic = 'force-dynamic'

async function getFinanceProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const profile = await getProfile(user.id)
  if (!profile?.institution_id || !canManageFinances(profile.role)) {
    return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }

  return { user, profile }
}

export async function GET() {
  const auth = await getFinanceProfile()
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('student_scholarships' as any)
    .select('*')
    .eq('institution_id', auth.profile!.institution_id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function PUT(req: Request) {
  const auth = await getFinanceProfile()
  if (auth.error) return auth.error

  const body = await req.json()
  const studentId = typeof body?.student_id === 'string' ? body.student_id : ''
  const remove = body?.amount_to_pay === null
  const amount = remove ? null : Number(body?.amount_to_pay)

  if (!studentId || (!remove && (!Number.isFinite(amount) || amount! < 0))) {
    return NextResponse.json({ error: 'Datos de beca invalidos.' }, { status: 400 })
  }

  const institutionId = auth.profile!.institution_id!
  const admin = createAdminClient()

  const { data: student } = await admin
    .from('profiles')
    .select('id, institution_id, role')
    .eq('id', studentId)
    .single()

  if (!student || (student as any).institution_id !== institutionId || (student as any).role !== 'student') {
    return NextResponse.json({ error: 'El estudiante no pertenece a tu institucion.' }, { status: 403 })
  }

  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('student_id', studentId)

  const enrolledCourseIds = (enrollments || []).map((row: any) => row.course_id).filter(Boolean)
  if (enrolledCourseIds.length === 0) {
    return NextResponse.json({ error: 'El estudiante no tiene un curso asignado.' }, { status: 400 })
  }

  const { data: courses } = await admin
    .from('courses')
    .select('id, name, level, shift, institution_id')
    .in('id', enrolledCourseIds)
    .eq('institution_id', institutionId)
    .limit(1)

  const course = courses?.[0]

  if (!course) {
    return NextResponse.json({ error: 'No se encontro el curso del estudiante.' }, { status: 400 })
  }

  const group = getScholarshipCourseGroup(course as any)
  if (!remove && !SCHOLARSHIP_AMOUNTS[group].includes(amount!)) {
    return NextResponse.json({
      error: `Para ${group}, el valor con beca debe ser ${SCHOLARSHIP_AMOUNTS[group].join(', ')} dolares.`,
    }, { status: 400 })
  }

  let scholarship: any = null
  let scholarshipToDeactivateId: string | null = null

  if (remove) {
    const { data: existing, error: existingError } = await admin
      .from('student_scholarships' as any)
      .select('id')
      .eq('institution_id', institutionId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

    scholarshipToDeactivateId = existing?.id || null
  } else {
    const { data, error } = await admin
      .from('student_scholarships' as any)
      .upsert({
        institution_id: institutionId,
        student_id: studentId,
        amount_to_pay: amount,
        applies_to: 'pension',
        active: true,
        note: typeof body?.note === 'string' ? body.note.trim() || null : null,
        created_by: auth.user!.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'institution_id,student_id' })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    scholarship = data
  }

  const { data: institution } = await admin
    .from('institutions')
    .select('settings')
    .eq('id', institutionId)
    .single()

  const shift = String((course as any).shift || '').toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina'
  const financial = (institution as any)?.settings?.financial || {}
  const baseAmount = Number(financial?.[shift]?.pension ?? 60)
  const targetAmount = remove ? baseAmount : amount!

  const { data: pendingPayments, error: pendingError } = await admin
    .from('payments' as any)
    .select('id')
    .eq('institution_id', institutionId)
    .eq('student_id', studentId)
    .eq('type', 'pension')
    .eq('status', 'pendiente')

  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 })

  const paymentIds = (pendingPayments || []).map((payment: any) => payment.id).filter(Boolean)
  let paymentIdsWithAbonos = new Set<string>()

  if (paymentIds.length > 0) {
    const { data: abonos, error: abonosError } = await admin
      .from('payment_abonos' as any)
      .select('payment_id')
      .eq('institution_id', institutionId)
      .in('payment_id', paymentIds)

    if (abonosError) return NextResponse.json({ error: abonosError.message }, { status: 500 })
    paymentIdsWithAbonos = new Set((abonos || []).map((abono: any) => abono.payment_id))
  }

  const safePaymentIds = paymentIds.filter((id: string) => !paymentIdsWithAbonos.has(id))
  let updated = 0

  if (safePaymentIds.length > 0) {
    const { data, error } = await admin
      .from('payments' as any)
      .update({ amount: targetAmount, scholarship_id: scholarship?.id || null })
      .eq('institution_id', institutionId)
      .eq('student_id', studentId)
      .in('id', safePaymentIds)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    updated = data?.length || 0
  }

  if (scholarshipToDeactivateId) {
    const { error } = await admin
      .from('student_scholarships' as any)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', scholarshipToDeactivateId)
      .eq('institution_id', institutionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: scholarship, removed: remove, updated, courseGroup: group })
}
