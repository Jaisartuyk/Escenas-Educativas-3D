// src/app/dashboard/configuracion/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfiguracionClient } from '@/components/layout/ConfiguracionClient'

export const metadata: Metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isPlannerSolo = profile?.plan === 'planner_solo' || profile?.plan === 'planner_pro'

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-ink3 text-sm mt-1">
          {isPlannerSolo ? 'Gestiona tu cuenta y tu plan del planificador' : 'Gestiona tu perfil y suscripción'}
        </p>
      </div>
      <ConfiguracionClient profile={profile} standalone={isPlannerSolo} />
    </div>
  )
}
