// src/app/dashboard/planificaciones/[id]/page.tsx
// Editor rich-text de una planificación manual (placeholder Fase 3 — TipTap en Fase 4).

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PlanificacionManualPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: plan } = await (supabase as any)
    .from('planificaciones_manuales')
    .select('id, title, subject_name, course_name, status, content_json, content_html, updated_at')
    .eq('id', params.id)
    .single()

  if (!plan) redirect('/dashboard/planificaciones')

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <Link
        href="/dashboard/planificaciones"
        className="inline-flex items-center gap-1 text-sm text-ink3 hover:text-violet mb-3"
      >
        <ChevronLeft size={14} /> Volver a Planificaciones
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          {plan.title}
        </h1>
        <p className="text-ink3 text-sm mt-1">
          {plan.subject_name} · {plan.course_name}
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-bg2 p-10 text-center">
        <p className="text-ink3 text-sm">
          🛠️ Editor rich-text con plantilla MinEduc — disponible en la Fase 4.
        </p>
        <p className="text-xs text-ink4 mt-2">
          ID: <code>{plan.id}</code>
        </p>
      </div>
    </div>
  )
}
