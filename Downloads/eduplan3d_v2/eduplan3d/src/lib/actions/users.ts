'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createInstitutionUser(data: {
  email: string
  password: string
  full_name: string
  dni: string
  role: 'student' | 'teacher' | 'secretary' | 'supervisor'
  institution_id: string
  course_id?: string  // Optional: auto-enroll student to this course
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseKey) {
    return { error: 'Falta la clave de servicio (SERVICE_ROLE_KEY) en las variables de entorno para crear usuarios.' }
  }

  // Usamos el cliente de admin para saltarnos RLS y poder crear usuarios en Auth
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 1. Crear el usuario en Supabase Auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // Auto-confirmar para que puedan entrar de una vez
    user_metadata: { full_name: data.full_name, dni: data.dni }
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Este correo electrónico ya está registrado.' }
    }
    return { error: authError.message }
  }

  const newUserId = authUser.user.id

  // 2. Insertar/Actualizar en Profiles con el rol y la institución
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: newUserId,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      institution_id: data.institution_id,
      plan: 'free'
    }, { onConflict: 'id' })

  if (profileError) {
    console.error("Error al crear perfil:", profileError)
    return { error: 'Se creó la cuenta pero hubo un error vinculando el perfil. Notifique a soporte.' }
  }

  // 3. Auto-matricular al estudiante si se proporcionó un curso
  if (data.role === 'student' && data.course_id) {
    await supabaseAdmin
      .from('enrollments')
      .upsert({ student_id: newUserId, course_id: data.course_id }, { onConflict: 'student_id,course_id' })
  }

  revalidatePath('/dashboard/academico')
  revalidatePath('/dashboard/secretaria')
  
  return { success: true, userId: newUserId }
}

export async function updateUserEmail(userId: string, newEmail: string) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update in auth.users
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail })
  if (authError) return { error: authError.message }

  // Update in profiles
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', userId)

  if (profileError) return { error: profileError.message }

  revalidatePath('/dashboard/institucion')
  return { success: true }
}

export async function updateProfileMetadata(institutionId: string, userId: string, metadata: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: inst, error: fetchErr } = await supabase.from('institutions').select('settings').eq('id', institutionId).single()
  if (fetchErr) return { error: fetchErr.message }

  const settings = inst.settings || {}
  settings.directory = settings.directory || {}
  settings.directory[userId] = { ...(settings.directory[userId] || {}), ...metadata }

  const { error } = await supabase.from('institutions').update({ settings }).eq('id', institutionId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/academico')
  return { success: true }
}
