// src/app/dashboard/notas/page.tsx
// Vista "Mis Notas" — pensada para estudiantes y padres de familia.
// Dashboard interactivo por materia con tarjetas de colores, promedios,
// desglose por categoría y asistencia. Separado de la libreta imprimible.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MisNotasClient } from '@/components/notas/MisNotasClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export const metadata = { title: 'Mis Notas' }

export default async function NotasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, role, institution_id, institutions(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) redirect('/dashboard')

  const instId = profile.institution_id

  // ── Enrollment del estudiante (o hijo/a si es padre) ──────────────────────
  // Por simplicidad: el estudiante ve sus propias notas (user.id).
  // (Los padres serán soportados filtrando por child_id cuando exista.)
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('id, student_id, course_id, course:courses(id, name, parallel, institution_id)')
    .eq('student_id', user.id)

  const courseIds = (enrollments || []).map((e: any) => e.course_id)
  if (courseIds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="font-display text-3xl font-bold">Mis Notas</h1>
        <p className="text-ink3 mt-3">Aún no estás matriculado en un curso. Pide a tu institución que te asigne.</p>
      </div>
    )
  }

  // ── Subjects (materias) del curso con docente ─────────────────────────────
  const { data: subjects } = await admin
    .from('subjects')
    .select('id, name, course_id, teacher:profiles!subjects_teacher_id_fkey(id, full_name)')
    .in('course_id', courseIds)

  const subjectIds = (subjects || []).map((s: any) => s.id)

  const [
    { data: categories },
    { data: assignments },
    { data: grades },
    { data: attendance },
    { data: behaviors },
    { data: scheduleConfig },
  ] = await Promise.all([
    admin.from('grade_categories').select('*').eq('institution_id', instId).order('sort_order'),
    subjectIds.length
      ? admin.from('assignments').select('id, subject_id, title, trimestre, parcial, category_id, created_at').in('subject_id', subjectIds)
      : Promise.resolve({ data: [] }),
    Promise.resolve({ data: [] }), // placeholder, se hace abajo
    subjectIds.length
      ? admin.from('attendance').select('student_id, subject_id, status, date').eq('student_id', user.id).in('subject_id', subjectIds)
      : Promise.resolve({ data: [] }),
    subjectIds.length
      ? admin.from('behaviors').select('student_id, subject_id, type, description, created_at').eq('student_id', user.id).in('subject_id', subjectIds)
      : Promise.resolve({ data: [] }),
    admin.from('schedule_configs' as any).select('parciales_count').eq('institution_id', instId).maybeSingle(),
  ])

  // Calificaciones del estudiante sobre sus assignments
  let myGrades: any[] = []
  const assignmentIds = (assignments || []).map((a: any) => a.id)
  if (assignmentIds.length > 0) {
    const { data: g } = await admin
      .from('grades')
      .select('assignment_id, student_id, score')
      .eq('student_id', user.id)
      .in('assignment_id', assignmentIds)
    myGrades = g || []
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <MisNotasClient
        studentName={profile.full_name || 'Estudiante'}
        institutionName={(profile as any).institutions?.name || ''}
        enrollments={enrollments || []}
        subjects={((subjects || []) as any[]).map((s: any) => ({
          ...s,
          teacher: Array.isArray(s.teacher) ? (s.teacher[0] || null) : s.teacher,
        }))}
        categories={categories || []}
        assignments={assignments || []}
        grades={myGrades}
        attendance={attendance || []}
        behaviors={behaviors || []}
        parcialesCount={(scheduleConfig as any)?.parciales_count || 2}
      />
    </div>
  )
}
