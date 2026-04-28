// src/app/dashboard/inserciones-distribucion/page.tsx
// Matriz Anual de Inserciones Curriculares MinEduc 2025-2026.
// Solo admin/assistant/rector pueden modificar. Cualquier miembro de la
// institución puede ver (RLS lo controla).

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInstitutionalMatriz } from '@/lib/actions/inserciones-distribucion'
import { resolveYearContext } from '@/lib/academic-year/server'
import { MatrizClient } from '@/components/inserciones-distribucion/MatrizClient'

export const metadata: Metadata = { title: 'Matriz de Inserciones' }
export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['admin', 'assistant', 'rector']

export default async function InsercionesDistribucionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.institution_id) redirect('/dashboard')

  const canEdit = ADMIN_ROLES.includes(profile.role)
  const ycx = await resolveYearContext(user.id)
  const academicYearId = ycx.viewingYearId || ycx.currentYearId || null

  const r = await getInstitutionalMatriz({ academicYearId })
  const rows = r.rows || [
    { trimestre: 1, inserciones: [] },
    { trimestre: 2, inserciones: [] },
    { trimestre: 3, inserciones: [] },
  ]

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Matriz Anual de Inserciones
        </h1>
        <p className="text-ink3 text-sm mt-1">
          Distribución de las inserciones curriculares MinEduc 2025-2026 por
          trimestre. El planificador IA usará esta matriz para sugerir
          automáticamente las inserciones al docente al generar planificaciones.
        </p>
      </div>

      <MatrizClient
        initialRows={rows as any}
        academicYearId={academicYearId}
        canEdit={canEdit}
      />
    </div>
  )
}
