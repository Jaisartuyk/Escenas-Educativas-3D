'use server'

// src/lib/actions/institution.ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createInstitution(name: string) {
  const supabase = createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const code = 'EDU-' + generateJoinCode()

  // 1. Crear institución (con admin para saltarse RLS)
  const { data: inst, error: instErr } = await admin
    .from('institutions')
    .insert({ name: name.trim(), join_code: code })
    .select('id')
    .single()
    
  if (instErr) throw new Error('Error al crear institución: ' + instErr.message)

  // 2. Vincular usuario actual como admin (con admin para actualizar profiles)
  const { error: profErr } = await admin
    .from('profiles')
    .update({ institution_id: inst.id, role: 'admin' })
    .eq('id', user.id)
    
  if (profErr) throw new Error('Error al vincular perfil: ' + profErr.message)

  revalidatePath('/dashboard', 'layout')
  return true
}

export async function joinInstitution(code: string) {
  const supabase = createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // 1. Buscar colegio por código
  const { data: inst, error: instErr } = await admin
    .from('institutions')
    .select('id, name')
    .eq('join_code', code.trim().toUpperCase())
    .single()
    
  if (instErr || !inst) throw new Error('Código de institución inválido o no encontrado')

  // 2. Vincular como docente
  const { error: profErr } = await admin
    .from('profiles')
    .update({ institution_id: inst.id, role: 'teacher' })
    .eq('id', user.id)
    
  if (profErr) throw new Error('Error al unirse a la institución: ' + profErr.message)

  revalidatePath('/dashboard', 'layout')
  return true
}
