// src/app/dashboard/page.tsx  ← versión mínima de diagnóstico
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, plan')
    .eq('id', user!.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Docente'

  return (
    <div className="animate-fade-in p-4">
      <h1 className="font-display text-3xl font-bold">Hola, {firstName} 👋</h1>
      <p className="text-ink3 mt-2">Dashboard cargado correctamente.</p>
    </div>
  )
}
