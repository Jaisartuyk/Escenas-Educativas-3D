import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { BibliotecaTabsClient } from '@/components/biblioteca/BibliotecaTabsClient'
import { AdminPlanificacionesClient } from '@/components/biblioteca/AdminPlanificacionesClient'
import { MisMateriasPlanner } from '@/components/biblioteca/MisMateriasPlanner'

export const metadata: Metadata = { title: 'Planificaciones Docentes' }
export const dynamic = 'force-dynamic'

export default async function BibliotecaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id, full_name, plan')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'assistant', 'supervisor', 'rector'].includes(profile?.role)
  const instId  = profile?.institution_id
  const isPlannerSolo = (profile as any)?.plan === 'planner_solo'

  // ── ADMIN: fetch all teachers + their planificaciones ──────────────────────
  if (isAdmin && instId) {
    const teacherIds = (
      await admin.from('profiles').select('id').eq('institution_id', instId).eq('role', 'teacher')
    ).data?.map((p: any) => p.id) || []

    const [{ data: teachers }, { data: planificaciones }, { data: manuales }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, email')
        .eq('institution_id', instId)
        .eq('role', 'teacher')
        .order('full_name'),
      admin
        .from('planificacion_docs' as any)
        .select('*')
        .in('user_id', teacherIds)
        .order('created_at', { ascending: false }),
      // Solo planificaciones manuales PUBLICADAS (los borradores no se ven al admin)
      admin
        .from('planificaciones_manuales' as any)
        .select('id, user_id, title, subject_name, course_name, status, updated_at, content_html')
        .eq('institution_id', instId)
        .eq('status', 'publicada')
        .order('updated_at', { ascending: false }),
    ])

    return (
      <div className="animate-fade-in max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Planificaciones Docentes</h1>
          <p className="text-ink3 text-sm mt-1">
            Visualiza las planificaciones de los docentes de tu institución (subidas o creadas en línea).
          </p>
        </div>
        <AdminPlanificacionesClient
          planificaciones={(planificaciones as any) || []}
          manuales={(manuales as any) || []}
          teachers={(teachers as any) || []}
        />
      </div>
    )
  }

  // ── PLANNER_SOLO (docente externo): manager de materias propias ─────────────
  if (isPlannerSolo) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Mis Materias</h1>
          <p className="text-ink3 text-sm mt-1">
            Registra las materias y cursos que dictas. Por cada una podrás subir los libros
            y PDFs que la IA usará como referencia al generar tus planificaciones.
          </p>
        </div>
        <MisMateriasPlanner />
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
      <BibliotecaTabsClient subjects={subjects || []} role={profile?.role} />
    </div>
  )
}
