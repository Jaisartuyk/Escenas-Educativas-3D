'use server'
// src/lib/actions/planificaciones-manuales.ts
// CRUD para planificaciones manuales (editor rich-text por materia/curso).

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'

export type PlanManualStatus = 'borrador' | 'publicada'

export type PlanManualType = 'anual' | 'semanal' | 'diaria'

export type PlanManualRow = {
  id: string
  user_id: string
  institution_id: string
  subject_id: string | null
  course_id: string | null
  subject_name: string
  course_name: string
  title: string
  content_json: any
  content_html: string | null
  status: PlanManualStatus
  type: PlanManualType
  unit_number: number | null
  academic_year_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Crea una planificación manual vacía (o devuelve la existente si ya hay
 * una para la misma materia/curso/año del docente).
 */
export async function ensurePlanificacionManual(input: {
  subjectId: string
  courseId: string
  subjectName: string
  courseName: string
  type?: PlanManualType
  unitNumber?: number | null
  academicYearId?: string | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: prof } = await (sb as any)
    .from('profiles').select('institution_id').eq('id', user.id).single()
  if (!prof?.institution_id) return { ok: false, error: 'Sin institución asignada' }

  const type = input.type || 'anual'
  const unitNumber = input.unitNumber ?? null
  const academicYearId = input.academicYearId ?? null

  // Ver si ya existe.
  // PostgreSQL: NULL ≠ NULL, así que para columnas opcionales se usa .is('col', null)
  // en lugar de .eq('col', null) — sino la query nunca matchea filas existentes
  // y caemos en la unique constraint al insertar.
  let q = (sb as any)
    .from('planificaciones_manuales')
    .select('id')
    .eq('user_id', user.id)
    .eq('subject_id', input.subjectId)
    .eq('course_id', input.courseId)
    .eq('type', type)

  q = academicYearId === null
    ? q.is('academic_year_id', null)
    : q.eq('academic_year_id', academicYearId)

  q = unitNumber === null
    ? q.is('unit_number', null)
    : q.eq('unit_number', unitNumber)

  const { data: existing } = await q.maybeSingle()
  if (existing?.id) return { ok: true, id: existing.id }

  const typeLabel = type === 'anual' ? 'Anual' : type === 'semanal' ? 'Semanal' : 'Diaria'
  const unitLabel = unitNumber ? ` — Unidad ${unitNumber}` : ''
  const title = `Planificación ${typeLabel}: ${input.subjectName} — ${input.courseName}${unitLabel}`

  const { data, error } = await (sb as any)
    .from('planificaciones_manuales')
    .insert({
      user_id: user.id,
      institution_id: prof.institution_id,
      subject_id: input.subjectId,
      course_id: input.courseId,
      subject_name: input.subjectName,
      course_name: input.courseName,
      title,
      content_json: {},
      content_html: '',
      status: 'borrador',
      type,
      unit_number: unitNumber,
      academic_year_id: input.academicYearId ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/planificaciones')
  return { ok: true, id: data.id }
}

/**
 * Guarda el contenido JSON + HTML de la planificación.
 */
export async function savePlanificacionManual(input: {
  id: string
  contentJson: any
  contentHtml?: string
  title?: string
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const patch: any = {
    content_json: input.contentJson,
    content_html: input.contentHtml ?? null,
  }
  if (input.title) patch.title = input.title

  const { error } = await (sb as any)
    .from('planificaciones_manuales')
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/planificaciones')
  revalidatePath(`/dashboard/planificaciones/${input.id}`)
  return { ok: true }
}

/**
 * Cambia el estado: borrador ↔ publicada.
 */
export async function setPlanificacionManualStatus(input: {
  id: string
  status: PlanManualStatus
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await (sb as any)
    .from('planificaciones_manuales')
    .update({ status: input.status })
    .eq('id', input.id)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/planificaciones')
  return { ok: true }
}
