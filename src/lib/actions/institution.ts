'use server'

// src/lib/actions/institution.ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { canManageFinances, getProfile } from '@/lib/auth/ownership'

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

export async function updateInstitutionFinancial(id: string, financial: any): Promise<{ error?: string, updated?: number }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const profile = await getProfile(user.id)
  if (!profile?.institution_id || profile.institution_id !== id || !canManageFinances(profile.role)) {
    return { error: 'Sin permiso' }
  }

  const admin = createAdminClient()
  
  // 1. Get current settings
  const { data: inst } = await (admin as any)
    .from('institutions')
    .select('settings')
    .eq('id', id)
    .single()
    
  const oldSettings = inst?.settings || {}
  const newSettings = { ...oldSettings, financial }
  
  // 2. Update
  const { error } = await (admin as any)
    .from('institutions')
    .update({ settings: newSettings })
    .eq('id', id)
    
  if (error) return { error: error.message }

  // 3. Auto-sync pending payments
  const syncResult = await syncPendingPayments(id)
  if (syncResult.error) return { error: syncResult.error }
  
  revalidatePath('/dashboard/secretaria')
  return { updated: syncResult.updated || 0 }
}

async function syncPendingPayments(institutionId: string): Promise<{ updated?: number, error?: string }> {
  const admin = createAdminClient()
  
  // 1. Get settings
  const { data: inst } = await (admin as any)
    .from('institutions')
    .select('settings')
    .eq('id', institutionId)
    .single()
    
  const financial = inst?.settings?.financial || {
    matutina:   { matricula: 35, pension: 60 },
    vespertina: { matricula: 35, pension: 60 }
  }
  
  // 2. Get students and their shifts
  const { data: courses } = await (admin as any)
    .from('courses')
    .select('id, name, parallel, shift')
    .eq('institution_id', institutionId)
    
  const courseIds = courses?.map((c: any) => c.id) || []
  
  const { data: enrollments } = await (admin as any)
    .from('enrollments')
    .select('student_id, course_id')
    .in('course_id', courseIds)
    
  const shiftsByStudent: Record<string, string> = {}
  const coursesById: Record<string, any> = {}
  courses?.forEach((c: any) => { coursesById[c.id] = c })
  
  enrollments?.forEach((e: any) => {
    const c = coursesById[e.course_id]
    if (c) shiftsByStudent[e.student_id] = c.shift
  })
  
  const { data: scholarships } = await (admin as any)
    .from('student_scholarships')
    .select('id, student_id, amount_to_pay, active')
    .eq('institution_id', institutionId)
    .eq('active', true)

  const scholarshipsByStudent: Record<string, any> = {}
  scholarships?.forEach((scholarship: any) => {
    scholarshipsByStudent[scholarship.student_id] = scholarship
  })

  // Solo se sincronizan cobros pendientes; los pagados y parciales son historial contable.
  const { data: pending } = await (admin as any)
    .from('payments')
    .select('id, student_id, type, amount, status, scholarship_id')
    .eq('institution_id', institutionId)
    .eq('status', 'pendiente')
    .in('type', ['matricula', 'pension'])
    
  if (!pending || pending.length === 0) return { updated: 0 }
  
  const paymentIds = pending.map((payment: any) => payment.id)
  const { data: abonos } = await (admin as any)
    .from('payment_abonos')
    .select('payment_id')
    .eq('institution_id', institutionId)
    .in('payment_id', paymentIds)

  const paymentIdsWithAbonos = new Set((abonos || []).map((abono: any) => abono.payment_id))
  const updates: Array<{ id: string; amount: number; scholarship_id: string | null }> = []
  
  pending.forEach((p: any) => {
    if (paymentIdsWithAbonos.has(p.id)) return
    const shift = (shiftsByStudent[p.student_id]?.toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina') as 'matutina' | 'vespertina'
    const prices = financial[shift] || { matricula: 35, pension: 60 }
    const scholarship = p.type === 'pension' ? scholarshipsByStudent[p.student_id] : null
    const targetAmount = Number(scholarship ? scholarship.amount_to_pay : (p.type === 'matricula' ? prices.matricula : prices.pension))
    const scholarshipId = scholarship?.id || null
    
    if (Number(p.amount) !== targetAmount || (p.scholarship_id || null) !== scholarshipId) {
      updates.push({ id: p.id, amount: targetAmount, scholarship_id: scholarshipId })
    }
  })
  
  for (let start = 0; start < updates.length; start += 50) {
    const chunk = updates.slice(start, start + 50)
    const results = await Promise.all(chunk.map((update) =>
      (admin as any)
        .from('payments')
        .update({ amount: update.amount, scholarship_id: update.scholarship_id })
        .eq('id', update.id)
        .eq('institution_id', institutionId)
    ))

    const failed = results.find((result: any) => result.error)
    if (failed?.error) return { error: failed.error.message }
  }
  
  revalidatePath('/dashboard/secretaria')
  return { updated: updates.length }
}

export async function updateLibretasVisibility(id: string, isPublished: boolean): Promise<{ error?: string }> {
  const admin = createAdminClient()
  
  // 1. Get current settings
  const { data: inst } = await (admin as any)
    .from('institutions')
    .select('settings')
    .eq('id', id)
    .single()
    
  const oldSettings = inst?.settings || {}
  const newSettings = { ...oldSettings, libretas_published: isPublished }
  
  // 2. Update
  const { error } = await (admin as any)
    .from('institutions')
    .update({ settings: newSettings })
    .eq('id', id)
    
  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/libretas')
  return {}
}
