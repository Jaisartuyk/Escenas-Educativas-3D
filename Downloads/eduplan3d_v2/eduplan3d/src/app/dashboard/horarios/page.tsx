// src/app/dashboard/horarios/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { HorariosClient } from '@/components/horarios/HorariosClient'

export const metadata: Metadata = { title: 'Horarios' }

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

// Roles que pueden VER los horarios (pero NO editarlos)
const READONLY_ROLES = new Set(['secretary'])
// Roles que pueden EDITAR los horarios
const EDIT_ROLES = new Set(['admin', 'assistant', 'rector', 'horarios_only'])

export default async function HorariosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')

  const role = profile.role || ''
  const canAccess = EDIT_ROLES.has(role) || READONLY_ROLES.has(role)
  if (!canAccess) redirect('/dashboard')

  const readOnly = READONLY_ROLES.has(role)

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {readOnly ? 'Horarios' : 'Generador de Horarios'}
        </h1>
        <p className="text-ink3 text-sm mt-1">
          {readOnly
            ? 'Consulta y descarga los horarios de la institución.'
            : 'Crea y edita horarios automáticamente — sin choques de docentes'}
        </p>
      </div>
      <HorariosClient readOnly={readOnly} />
    </div>
  )
}
