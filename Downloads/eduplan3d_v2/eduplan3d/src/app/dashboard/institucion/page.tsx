// src/app/dashboard/institucion/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InstitucionClient } from '@/components/institucion/InstitucionClient'

export const metadata: Metadata = { title: 'Mi Institución' }

export default async function InstitucionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, institution_id, role')
    .eq('id', user!.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')

  const { data: institution } = await (supabase as any)
    .from('institutions')
    .select('*')
    .eq('id', profile.institution_id)
    .single()

  // Miembros de esta institución
  const { data: members } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: true })

  // Cursos de esta institución
  const { data: courses } = await (supabase as any)
    .from('courses')
    .select('id, name, parallel, level, shift, created_at')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: true })

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Mi Institución</h1>
        <p className="text-ink3 text-sm mt-1">Gestiona tu Unidad Educativa, miembros y cursos</p>
      </div>
      <InstitucionClient
        institution={institution}
        members={members ?? []}
        courses={courses ?? []}
        currentUserId={user!.id}
      />
    </div>
  )
}
