// src/app/dashboard/historial/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DeletePlanButton } from '@/components/planner/DeletePlanButton'
import { CopyButton } from '@/components/planner/CopyButton'
import { PrintButton } from '@/components/planner/PrintButton'
import { MarkdownRenderer } from '@/components/planner/MarkdownRenderer'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await (supabase as any).from('planificaciones').select('title').eq('id', params.id).single()
  return { title: data?.title ?? 'Planificacion' }
}

const TYPE_LABELS: Record<string, string> = {
  clase: 'Planificacion de clase',
  unidad: 'Unidad didactica',
  rubrica: 'Rubrica de evaluacion',
}
const TYPE_CLASSES: Record<string, string> = {
  clase: 'badge-violet',
  unidad: 'badge-amber',
  rubrica: 'badge-rose',
}

export default async function PlanificacionDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: plan } = await (supabase as any)
    .from('planificaciones')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!plan) notFound()

  // content puede ser jsonb o text — normalizar a string
  const contentText = typeof plan.content === 'string'
    ? plan.content
    : JSON.stringify(plan.content, null, 2)

  // Metadata
  const meta = plan.metadata || {}

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Breadcrumb — hidden on print */}
      <div className="flex items-center gap-2 text-sm text-ink3 mb-6 print:hidden">
        <Link href="/dashboard" className="hover:text-ink transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/historial" className="hover:text-ink transition-colors">Historial</Link>
        <span>/</span>
        <span className="text-ink truncate max-w-[200px]">{plan.title}</span>
      </div>

      {/* Header — hidden on print */}
      <div className="flex items-start justify-between gap-6 mb-6 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">{plan.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={TYPE_CLASSES[plan.type] || 'badge-violet'}>{TYPE_LABELS[plan.type] || plan.type}</span>
            <span className="text-xs text-ink3">{plan.subject} · {plan.grade}</span>
            {meta.trimestre && <span className="text-xs text-ink3">T{meta.trimestre} · P{meta.parcial} · S{meta.semana}</span>}
            <span className="text-xs text-ink3">
              {format(new Date(plan.created_at), "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PrintButton />
          <CopyButton text={contentText} />
          <Link href={`/dashboard/planificador?clone=${plan.id}`} className="btn-secondary text-sm px-4 py-2">
            Clonar
          </Link>
          <DeletePlanButton id={plan.id} />
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none">
        <div className="p-8 print:p-4">
          <MarkdownRenderer content={contentText} />
        </div>
      </div>
    </div>
  )
}
