'use server'
// src/lib/actions/planner-setup.ts
import { createClient } from '@/lib/supabase/server'
import { agendarSesionesMultiples } from './calendario'

/**
 * Agendar automáticamente la Semana de Adaptación para una materia.
 * Supone que la planificación ya fue generada y tiene sesiones detectadas.
 */
export async function scheduleAdaptationWeek(input: {
  planificacionId: string
  mondayDate: string // YYYY-MM-DD del lunes de la semana 1
}) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // 1. Obtener la planificación y sus sesiones del metadata
  const { data: plan } = await (sb as any)
    .from('planificaciones')
    .select('id, metadata, subject')
    .eq('id', input.planificacionId)
    .single()

  if (!plan) return { ok: false, error: 'Planificación no encontrada' }

  // 2. Obtener la materia del planner para ver qué días se dicta
  const { data: subject } = await (sb as any)
    .from('planner_subjects')
    .select('days_of_week, weekly_hours')
    .eq('user_id', user.id)
    .eq('materia', plan.subject) // Usamos el nombre como enlace
    .maybeSingle()

  if (!subject || !subject.days_of_week || subject.days_of_week.length === 0) {
    return { ok: false, error: `No has configurado los días de clase para ${plan.subject}` }
  }

  const sesiones = (plan.metadata as any)?.sesiones || []
  if (sesiones.length === 0) {
    return { ok: false, error: 'La planificación no tiene sesiones detectadas para agendar.' }
  }

  // 3. Mapear sesiones a fechas según days_of_week
  // El docente dicta N horas en días [D1, D2, ...].
  // Mapeamos Sesión 1 -> D1, Sesión 2 -> D2...
  const asignaciones: Array<{ sesionNumero: number; fechaInicio: string }> = []
  const startMonday = new Date(input.mondayDate)

  sesiones.forEach((s: any, index: number) => {
    // Tomamos el día correspondiente de days_of_week (cíclico si hay más sesiones que días, pero lo ideal es 1:1)
    const dayOffset = subject.days_of_week[index % subject.days_of_week.length] - 1 // 0=Lun, 1=Mar...
    
    const sessionDate = new Date(startMonday)
    sessionDate.setDate(startMonday.getDate() + dayOffset)
    
    asignaciones.push({
      sesionNumero: s.numero,
      fechaInicio: sessionDate.toISOString().split('T')[0]
    })
  })

  // 4. Llamar a agendarSesionesMultiples
  return await agendarSesionesMultiples({
    planificacionId: plan.id,
    asignaciones,
    notas: 'Semana de Adaptación (Programada automáticamente)'
  })
}
