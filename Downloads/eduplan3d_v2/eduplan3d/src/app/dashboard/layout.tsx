// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import dynamic from 'next/dynamic'

export const revalidate = 0

const Sidebar = dynamic(() => import('@/components/layout/Sidebar').then(m => m.Sidebar), { ssr: false })
const Topbar = dynamic(() => import('@/components/layout/Topbar').then(m => m.Topbar), { ssr: false })
const OnboardingModal = dynamic(() => import('@/components/onboarding/OnboardingModal').then(mod => mod.OnboardingModal), { ssr: false })

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, institution_id, plan, email')
    .eq('id', user!.id)
    .single()

  const isMissingInstitution = !profile?.institution_id
  const isHorariosOnly = user!.email === 'israferaldascarlett15@gmail.com'

  return (
    <div className="min-h-screen flex bg-bg relative">
      {isMissingInstitution && <OnboardingModal profileName={profile?.full_name || 'Usuario'} />}
      <Sidebar role={isHorariosOnly ? 'horarios_only' : 'full'} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar profile={profile} />
        <main className="flex-1 p-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
