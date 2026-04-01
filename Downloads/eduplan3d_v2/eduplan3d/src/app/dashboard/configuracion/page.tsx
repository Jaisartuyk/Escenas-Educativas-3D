// src/app/dashboard/configuracion/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ConfiguracionClient } from '@/components/layout/ConfiguracionClient'

export const metadata: Metadata = { title: 'Configuración' }

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-ink3 text-sm mt-1">Gestiona tu perfil y suscripción</p>
      </div>
      <ConfiguracionClient profile={profile} />
    </div>
  )
}
