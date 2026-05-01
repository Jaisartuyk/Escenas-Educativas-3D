'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createInstitutionUser(data: {
  email: string
  password: string
  full_name: string
  dni: string
  role: 'student' | 'teacher' | 'secretary' | 'supervisor' | 'rector' | 'parent'
  institution_id: string
  course_id?: string  // Optional: auto-enroll student to this course
  parentAccount?: {
    full_name: string
    dni: string
    email?: string
    password: string
    phone?: string
    relationship: 'MADRE' | 'PADRE' | 'OTRO'
    is_primary?: boolean
  }
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

  const normalizeEmail = (value: string | undefined, fallbackDni: string) =>
    value?.trim() || `${fallbackDni.trim()}@classnova.local`

  const loadInstitutionSettings = async () => {
    const { data: inst, error } = await supabaseAdmin
      .from('institutions')
      .select('settings')
      .eq('id', data.institution_id)
      .single()

    if (error) return { error: error.message, settings: null as any }
    return { settings: (inst as any)?.settings || {}, error: null as string | null }
  }

  const resolveOrCreateParentUser = async (studentName: string) => {
    if (!data.parentAccount) return { parentUserId: null as string | null, warning: null as string | null, settings: null as any }

    const parentEmail = normalizeEmail(data.parentAccount.email, data.parentAccount.dni)
    const parentDni = data.parentAccount.dni.trim()
    let parentUserId: string | null = null
    let warning: string | null = null

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, institution_id, full_name, email')
      .eq('email', parentEmail)
      .maybeSingle()

    if (existingProfile) {
      if ((existingProfile as any).institution_id !== data.institution_id) {
        return { error: 'El correo del representante ya pertenece a otra institución.' }
      }
      if ((existingProfile as any).role !== 'parent') {
        return { error: 'El correo del representante ya existe con otro rol. Usa otro correo o ajusta esa cuenta primero.' }
      }
      parentUserId = (existingProfile as any).id
      warning = 'Se reutilizó una cuenta de representante existente y se la vinculó con el estudiante.'
    } else {
      const { data: authParent, error: authParentError } = await supabaseAdmin.auth.admin.createUser({
        email: parentEmail,
        password: data.parentAccount.password,
        email_confirm: true,
        user_metadata: { full_name: data.parentAccount.full_name, dni: parentDni }
      })

      if (authParentError) {
        if (authParentError.message.includes('already registered')) {
          return { error: 'El correo del representante ya está registrado. Usa ese acceso existente o define otro correo.' }
        }
        return { error: authParentError.message }
      }

      parentUserId = authParent.user.id

      const { error: parentProfileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: parentUserId,
          email: parentEmail,
          full_name: data.parentAccount.full_name,
          role: 'parent',
          institution_id: data.institution_id,
          plan: 'free'
        }, { onConflict: 'id' })

      if (parentProfileError) {
        return { error: 'Se creó la cuenta del representante, pero no se pudo vincular su perfil.' }
      }
    }

    if (!parentUserId) {
      return { error: 'No se pudo resolver la cuenta del representante.' }
    }

    const { error: linkError } = await supabaseAdmin
      .from('parent_links')
      .upsert({
        institution_id: data.institution_id,
        parent_id: parentUserId,
        child_id: newUserId,
        relationship: data.parentAccount.relationship,
        is_primary: data.parentAccount.is_primary ?? true,
      }, { onConflict: 'parent_id,child_id' })

    if (linkError) {
      return { error: `No se pudo crear el vínculo representante-estudiante: ${linkError.message}` }
    }

    const { settings, error: settingsError } = await loadInstitutionSettings()
    if (settingsError) return { error: settingsError }

    settings.directory = settings.directory || {}

    const relationship = data.parentAccount.relationship
    const studentMetaUpdate: Record<string, any> = {
      representative: relationship,
      emergency_phone: data.parentAccount.phone || undefined,
    }
    if (relationship === 'MADRE') {
      studentMetaUpdate.mother_name = data.parentAccount.full_name
      studentMetaUpdate.mother_email = parentEmail
      studentMetaUpdate.mother_phone = data.parentAccount.phone || ''
    } else if (relationship === 'PADRE') {
      studentMetaUpdate.father_name = data.parentAccount.full_name
      studentMetaUpdate.father_email = parentEmail
      studentMetaUpdate.father_phone = data.parentAccount.phone || ''
    } else {
      studentMetaUpdate.other_representative_name = data.parentAccount.full_name
    }

    settings.directory[newUserId] = {
      ...(settings.directory[newUserId] || {}),
      ...studentMetaUpdate,
    }

    settings.directory[parentUserId as string] = {
      ...(settings.directory[parentUserId as string] || {}),
      phone: data.parentAccount.phone || '',
      linked_student_id: newUserId,
      linked_student_name: studentName,
      parent_relationship: relationship,
      is_primary_representative: data.parentAccount.is_primary ?? true,
    }

    const { error: settingsSaveError } = await supabaseAdmin
      .from('institutions')
      .update({ settings })
      .eq('id', data.institution_id)

    if (settingsSaveError) {
      return { error: `Se creó el representante, pero no se pudo guardar su metadata: ${settingsSaveError.message}` }
    }

    return { parentUserId, warning, settings }
  }

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

  let warning: string | null = null
  if (data.role === 'student' && data.parentAccount) {
    const parentResult = await resolveOrCreateParentUser(data.full_name)
    if ((parentResult as any).error) {
      return { error: (parentResult as any).error, userId: newUserId }
    }
    warning = parentResult.warning || null
  }

  revalidatePath('/dashboard/academico')
  revalidatePath('/dashboard/secretaria')
  
  return { success: true, userId: newUserId, warning }
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

export async function updateUserPlan(userId: string, newPlan: string) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ plan: newPlan })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/planificador')
  revalidatePath('/superadmin')
  
  return { success: true }
}

export async function deleteInstitutionUser(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseKey) {
    return { error: 'Falta la clave de servicio para eliminar usuarios.' }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Al eliminar de auth.users, el trigger on delete cascade se encarga de profiles
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    console.error("Error al eliminar usuario:", error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/academico')
  revalidatePath('/dashboard/secretaria')
  
  return { success: true }
}
