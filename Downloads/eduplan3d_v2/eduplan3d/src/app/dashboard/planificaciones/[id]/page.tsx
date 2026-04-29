// src/app/dashboard/planificaciones/[id]/page.tsx
// Editor rich-text de una planificación manual (TipTap, plantilla MinEduc).

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlanEditorClient } from '@/components/planificaciones/PlanEditorClient'

export const dynamic = 'force-dynamic'

export default async function PlanificacionManualPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: plan } = await (admin as any)
    .from('planificaciones_manuales')
    .select('id, user_id, institution_id, title, subject_name, course_name, status, type, unit_number, content_json, content_html, updated_at, supervisor_notes, supervisor_notes_updated_at')
    .eq('id', params.id)
    .single()

  if (!plan) redirect('/dashboard/planificaciones')

  // Solo el dueño puede editar (admin/rector ven en otro apartado, Fase 5)
  if (plan.user_id !== user.id) redirect('/dashboard/planificaciones')

  // Datos de la institución para el header del documento
  const { data: inst } = await (admin as any)
    .from('institutions')
    .select('name, settings')
    .eq('id', plan.institution_id)
    .single()

  const institutionName = inst?.name || 'Institución Educativa'
  const settings = (inst?.settings as any) || {}
  // Logo: prioriza settings.logo_url; fallback a hardcoded LETAMENDI o null
  const logoUrl: string | null =
    settings?.logo_url
      ?? (institutionName.toUpperCase().includes('LETAMENDI') ? '/icon/logo-institucion.png' : null)

  // Datos del docente para el header
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <PlanEditorClient
      plan={{
        id: plan.id,
        title: plan.title,
        subjectName: plan.subject_name,
        courseName: plan.course_name,
        status: plan.status,
        type: plan.type,
        unitNumber: plan.unit_number,
        contentJson: plan.content_json,
        updatedAt: plan.updated_at,
        supervisorNotes: (plan as any).supervisor_notes ?? null,
        supervisorNotesUpdatedAt: (plan as any).supervisor_notes_updated_at ?? null,
      }}
      institutionName={institutionName}
      logoUrl={logoUrl}
      teacherName={profile?.full_name || ''}
    />
  )
}
