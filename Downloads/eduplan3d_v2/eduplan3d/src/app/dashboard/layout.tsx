// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar role={user.email === 'israferaldascarlett15@gmail.com' ? 'horarios_only' : 'full'} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar profile={profile} />
        <main className="flex-1 p-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
