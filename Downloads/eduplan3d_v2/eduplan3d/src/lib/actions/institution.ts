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

  // Usar RPC con SECURITY DEFINER para saltarse RLS
  const { data, error } = await (supabase as any).rpc('create_institution_for_user', {
    inst_name: name.trim(),
    inst_code: code,
    calling_user_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function joinInstitution(code: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Buscar colegio por código
  const { data: inst, error: instErr } = await (supabase as any)
    .from('institutions')
    .select('id')
    .eq('join_code', code.trim().toUpperCase())
    .single()

  if (instErr || !inst) return { error: 'Código inválido o no encontrado' }

  // Usar RPC para unirse
  const { error } = await (supabase as any).rpc('join_institution_for_user', {
    inst_id: inst.id,
    user_role: 'teacher',
    calling_user_id: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard', 'layout')
  return {}
}
