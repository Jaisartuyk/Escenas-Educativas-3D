'use server'
// src/lib/actions/planner-ia.ts
// Toggles del Planificador IA (servicio opcional para instituciones).

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireSuperAdmin(): Promise<{ ok: boolean; error?: string }> {
  const sb = createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }
  const superAdminEmail = process.env.SUPERADMIN_EMAIL
  if (!superAdminEmail || user.email !== superAdminEmail) {
    return { ok: false, error: 'Solo el SuperAdmin puede modificar habilitaciones del Planificador IA' }
  }
  return { ok: true }
}

/**
 * Habilita o deshabilita el Planificador IA para una institución completa.
 * Si se deshabilita la institución, todos sus docentes pierden acceso aunque
 * tengan profiles.planner_ia_enabled = true (la regla efectiva es AND).
 */
export async function togglePlannerForInstitution(
  institutionId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard

  const a = admin()
  const { error } = await (a as any)
    .from('institutions')
    .update({ planner_ia_enabled: enabled })
    .eq('id', institutionId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/superadmin')
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Habilita o deshabilita el Planificador IA para un docente específico.
 * Solo tiene efecto si la institución del docente también está habilitada.
 */
export async function togglePlannerForTeacher(
  userId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard

  const a = admin()
  const { error } = await (a as any)
    .from('profiles')
    .update({ planner_ia_enabled: enabled })
    .eq('id', userId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/superadmin')
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Habilita el Planificador IA para TODOS los docentes de una institución
 * (operación masiva). Útil cuando una institución contrata el servicio.
 */
export async function bulkTogglePlannerForInstitutionTeachers(
  institutionId: string,
  enabled: boolean,
): Promise<{ ok: boolean; updated?: number; error?: string }> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard

  const a = admin()
  const { data, error } = await (a as any)
    .from('profiles')
    .update({ planner_ia_enabled: enabled })
    .eq('institution_id', institutionId)
    .in('role', ['teacher', 'rector', 'supervisor'])
    .select('id')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/superadmin')
  revalidatePath('/dashboard')
  return { ok: true, updated: (data || []).length }
}
