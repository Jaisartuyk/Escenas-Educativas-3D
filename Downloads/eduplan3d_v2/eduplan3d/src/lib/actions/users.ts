'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'

const LETAMENDI_NAME = 'UNIDAD EDUCATIVA PARTICULAR CORONEL MIGUEL DE LETAMENDI'

function normalizeInstitutionName(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

async function getActorContext() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', user: null, profile: null, institutionName: null }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Perfil no encontrado', user, profile: null, institutionName: null }

  const { data: institution } = await (supabase as any)
    .from('institutions')
    .select('name')
    .eq('id', (profile as any).institution_id)
    .maybeSingle()

  return {
    error: null,
    user,
    profile,
    institutionName: (institution as any)?.name || null,
  }
}

function isRestrictedLetamendiSecretary(role: string | null | undefined, institutionName: string | null | undefined) {
  return role === 'secretary' && normalizeInstitutionName(institutionName) === LETAMENDI_NAME
}

function buildParentLogin(email: string | undefined, dni: string | undefined, studentId: string, relationship: 'MADRE' | 'PADRE' | 'OTRO') {
  const normalizedEmail = email?.trim()
  if (normalizedEmail) return normalizedEmail
  const normalizedDni = dni?.trim()
  if (normalizedDni) return `${normalizedDni}@classnova.local`
  return `parent.${relationship.toLowerCase()}.${studentId}@classnova.local`
}

async function loadInstitutionSettings(
  supabaseAdmin: any,
  institutionId: string,
) {
  const { data: inst, error } = await supabaseAdmin
    .from('institutions')
    .select('settings')
    .eq('id', institutionId)
    .single()

  if (error) return { error: error.message, settings: null as any }
  return { settings: (inst as any)?.settings || {}, error: null as string | null }
}

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
  const actor = await getActorContext()
  if (actor.error || !actor.profile) {
    return { error: actor.error || 'No autenticado' }
  }

  if ((actor.profile as any).institution_id !== data.institution_id) {
    return { error: 'No autorizado para esta institución.' }
  }

  if (isRestrictedLetamendiSecretary((actor.profile as any).role, actor.institutionName) && data.role !== 'student') {
    return { error: 'En Letamendi, secretaría solo puede crear alumnos.' }
  }

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
      studentMetaUpdate.mother_dni = parentDni
      studentMetaUpdate.mother_parent_user_id = parentUserId
      studentMetaUpdate.mother_parent_login = parentEmail
    } else if (relationship === 'PADRE') {
      studentMetaUpdate.father_name = data.parentAccount.full_name
      studentMetaUpdate.father_email = parentEmail
      studentMetaUpdate.father_phone = data.parentAccount.phone || ''
      studentMetaUpdate.father_dni = parentDni
      studentMetaUpdate.father_parent_user_id = parentUserId
      studentMetaUpdate.father_parent_login = parentEmail
    } else {
      studentMetaUpdate.other_representative_name = data.parentAccount.full_name
      studentMetaUpdate.other_representative_email = parentEmail
      studentMetaUpdate.other_representative_phone = data.parentAccount.phone || ''
      studentMetaUpdate.other_representative_dni = parentDni
      studentMetaUpdate.other_parent_user_id = parentUserId
      studentMetaUpdate.other_parent_login = parentEmail
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

export async function createParentAccessFromStudentProfile(data: {
  institution_id: string
  student_id: string
  relationship: 'MADRE' | 'PADRE' | 'OTRO'
  full_name?: string
  dni?: string
  email?: string
  phone?: string
  password: string
  is_primary?: boolean
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseKey) {
    return { error: 'Falta la clave de servicio para crear accesos de representantes.' }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { settings, error: settingsError } = await loadInstitutionSettings(supabaseAdmin, data.institution_id)
  if (settingsError) return { error: settingsError }

  settings.directory = settings.directory || {}

  const studentMeta = settings.directory[data.student_id] || {}

  const fallbackName =
    data.relationship === 'MADRE'
      ? studentMeta.mother_name
      : data.relationship === 'PADRE'
      ? studentMeta.father_name
      : studentMeta.other_representative_name

  const fallbackEmail =
    data.relationship === 'MADRE'
      ? studentMeta.mother_email
      : data.relationship === 'PADRE'
      ? studentMeta.father_email
      : studentMeta.other_representative_email

  const fallbackPhone =
    data.relationship === 'MADRE'
      ? studentMeta.mother_phone
      : data.relationship === 'PADRE'
      ? studentMeta.father_phone
      : studentMeta.other_representative_phone

  const fallbackDni =
    data.relationship === 'MADRE'
      ? studentMeta.mother_dni
      : data.relationship === 'PADRE'
      ? studentMeta.father_dni
      : studentMeta.other_representative_dni

  const representativeName = (data.full_name || fallbackName || '').trim()
  const representativeDni = (data.dni || fallbackDni || '').trim()
  const representativeEmail = (data.email || fallbackEmail || '').trim()
  const representativePhone = (data.phone || fallbackPhone || '').trim()

  if (!representativeName) {
    return { error: 'Necesitamos el nombre del representante para crear su acceso.' }
  }
  if (!data.password?.trim()) {
    return { error: 'Necesitamos una contraseña inicial para el representante.' }
  }

  const { data: studentProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, institution_id')
    .eq('id', data.student_id)
    .single()

  if (!studentProfile || (studentProfile as any).institution_id !== data.institution_id) {
    return { error: 'No se encontró el estudiante dentro de esta institución.' }
  }

  const parentEmail = buildParentLogin(representativeEmail, representativeDni, data.student_id, data.relationship)

  let parentUserId: string | null = null
  let warning: string | null = null

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, institution_id, full_name, email')
    .eq('email', parentEmail)
    .maybeSingle()

  if (existingProfile) {
    if ((existingProfile as any).institution_id !== data.institution_id) {
      return { error: 'El correo o usuario del representante ya pertenece a otra institución.' }
    }
    if ((existingProfile as any).role !== 'parent') {
      return { error: 'Ese correo o usuario ya existe con otro rol. Usa otro acceso o corrige esa cuenta primero.' }
    }
    parentUserId = (existingProfile as any).id
    warning = 'Se reutilizó una cuenta de representante existente y se la vinculó con este estudiante.'
  } else {
    const { data: authParent, error: authParentError } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: representativeName, dni: representativeDni }
    })

    if (authParentError) {
      if (authParentError.message.includes('already registered')) {
        return { error: 'El correo o usuario del representante ya está registrado. Usa ese acceso existente o define otro correo.' }
      }
      return { error: authParentError.message }
    }

    parentUserId = authParent.user.id

    const { error: parentProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: parentUserId,
        email: parentEmail,
        full_name: representativeName,
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
      child_id: data.student_id,
      relationship: data.relationship,
      is_primary: data.is_primary ?? true,
    }, { onConflict: 'parent_id,child_id' })

  if (linkError) {
    return { error: `No se pudo crear el vínculo representante-estudiante: ${linkError.message}` }
  }

  const studentPatch: Record<string, any> = {
    representative: studentMeta.representative || data.relationship,
  }
  const parentPatch: Record<string, any> = {
    phone: representativePhone,
    linked_student_id: data.student_id,
    linked_student_name: (studentProfile as any).full_name,
    parent_relationship: data.relationship,
    is_primary_representative: data.is_primary ?? true,
  }

  if (data.relationship === 'MADRE') {
    Object.assign(studentPatch, {
      mother_name: representativeName,
      mother_email: representativeEmail || parentEmail,
      mother_phone: representativePhone,
      mother_dni: representativeDni,
      mother_parent_user_id: parentUserId,
      mother_parent_login: parentEmail,
    })
  } else if (data.relationship === 'PADRE') {
    Object.assign(studentPatch, {
      father_name: representativeName,
      father_email: representativeEmail || parentEmail,
      father_phone: representativePhone,
      father_dni: representativeDni,
      father_parent_user_id: parentUserId,
      father_parent_login: parentEmail,
    })
  } else {
    Object.assign(studentPatch, {
      representative: 'OTRO',
      other_representative_name: representativeName,
      other_representative_email: representativeEmail || parentEmail,
      other_representative_phone: representativePhone,
      other_representative_dni: representativeDni,
      other_parent_user_id: parentUserId,
      other_parent_login: parentEmail,
    })
  }

  settings.directory[data.student_id] = {
    ...studentMeta,
    ...studentPatch,
  }

  settings.directory[parentUserId] = {
    ...(settings.directory[parentUserId] || {}),
    ...parentPatch,
  }

  const { error: saveSettingsError } = await supabaseAdmin
    .from('institutions')
    .update({ settings })
    .eq('id', data.institution_id)

  if (saveSettingsError) {
    return { error: `Se creó el representante, pero no se pudo guardar su metadata: ${saveSettingsError.message}` }
  }

  revalidatePath('/dashboard/academico')
  revalidatePath('/dashboard/alumno')
  revalidatePath('/dashboard/notas')
  revalidatePath('/dashboard/libretas')
  revalidatePath('/dashboard/mensajes')

  return {
    success: true,
    parentUserId,
    login: parentEmail,
    password: data.password,
    warning,
    studentMetadata: settings.directory[data.student_id],
  }
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
  const actor = await getActorContext()
  if (actor.error || !actor.profile) {
    return { error: actor.error || 'No autenticado' }
  }

  if (isRestrictedLetamendiSecretary((actor.profile as any).role, actor.institutionName)) {
    return { error: 'En Letamendi, secretaría no puede eliminar miembros.' }
  }

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
