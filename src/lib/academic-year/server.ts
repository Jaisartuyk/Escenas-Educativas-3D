// src/lib/academic-year/server.ts
// Helpers server-side para resolver el año lectivo que el usuario está viendo.
// Úsalo en pages SSR y API routes para filtrar datos o bloquear escrituras.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { VIEWING_YEAR_COOKIE } from '@/types/academic-year'

export interface YearContext {
  institutionId:  string | null
  currentYearId:  string | null
  viewingYearId:  string | null
  isReadOnly:     boolean            // true si viewing ≠ current
  hasInstitution: boolean            // false para planner_solo/orfanos
}

/**
 * Resuelve el contexto de año lectivo para el usuario autenticado.
 * - Si el usuario no tiene institución (planner_solo), devuelve contexto vacío
 *   y los filtros por año deben saltarse.
 * - Valida que la cookie apunte a un año real de la institución; si no, cae a current.
 */
export async function resolveYearContext(userId: string): Promise<YearContext> {
  const admin = createAdminClient()

  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('institution_id')
    .eq('id', userId)
    .maybeSingle()

  const institutionId = profile?.institution_id || null
  if (!institutionId) {
    return {
      institutionId:  null,
      currentYearId:  null,
      viewingYearId:  null,
      isReadOnly:     false,
      hasInstitution: false,
    }
  }

  const { data: years } = await (admin as any)
    .from('academic_years')
    .select('id, is_current')
    .eq('institution_id', institutionId)

  const yearList = (years || []) as Array<{ id: string; is_current: boolean }>
  const current  = yearList.find(y => y.is_current)
  const currentYearId = current?.id || null

  // Leer cookie
  let viewingYearId: string | null = currentYearId
  try {
    const cookieVal = cookies().get(VIEWING_YEAR_COOKIE)?.value
    if (cookieVal && yearList.some(y => y.id === cookieVal)) {
      viewingYearId = cookieVal
    }
  } catch {
    /* cookies() puede fallar fuera de request context */
  }

  return {
    institutionId,
    currentYearId,
    viewingYearId,
    isReadOnly:     !!viewingYearId && viewingYearId !== currentYearId,
    hasInstitution: true,
  }
}
