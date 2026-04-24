import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SecretariaClient } from '@/components/secretaria/SecretariaClient'

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

  // Cargar datos en paralelo con adminClient
  const [studentsRes, coursesRes, enrollsRes, paymentsRes, instRes] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('institution_id', instId).eq('role', 'student').order('full_name'),
    admin.from('courses').select('id, name, parallel, level, shift').eq('institution_id', instId),
    admin.from('enrollments').select('course_id, student_id'),
    admin.from('payments' as any).select('*').eq('institution_id', instId).order('created_at', { ascending: false }),
    admin.from('institutions').select('settings').eq('id', instId).single(),
  ])

  const instSettings = (instRes.data as any)?.settings || {}

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Secretar&iacute;a Acad&eacute;mica</h1>
        <p className="text-ink3 text-sm mt-1">Control financiero, cobros y pensiones estudiantiles.</p>
      </div>
      <SecretariaClient
        institutionId={instId}
        students={studentsRes.data || []}
        courses={coursesRes.data || []}
        enrollments={enrollsRes.data || []}
        initialPayments={paymentsRes.data || []}
        financialSettings={instSettings.financial || {}}
      />
    </div>
  )
}
