// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import dynamic from 'next/dynamic'

const Sidebar = dynamic(() => import('@/components/layout/Sidebar').then(m => m.Sidebar), { ssr: false })
const Topbar = dynamic(() => import('@/components/layout/Topbar').then(m => m.Topbar), { ssr: false })
const OnboardingModal = dynamic(() => import('@/components/onboarding/OnboardingModal').then(mod => mod.OnboardingModal), { ssr: false })

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  try {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

  const isMissingInstitution = !profile?.institution_id

  return (
    <div className="min-h-screen flex bg-bg relative">
      {isMissingInstitution && <OnboardingModal profileName={profile?.full_name || 'Usuario'} />}
      <Sidebar role={user.email === 'israferaldascarlett15@gmail.com' ? 'horarios_only' : 'full'} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar profile={profile} />
        <main className="flex-1 p-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
  } catch (err: any) {
    return (
      <div className="p-8 text-rose bg-surface font-mono overflow-auto text-sm min-h-screen">
        <h2 className="font-bold text-xl mb-4">SSR LAYOUT EXCEPTION CAUGHT:</h2>
        <p><strong>Message:</strong> {err.message}</p>
        <pre className="mt-4">{err.stack}</pre>
        <p className="mt-4 break-all">{JSON.stringify(err)}</p>
      </div>
    )
  }
}
