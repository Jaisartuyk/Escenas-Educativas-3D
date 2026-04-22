import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/ownership'

// POST /api/enrollments  body: { student_id, course_id }  → insert + auto-create payments
// DELETE /api/enrollments?student_id=X&course_id=Y       → delete enrollment + related payments

// Roles autorizados a matricular/desmatricular alumnos
const ENROLL_ROLES = new Set(['admin', 'assistant', 'secretary'])

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
    .select('institution_id, name')
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

  // 3. Check if payments already exist for this student+institution (avoid duplicates on re-enrollment)
  const { data: existing } = await admin
    .from('payments' as any)
    .select('id')
    .eq('student_id', student_id)
    .eq('institution_id', instId)
    .limit(1)

  if (existing && existing.length > 0) {
    // Already has payments, don't duplicate
    return NextResponse.json({ success: true })
  }

  // 4. Create pending payments: 1 matrícula + 10 pensiones mensuales
  const now = new Date()
  const year = now.getFullYear()
  // School year months: May to Feb (10 months typical in Ecuador/LatAm)
  const pensionMonths = [4, 5, 6, 7, 8, 9, 10, 11, 0, 1] // May(4)..Feb(1)

  const payments: any[] = []

  // Matrícula — single payment, due within 30 days
  const matriculaDue = new Date(year, now.getMonth(), now.getDate() + 30)
  payments.push({
    institution_id: instId,
    student_id,
    amount: 0, // amount set by secretary
    description: `Matrícula ${year} — ${courseName}`,
    status: 'pendiente',
    type: 'matricula',
    due_date: matriculaDue.toISOString().split('T')[0],
  })

  // Pensiones mensuales — 10 months, due on the 5th of each month
  pensionMonths.forEach((month, idx) => {
    const pensionYear = month < 4 ? year + 1 : year // Jan-Feb go to next year
    const due = new Date(pensionYear, month, 5)
    payments.push({
      institution_id: instId,
      student_id,
      amount: 0, // amount set by secretary
      description: `Pensión ${due.toLocaleString('es', { month: 'long' })} ${pensionYear} — ${courseName}`,
      status: 'pendiente',
      type: 'pension',
      due_date: due.toISOString().split('T')[0],
    })
  })

  // Bulk insert payments
  await admin.from('payments' as any).insert(payments)

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
