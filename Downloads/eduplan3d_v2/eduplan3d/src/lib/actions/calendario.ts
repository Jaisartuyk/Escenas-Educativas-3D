'use server'
// src/lib/actions/calendario.ts
// Server actions del calendario docente: agendar/mover/desagendar planificaciones.

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'

export type AgendaEntry = {
  id: string
  user_id: string
  planificacion_id: string
  fecha_inicio: string  // YYYY-MM-DD
  fecha_fin: string | null
  grupo: string | null
  notas: string | null
  sesion_numero: number | null
  created_at: string
  updated_at: string
}

export type AgendaEntryWithPlan = AgendaEntry & {
  planificacion: {
    id: string
    title: string
    subject: string
    grade: string
    topic: string
    type: string
    grupo?: string | null
    metadata?: any
    content?: string | null
  } | null
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Agendar una planificación a una fecha (drag & drop desde sidebar).
 */
export async function agendarPlanificacion(input: {
  planificacionId: string
  fechaInicio: string  // YYYY-MM-DD
  fechaFin?: string | null
  grupo?: string | null
  notas?: string | null
  sesionNumero?: number | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // Verifica que la planificación pertenezca al usuario (RLS lo refuerza igual).
  const { data: plan } = await (sb as any)
    .from('planificaciones')
    .select('id, user_id')
    .eq('id', input.planificacionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!plan) return { ok: false, error: 'Planificación no encontrada' }

  const { data, error } = await (sb as any)
    .from('planificacion_calendario')
    .insert({
      user_id: user.id,
      planificacion_id: input.planificacionId,
      fecha_inicio: input.fechaInicio,
      fecha_fin: input.fechaFin ?? null,
      grupo: input.grupo ?? null,
      notas: input.notas ?? null,
      sesion_numero: input.sesionNumero ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/calendario')
  return { ok: true, id: data.id }
}

/**
 * Agendar múltiples sesiones de una misma planificación en un solo batch.
 * Útil al arrastrar una planificación con N sesiones al calendario.
 */
export async function agendarSesionesMultiples(input: {
  planificacionId: string
  asignaciones: Array<{ sesionNumero: number; fechaInicio: string }>
  grupo?: string | null
  notas?: string | null
}): Promise<{ ok: boolean; ids?: string[]; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  if (!Array.isArray(input.asignaciones) || input.asignaciones.length === 0) {
    return { ok: false, error: 'Sin asignaciones de sesiones' }
  }

  const { data: plan } = await (sb as any)
    .from('planificaciones')
    .select('id, user_id')
    .eq('id', input.planificacionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!plan) return { ok: false, error: 'Planificación no encontrada' }

  const rows = input.asignaciones.map(a => ({
    user_id: user.id,
    planificacion_id: input.planificacionId,
    fecha_inicio: a.fechaInicio,
    fecha_fin: null,
    grupo: input.grupo ?? null,
    notas: input.notas ?? null,
    sesion_numero: a.sesionNumero,
  }))

  const { data, error } = await (sb as any)
    .from('planificacion_calendario')
    .insert(rows)
    .select('id')

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/calendario')
  return { ok: true, ids: (data || []).map((r: any) => r.id) }
}

/**
 * Mover una entrada del calendario a otra fecha (drag entre días).
 */
export async function moverEntrada(input: {
  entryId: string
  fechaInicio: string
  fechaFin?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await (sb as any)
    .from('planificacion_calendario')
    .update({
      fecha_inicio: input.fechaInicio,
      fecha_fin: input.fechaFin ?? null,
    })
    .eq('id', input.entryId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/calendario')
  return { ok: true }
}

/**
 * Editar grupo / notas de una entrada.
 */
export async function actualizarEntrada(input: {
  entryId: string
  grupo?: string | null
  notas?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const patch: any = {}
  if (input.grupo !== undefined) patch.grupo = input.grupo
  if (input.notas !== undefined) patch.notas = input.notas

  const { error } = await (sb as any)
    .from('planificacion_calendario')
    .update(patch)
    .eq('id', input.entryId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/calendario')
  return { ok: true }
}

/**
 * Quitar una entrada del calendario (no borra la planificación).
 */
export async function desagendarEntrada(entryId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await (sb as any)
    .from('planificacion_calendario')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/calendario')
  return { ok: true }
}

/**
 * Listar entradas en un rango de fechas con la planificación adjunta.
 */
export async function listarRango(input: {
  desde: string  // YYYY-MM-DD
  hasta: string
  grupo?: string | null
  asignatura?: string | null
}): Promise<AgendaEntryWithPlan[]> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []

  let query = (sb as any)
    .from('planificacion_calendario')
    .select(`
      id, user_id, planificacion_id, fecha_inicio, fecha_fin, grupo, notas, sesion_numero, created_at, updated_at,
      planificacion:planificaciones (
        id, title, subject, grade, topic, type, grupo, metadata, content
      )
    `)
    .eq('user_id', user.id)
    .gte('fecha_inicio', input.desde)
    .lte('fecha_inicio', input.hasta)
    .order('fecha_inicio', { ascending: true })

  if (input.grupo) query = query.eq('grupo', input.grupo)

  const { data, error } = await query
  if (error) return []

  let rows = (data || []) as AgendaEntryWithPlan[]
  if (input.asignatura) {
    rows = rows.filter(r => r.planificacion?.subject === input.asignatura)
  }
  return rows
}

/**
 * Helper: rango Lun-Dom de la semana que contiene `date`.
 */
export async function rangoSemana(date: Date): Promise<{ desde: string; hasta: string }> {
  const d = new Date(date)
  const dow = d.getDay()              // 0=dom, 1=lun, ..., 6=sab
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { desde: ymd(monday), hasta: ymd(sunday) }
}
