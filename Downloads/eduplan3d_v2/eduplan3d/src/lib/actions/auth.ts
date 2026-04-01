// src/lib/actions/auth.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = createClient()
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signUp(formData: FormData) {
  const supabase  = createClient()
  const email     = formData.get('email')     as string
  const password  = formData.get('password')  as string
  const full_name = formData.get('full_name') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  return { success: 'Revisa tu correo para confirmar tu cuenta.' }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = createClient()
  const email    = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) return { error: error.message }
  return { success: 'Te enviamos un enlace a tu correo.' }
}

export async function updateProfile(formData: FormData) {
  const supabase   = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const full_name  = formData.get('full_name')  as string
  const institution = formData.get('institution') as string

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, institution })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracion')
  return { success: 'Perfil actualizado.' }
}
