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

  // 2. Upsert perfil — crea si no existe, actualiza si existe
  const { error: profErr } = await (supabase as any)
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0],
      institution_id: inst.id,
      role: 'admin',
      plan: 'free',
    }, { onConflict: 'id' })

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
    .update({ institution_id: inst.id, role: 'student' })
    .eq('id', user.id)

  if (profErr) return { error: profErr.message }

  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function updateInstitutionFinancial(id: string, financial: any): Promise<{ error?: string }> {
  const supabase = createClient()
  
  // 1. Get current settings
  const { data: inst } = await (supabase as any)
    .from('institutions')
    .select('settings')
    .eq('id', id)
    .single()
    
  const oldSettings = inst?.settings || {}
  const newSettings = { ...oldSettings, financial }
  
  // 2. Update
  const { error } = await (supabase as any)
    .from('institutions')
    .update({ settings: newSettings })
    .eq('id', id)
    
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/secretaria')
  return {}
}

export async function syncPendingPayments(institutionId: string): Promise<{ updated?: number, error?: string }> {
  const supabase = createClient()
  
  // 1. Get settings
  const { data: inst } = await (supabase as any)
    .from('institutions')
    .select('settings')
    .eq('id', institutionId)
    .single()
    
  const financial = inst?.settings?.financial
  if (!financial) return { error: 'No hay configuración financiera definida' }
  
  // 2. Get students and their shifts
  const { data: courses } = await (supabase as any)
    .from('courses')
    .select('id, shift')
    .eq('institution_id', institutionId)
    
  const { data: enrollments } = await (supabase as any)
    .from('enrollments')
    .select('student_id, course_id')
    
  const shiftsByStudent: Record<string, string> = {}
  const coursesById: Record<string, any> = {}
  courses?.forEach((c: any) => { coursesById[c.id] = c })
  
  enrollments?.forEach((e: any) => {
    const c = coursesById[e.course_id]
    if (c) shiftsByStudent[e.student_id] = c.shift
  })
  
  // 3. Get pending payments (only matricula and pension)
  const { data: pending } = await (supabase as any)
    .from('payments')
    .select('id, student_id, type, amount')
    .eq('institution_id', institutionId)
    .eq('status', 'pendiente')
    .in('type', ['matricula', 'pension'])
    
  if (!pending || pending.length === 0) return { updated: 0 }
  
  let updatedCount = 0
  const updates: any[] = []
  
  pending.forEach((p: any) => {
    const shift = (shiftsByStudent[p.student_id]?.toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina') as 'matutina' | 'vespertina'
    const prices = financial[shift] || { matricula: 35, pension: 60 }
    const targetAmount = p.type === 'matricula' ? prices.matricula : prices.pension
    
    if (p.amount !== targetAmount) {
      updates.push({ id: p.id, amount: targetAmount })
      updatedCount++
    }
  })
  
  // 4. Batch update
  if (updates.length > 0) {
    // Supabase JS doesn't support batch update with different values easily without multiple calls
    // but we can use upsert if we provide the full keys
    const { error } = await (supabase as any)
      .from('payments')
      .upsert(updates.map(u => ({ id: u.id, amount: u.amount })), { onConflict: 'id' })
      
    if (error) return { error: error.message }
  }
  
  revalidatePath('/dashboard/secretaria')
  return { updated: updatedCount }
}
