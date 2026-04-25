// src/app/dashboard/calendario/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarioClient } from '@/components/calendario/CalendarioClient'

export const metadata: Metadata = { title: 'Calendario' }
export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Cargar todas las planificaciones del usuario para el sidebar (drag source).
  const { data: planificaciones } = await (supabase as any)
    .from('planificaciones')
    .select('id, title, subject, grade, topic, type, grupo, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Calendario docente</h1>
        <p className="text-ink3 text-sm mt-1">
          Arrastra tus planificaciones a los días de la semana. Reutiliza la misma planificación en distintos grupos o fechas.
        </p>
      </div>
      <CalendarioClient planificaciones={planificaciones || []} />
    </div>
  )
}
