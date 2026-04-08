'use server'

// src/lib/actions/institution.ts
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createInstitution(name: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const code = 'EDU-' + generateJoinCode()

  // 1. Crear institución
  const { data: inst, error: instErr } = await (supabase as any)
    .from('institutions')
    .insert({ name: name.trim(), join_code: code })
    .select('id')
    .single()

  if (instErr) return { error: instErr.message }

  // 2. Actualizar perfil directamente (RLS deshabilitado)
  const { error: profErr } = await (supabase as any)
    .from('profiles')
    .update({ institution_id: inst.id, role: 'admin' })
    .eq('id', user.id)

  if (profErr) return { error: profErr.message }

  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function joinInstitution(code: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Buscar colegio
  const { data: inst, error: instErr } = await (supabase as any)
    .from('institutions')
    .select('id')
    .eq('join_code', code.trim().toUpperCase())
    .single()

  if (instErr || !inst) return { error: 'Código inválido o no encontrado' }

  // Actualizar perfil directamente (RLS deshabilitado)
  const { error: profErr } = await (supabase as any)
    .from('profiles')
    .update({ institution_id: inst.id, role: 'teacher' })
    .eq('id', user.id)

  if (profErr) return { error: profErr.message }

  revalidatePath('/dashboard', 'layout')
  return {}
}
