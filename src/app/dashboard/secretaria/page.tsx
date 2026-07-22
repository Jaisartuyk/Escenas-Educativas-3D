import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SecretariaClient } from '@/components/secretaria/SecretariaClient'
import { attachAbonosToPayments } from '@/lib/payment-progress'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function SecretariaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')
  if (profile.role !== 'admin' && profile.role !== 'secretary' && profile.role !== 'rector') redirect('/dashboard')

  const instId = profile.institution_id

  // Función para obtener todos los pagos saltando el límite de 1000 de Supabase
  async function fetchAllPayments() {
    let allData: any[] = []
    let from = 0
    const step = 1000
    while (true) {
      const { data, error } = await admin
        .from('payments' as any)
        .select('*')
        .eq('institution_id', instId)
        .order('created_at', { ascending: false })
        .range(from, from + step - 1)
        
      if (error || !data || data.length === 0) break
      allData = allData.concat(data)
      if (data.length < step) break
      from += step
    }
    return allData
  }

  async function fetchAllAbonos(paymentIds: string[]) {
    if (paymentIds.length === 0) return []

    const chunkSize = 500
    let allAbonos: any[] = []

    for (let start = 0; start < paymentIds.length; start += chunkSize) {
      const chunk = paymentIds.slice(start, start + chunkSize)
      let from = 0
      const step = 1000

      while (true) {
        const { data, error } = await admin
          .from('payment_abonos' as any)
          .select('*')
          .eq('institution_id', instId)
          .in('payment_id', chunk)
          .order('paid_at', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + step - 1)

        if (error || !data || data.length === 0) break

        allAbonos = allAbonos.concat(data)
        if (data.length < step) break
        from += step
      }
    }

    return allAbonos
  }

  // Cargar datos en paralelo con adminClient
  const [studentsRes, coursesRes, enrollsRes, paymentsData, instRes, scholarshipsRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('institution_id', instId).eq('role', 'student').order('full_name'),
    admin.from('courses').select('id, name, parallel, level, shift').eq('institution_id', instId),
    admin.from('enrollments').select('course_id, student_id'),
    fetchAllPayments(),
    admin.from('institutions').select('settings').eq('id', instId).single(),
    admin.from('student_scholarships' as any).select('*').eq('institution_id', instId).eq('active', true),
  ])

  const validStudentIds = new Set((studentsRes.data || []).map((student: any) => student.id))
  const validCourseIds = new Set((coursesRes.data || []).map((course: any) => course.id))
  const scopedEnrollments = (enrollsRes.data || []).filter((enrollment: any) =>
    validStudentIds.has(enrollment.student_id) && validCourseIds.has(enrollment.course_id)
  )

  const paymentIds = (paymentsData || []).map((payment: any) => payment.id).filter(Boolean)
  const abonosData = await fetchAllAbonos(paymentIds)

  const instSettings = (instRes.data as any)?.settings || {}

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Secretar&iacute;a Acad&eacute;mica</h1>
        <p className="text-ink3 text-sm mt-1">Control financiero, cobros y pensiones estudiantiles.</p>
      </div>
      <SecretariaClient
        institutionId={instId}
        userRole={profile.role}
        students={studentsRes.data || []}
        courses={coursesRes.data || []}
        enrollments={scopedEnrollments}
        initialPayments={attachAbonosToPayments(paymentsData || [], abonosData)}
        financialSettings={instSettings.financial || {}}
        initialScholarships={scholarshipsRes.data || []}
      />
    </div>
  )
}
