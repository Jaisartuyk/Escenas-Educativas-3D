'use server'
// src/lib/actions/inserciones-distribucion.ts
// CRUD de la Matriz Anual de Inserciones Curriculares.
// Admin/rector configura qué inserciones se trabajan en cada trimestre.
// El planificador IA lee esta matriz al generar planificaciones.

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { InsercionId } from '@/lib/pedagogy/inserciones'

const ADMIN_ROLES = ['admin', 'assistant', 'rector']

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdminOfInst(): Promise<{ ok: boolean; userId?: string; institutionId?: string; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }
  const { data: prof } = await (sb as any)
    .from('profiles').select('institution_id, role').eq('id', user.id).single()
  if (!prof?.institution_id) return { ok: false, error: 'Sin institución' }
  if (!ADMIN_ROLES.includes(prof.role)) {
    return { ok: false, error: 'Solo administración / rectoría puede modificar la matriz.' }
  }
  return { ok: true, userId: user.id, institutionId: prof.institution_id }
}

export type DistribucionRow = {
  trimestre: 1 | 2 | 3
  inserciones: InsercionId[]
}

/**
 * Devuelve la matriz institucional (3 filas — trimestres 1/2/3).
 * Si no existe alguna fila, devuelve inserciones=[].
 * Filtra opcionalmente por academic_year_id (NULL incluido como fallback).
 */
export async function getInstitutionalMatriz(input: {
  academicYearId?: string | null
}): Promise<{ ok: boolean; rows?: DistribucionRow[]; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: prof } = await (sb as any)
    .from('profiles').select('institution_id').eq('id', user.id).single()
  if (!prof?.institution_id) return { ok: false, error: 'Sin institución' }

  const academicYearId = input.academicYearId ?? null

  let q = (sb as any)
    .from('inserciones_distribucion')
    .select('trimestre, inserciones, academic_year_id')
    .eq('institution_id', prof.institution_id)
    .is('course_id', null)
    .is('subject_id', null)

  if (academicYearId === null) {
    q = q.is('academic_year_id', null)
  } else {
    q = q.eq('academic_year_id', academicYearId)
  }

  const { data, error } = await q
  if (error) return { ok: false, error: error.message }

  const byTrim = new Map<number, InsercionId[]>()
  ;(data || []).forEach((r: any) => {
    byTrim.set(r.trimestre, (r.inserciones || []) as InsercionId[])
  })

  const rows: DistribucionRow[] = [1, 2, 3].map(t => ({
    trimestre: t as 1 | 2 | 3,
    inserciones: byTrim.get(t) || [],
  }))

  return { ok: true, rows }
}

/**
 * Upsert de la fila de un trimestre concreto (institucional, sin curso/materia).
 */
export async function setTrimestreInserciones(input: {
  trimestre: 1 | 2 | 3
  inserciones: InsercionId[]
  academicYearId?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOfInst()
  if (!guard.ok || !guard.institutionId) return { ok: false, error: guard.error }

  const a = admin()
  const academicYearId = input.academicYearId ?? null

  // Verificar si ya existe la fila
  let q = (a as any)
    .from('inserciones_distribucion')
    .select('id')
    .eq('institution_id', guard.institutionId)
    .is('course_id', null)
    .is('subject_id', null)
    .eq('trimestre', input.trimestre)
  q = academicYearId === null ? q.is('academic_year_id', null) : q.eq('academic_year_id', academicYearId)
  const { data: existing } = await q.maybeSingle()

  if (existing?.id) {
    const { error } = await (a as any)
      .from('inserciones_distribucion')
      .update({ inserciones: input.inserciones })
      .eq('id', existing.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await (a as any)
      .from('inserciones_distribucion')
      .insert({
        institution_id: guard.institutionId,
        course_id: null,
        subject_id: null,
        trimestre: input.trimestre,
        inserciones: input.inserciones,
        academic_year_id: academicYearId,
        created_by: guard.userId ?? null,
      })
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/academico')
  revalidatePath('/dashboard/inserciones-distribucion')
  return { ok: true }
}
