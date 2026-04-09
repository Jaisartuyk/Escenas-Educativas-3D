import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SecretariaClient } from '@/components/secretaria/SecretariaClient'

export const dynamic = 'force-dynamic'

export default async function SecretariaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Obtener perfil y validar que sea admin o secretaria
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')
  if (profile.role !== 'admin' && profile.role !== 'secretary') redirect('/dashboard')

  // Pre-cargar todos los alumnos y cursos de la institución
  const { data: students } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email')
    .eq('institution_id', profile.institution_id)
    .eq('role', 'student')
    .order('full_name')

  const { data: courses } = await (supabase as any)
    .from('courses')
    .select('*')
    .eq('institution_id', profile.institution_id)

  const { data: enrolls } = await (supabase as any)
    .from('enrollments')
    .select('*')

  // Cargar pagos asociados a esta institución
  const { data: payments } = await (supabase as any)
    .from('payments')
    .select('*')
    .eq('institution_id', profile.institution_id)
    .order('created_at', { ascending: false })

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink mb-2">Secretaría Académica</h1>
        <p className="text-ink3 text-sm">Control financiero y gestión de matrículas de estudiantes.</p>
      </div>
      <SecretariaClient 
        institutionId={profile.institution_id}
        students={students || []} 
        courses={courses || []} 
        enrollments={enrolls || []} 
        initialPayments={payments || []} 
      />
    </div>
  )
}
