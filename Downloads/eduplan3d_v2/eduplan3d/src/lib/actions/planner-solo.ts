'use server'
// src/lib/actions/planner-solo.ts
// Server action para crear docentes externos (planner_solo) sin institución

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export async function createPlannerSoloUser(data: {
  full_name: string
  email: string
  password: string
}) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Configuración del servidor incompleta.' }
  }

  // 1. Crear usuario en Supabase Auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name }
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Este correo ya tiene una cuenta. Inicia sesión.' }
    }
    return { error: authError.message }
  }

  // 2. Crear perfil sin institution_id (docente externo independiente)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id:             authUser.user.id,
      email:          data.email,
      full_name:      data.full_name,
      role:           'teacher',
      plan:           'planner_solo',
      institution_id: null,
    }, { onConflict: 'id' })

  if (profileError) {
    return { error: 'Cuenta creada pero error en el perfil. Contacta soporte.' }
  }

  return { success: true }
}
