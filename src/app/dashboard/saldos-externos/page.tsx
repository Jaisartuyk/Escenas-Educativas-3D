import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SaldosExternosClient } from '@/components/secretaria/SaldosExternosClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function SaldosExternosPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')
  if (!['admin', 'secretary', 'rector', 'assistant'].includes(profile.role || '')) redirect('/dashboard')

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Saldos Externos</h1>
        <p className="text-ink3 text-sm mt-1">
          Registro manual de deudas historicas para personas que no pertenecen a la institucion activa.
        </p>
      </div>
      <SaldosExternosClient userRole={profile.role} />
    </div>
  )
}
