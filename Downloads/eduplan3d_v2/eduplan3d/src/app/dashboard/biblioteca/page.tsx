import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { BibliotecaTabsClient } from '@/components/biblioteca/BibliotecaTabsClient'
import { AdminPlanificacionesClient } from '@/components/biblioteca/AdminPlanificacionesClient'

export const metadata: Metadata = { title: 'Planificaciones Docentes' }
export const dynamic = 'force-dynamic'

export default async function BibliotecaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'assistant'
  const instId  = profile?.institution_id

  // ── ADMIN: fetch all teachers + their planificaciones ──────────────────────
  if (isAdmin && instId) {
    const [{ data: teachers }, { data: planificaciones }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, email')
        .eq('institution_id', instId)
        .eq('role', 'teacher')
        .order('full_name'),
      admin
        .from('planificacion_docs' as any)
        .select('*')
        .in(
          'user_id',
          // sub-select teacher IDs
          (await admin.from('profiles').select('id').eq('institution_id', instId).eq('role', 'teacher')).data?.map((p: any) => p.id) || []
        )
        .order('created_at', { ascending: false }),
    ])

    return (
      <div className="animate-fade-in max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Planificaciones Docentes</h1>
          <p className="text-ink3 text-sm mt-1">
            Visualiza todas las planificaciones subidas por los docentes de tu institución.
          </p>
        </div>
        <AdminPlanificacionesClient
          planificaciones={(planificaciones as any) || []}
          teachers={(teachers as any) || []}
        />
      </div>
    )
  }

  // ── TEACHER / other roles: personal library + personal planificaciones ──────
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, name, course_id, course:courses(id, name, parallel, level)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Mi Biblioteca</h1>
        <p className="text-ink3 text-sm mt-1">
          Recursos curriculares y planificaciones organizadas por materia y curso.
        </p>
      </div>
      <BibliotecaTabsClient subjects={subjects || []} />
    </div>
  )
}
