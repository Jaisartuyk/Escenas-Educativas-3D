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

  const paymentsByStudent: Record<string, any[]> = {}
  ;(existingPayments || []).forEach((p: any) => {
    if (!paymentsByStudent[p.student_id]) paymentsByStudent[p.student_id] = []
    paymentsByStudent[p.student_id].push(p)
  })

  // Generate payments only for students who don't have any
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

  for (const enr of enrollments) {
    const studentPayments = paymentsByStudent[enr.student_id] || []
    const course = coursesById[enr.course_id]
    const courseName = course ? `${course.name} ${course.parallel || ''}`.trim() : ''

    // 1. Check Matrícula
    const hasMatricula = studentPayments.some(p => p.type === 'matricula')
    if (!hasMatricula) {
      const matriculaDue = new Date(year, now.getMonth(), now.getDate() + 15)
      allPayments.push({
        institution_id: instId,
        student_id: enr.student_id,
        amount: 35,
        description: `Matricula ${year} — ${courseName}`,
        type: 'matricula',
        status: 'pendiente',
        due_date: matriculaDue.toISOString().split('T')[0],
      })
    }

    // 2. Check each Pension
    pensionMonths.forEach((mObj) => {
      const pensionYear = mObj.idx < 4 ? year + 1 : year
      const due = new Date(pensionYear, mObj.idx, 5)
      
      const hasThisPension = studentPayments.some(p => 
        p.type === 'pension' && (p.description || '').toLowerCase().includes(mObj.name)
      )

      if (!hasThisPension) {
        allPayments.push({
          institution_id: instId,
          student_id: enr.student_id,
          amount: 60,
          description: `Pension ${mObj.name.charAt(0).toUpperCase() + mObj.name.slice(1)} ${pensionYear} — ${courseName}`,
          type: 'pension',
          status: 'pendiente',
          due_date: due.toISOString().split('T')[0],
        })
      }
    })
  }

  if (allPayments.length > 0) {
    await admin.from('payments' as any).insert(allPayments)
  }

  return NextResponse.json({ generated: allPayments.length })
}
