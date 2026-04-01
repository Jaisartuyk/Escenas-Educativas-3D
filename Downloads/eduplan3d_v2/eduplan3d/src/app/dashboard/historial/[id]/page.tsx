// src/app/dashboard/historial/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DeletePlanButton } from '@/components/planner/DeletePlanButton'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await (supabase as any).from('planificaciones').select('title').eq('id', params.id).single()
  return { title: data?.title ?? 'Planificación' }
}

const TYPE_LABELS: Record<string, string> = { clase: 'Planificación de clase', unidad: 'Unidad didáctica', rubrica: 'Rúbrica de evaluación' }
const TYPE_CLASSES: Record<string, string> = { clase: 'badge-violet', unidad: 'badge-amber', rubrica: 'badge-rose' }

export default async function PlanificacionDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: plan } = await (supabase as any)
    .from('planificaciones')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single()

  if (!plan) notFound()

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink3 mb-6">
        <Link href="/dashboard" className="hover:text-ink transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/historial" className="hover:text-ink transition-colors">Historial</Link>
        <span>/</span>
        <span className="text-ink truncate max-w-[200px]">{plan.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">{plan.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={TYPE_CLASSES[plan.type]}>{TYPE_LABELS[plan.type]}</span>
            <span className="text-xs text-ink3">{plan.subject} · {plan.grade}</span>
            <span className="text-xs text-ink3">
              {format(new Date(plan.created_at), "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={`/dashboard/planificador?clone=${plan.id}`} className="btn-secondary text-sm px-4 py-2">
            Clonar
          </Link>
          <DeletePlanButton id={plan.id} />
        </div>
      </div>

      {/* Metadata chips */}
      {plan.methodologies?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {plan.methodologies.map((m: string) => (
            <span key={m} className="px-3 py-1 rounded-full text-xs font-medium bg-[rgba(124,109,250,0.08)] border border-[rgba(124,109,250,0.2)] text-violet2">
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="card p-8">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[rgba(120,100,255,0.14)]">
          <span className="text-xs font-bold uppercase tracking-widest text-teal">Contenido generado</span>
          <div className="flex gap-2">
            <button
              onClick={() => {}} // handled client-side via CopyButton component
              className="btn-secondary text-xs px-3 py-1.5">
              Copiar
            </button>
          </div>
        </div>
        <pre className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed font-body">
          {plan.content}
        </pre>
      </div>
    </div>
  )
}
