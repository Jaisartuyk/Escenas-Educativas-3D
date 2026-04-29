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
  const instId = profile?.institution_id
  const isPlannerSolo = (profile as any)?.plan === 'planner_solo'

  if (isAdmin && instId) {
    const [{ data: teachers }, { data: manuales }, { data: docsLegacy }, { data: docsByMateria }, { data: inst }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, email')
        .eq('institution_id', instId)
        .eq('role', 'teacher')
        .order('full_name'),
      admin
        .from('planificaciones_manuales' as any)
        .select('id, user_id, title, subject_name, course_name, status, type, unit_number, updated_at, content_html, supervisor_notes, supervisor_notes_updated_at')
        .eq('institution_id', instId)
        .order('updated_at', { ascending: false }),
      admin
        .from('documentos' as any)
        .select('id, user_id, titulo, asignatura, grado, storage_path, created_at, file_size'),
      admin
        .from('planner_reference_docs' as any)
        .select('id, user_id, titulo, planner_subject_id, storage_path, created_at, file_name, file_type'),
      admin
        .from('institutions' as any)
        .select('name, settings')
        .eq('id', instId)
        .single(),
    ])

    const subjectIds = Array.from(
      new Set(
        (((docsByMateria as any[]) || []).map((doc: any) => doc.planner_subject_id).filter(Boolean))
      )
    )

    const plannerSubjects = subjectIds.length > 0
      ? ((await admin
          .from('subjects' as any)
          .select('id, name, course:courses(name, parallel)')
          .in('id', subjectIds)
        ).data || [])
      : []

    const plannerSubjectMap = new Map(
      (plannerSubjects as any[]).map((subject: any) => {
        const courseName = subject.course
          ? `${subject.course.name} ${subject.course.parallel || ''}`.trim()
          : ''
        return [subject.id, { subject_name: subject.name || 'Sin materia', course_name: courseName || 'Sin curso' }]
      })
    )

    const recursos = [
      ...(((docsLegacy as any[]) || []).map((doc: any) => ({
        id: doc.id,
        user_id: doc.user_id,
        title: doc.titulo || 'Documento adjunto',
        subject_name: doc.asignatura || 'Sin materia',
        course_name: doc.grado || 'Sin curso',
        storage_path: doc.storage_path,
        created_at: doc.created_at,
        file_name: doc.storage_path?.split('/').pop() || null,
        file_size: doc.file_size || null,
      }))),
      ...(((docsByMateria as any[]) || []).map((doc: any) => {
        const subjectInfo = plannerSubjectMap.get(doc.planner_subject_id) || { subject_name: 'Sin materia', course_name: 'Sin curso' }
        return {
          id: doc.id,
          user_id: doc.user_id,
          title: doc.titulo || doc.file_name || 'Documento de referencia',
          subject_name: subjectInfo.subject_name,
          course_name: subjectInfo.course_name,
          storage_path: doc.storage_path,
          created_at: doc.created_at,
          file_name: doc.file_name || doc.storage_path?.split('/').pop() || null,
          file_size: null,
        }
      })),
    ]

    const institutionName = (inst as any)?.name || 'Institución Educativa'
    const instSettings = ((inst as any)?.settings as any) || {}
    const logoUrl: string | null =
      instSettings?.logo_url
        ?? (institutionName.toUpperCase().includes('LETAMENDI') ? '/icon/logo-institucion.png' : null)

    return (
      <div className="animate-fade-in max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Planificaciones Docentes</h1>
          <p className="text-ink3 text-sm mt-1">
            Visualiza las planificaciones, borradores y recursos de los docentes de tu institución.
          </p>
        </div>
        <AdminPlanificacionesClient
          manuales={(manuales as any) || []}
          recursos={recursos}
          teachers={(teachers as any) || []}
          institutionName={institutionName}
          logoUrl={logoUrl}
        />
      </div>
    )
  }

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
