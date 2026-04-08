// src/app/dashboard/page.tsx — versión diagnóstico
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, institution_id')
    .eq('id', user!.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-400">Usuario: {user.email}</p>
      <p className="mt-1 text-sm text-gray-400">
        Institución: {profile?.institution_id ?? 'Sin institución'}
      </p>
    </div>
  )
}
