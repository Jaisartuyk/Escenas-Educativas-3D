// src/app/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si hay sesión activa → al dashboard, si no → landing
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/auth/login')
  }
}
