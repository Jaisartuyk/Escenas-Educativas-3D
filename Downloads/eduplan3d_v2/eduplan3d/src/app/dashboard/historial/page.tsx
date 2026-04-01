// src/app/dashboard/historial/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { HistorialClient } from '@/components/planner/HistorialClient'

export const metadata: Metadata = { title: 'Historial' }

export default async function HistorialPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: planificaciones } = await supabase
    .from('planificaciones')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Historial</h1>
        <p className="text-ink3 text-sm mt-1">
          {planificaciones?.length ?? 0} planificaciones guardadas
        </p>
      </div>
      <HistorialClient initialData={planificaciones ?? []} />
    </div>
  )
}
