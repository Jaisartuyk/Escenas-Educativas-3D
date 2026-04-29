// src/app/dashboard/institucion/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InstitucionClient } from '@/components/institucion/InstitucionClient'

export const metadata: Metadata = { title: 'Mi Institución' }

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

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

  const isAdmin = ['admin', 'assistant', 'secretary', 'rector'].includes(profile.role)
  if (!isAdmin) redirect('/dashboard')

  const { data: institution } = await (supabase as any)
    .from('institutions')
    .select('*')
    .eq('id', profile.institution_id)
    .single()

  // Usamos el cliente admin para saltar RLS en esta página administrativa del servidor
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  // Miembros de esta institución
  const { data: members } = await admin
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: true })

  // Cursos de esta institución
  const { data: courses } = await admin
    .from('courses')
    .select('id, name, parallel, level, shift, created_at')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: true })

  // Materias de esta institución (con curso y docente)
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, name, weekly_hours, course_id, teacher_id')
    .eq('institution_id', profile.institution_id)
    .order('name', { ascending: true })

  // Docentes para asignar a materias.
  // Rector también puede ejercer como docente en la institución.
  const teachers = (members ?? []).filter((m: any) => ['teacher', 'rector'].includes(m.role))

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Mi Institución</h1>
        <p className="text-ink3 text-sm mt-1">Gestiona tu Unidad Educativa, miembros, cursos y materias</p>
      </div>
      <InstitucionClient
        institution={institution}
        members={members ?? []}
        courses={courses ?? []}
        subjects={subjects ?? []}
        teachers={teachers}
        currentUserId={user!.id}
      />
    </div>
  )
}
