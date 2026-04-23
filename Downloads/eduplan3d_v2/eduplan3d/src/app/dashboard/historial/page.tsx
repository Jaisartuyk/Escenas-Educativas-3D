// src/app/dashboard/historial/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { HistorialClient } from '@/components/planner/HistorialClient'
import { resolveYearContext } from '@/lib/academic-year/server'

export const metadata: Metadata = { title: 'Historial' }

export default async function HistorialPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Resolver año que el usuario está viendo. Para usuarios sin institución
  // (planner_solo), hasInstitution=false → no filtramos por año.
  const ycx = await resolveYearContext(user.id)

  let query = (supabase as any)
    .from('planificaciones')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (ycx.hasInstitution && ycx.viewingYearId) {
    // Ver solo planificaciones del año visible (incluye NULL solo para current,
    // para compat con planificaciones viejas sin año asignado).
    if (ycx.viewingYearId === ycx.currentYearId) {
      query = query.or(`academic_year_id.eq.${ycx.viewingYearId},academic_year_id.is.null`)
    } else {
      query = query.eq('academic_year_id', ycx.viewingYearId)
    }
  }

  const { data: planificaciones } = await query

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Historial</h1>
        <p className="text-ink3 text-sm mt-1">
          {planificaciones?.length ?? 0} planificaciones guardadas
          {ycx.hasInstitution && ycx.isReadOnly && (
            <span className="ml-2 text-amber">· año histórico</span>
          )}
        </p>
      </div>
      <HistorialClient initialData={planificaciones ?? []} />
    </div>
  )
}
