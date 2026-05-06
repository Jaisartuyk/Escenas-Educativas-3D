import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AcademicoClient } from '@/components/academico/AcademicoClient'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AcademicoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('institution_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.institution_id) redirect('/dashboard')
  const isAdmin = ['admin', 'assistant', 'secretary', 'rector'].includes(profile.role)
  if (!isAdmin) redirect('/dashboard')

  const instId: string = profile.institution_id

  // ── Paso 1: todas las queries independientes en paralelo ────────────────────
  const [coursesRes, studentsRes, teachersRes, parentsRes, subjectsRes, instRes, scheduleRes] =
    await Promise.all([
      admin.from('courses' as any)
        .select('*')
        .eq('institution_id', instId)
        .order('name', { ascending: true }),

      // select('*') igual que el original — PersonalClient necesita todos los campos
      admin.from('profiles' as any)
        .select('*')
        .eq('institution_id', instId)
        .eq('role', 'student')
        .order('full_name', { ascending: true }),

      admin.from('profiles' as any)
        .select('*')
        .eq('institution_id', instId)
        .in('role', ['teacher', 'secretary', 'supervisor', 'rector'])
        .order('full_name', { ascending: true }),

      admin.from('profiles' as any)
        .select('*')
        .eq('institution_id', instId)
        .eq('role', 'parent')
        .order('full_name', { ascending: true }),

      admin.from('subjects' as any)
        .select('id, name, weekly_hours, course_id, teacher_id, teacher:profiles(full_name), course:courses(name)')
        .eq('institution_id', instId)
        .order('name', { ascending: true }),

      // Leer settings de la institución con adminClient (evita bloqueo de RLS)
      admin.from('institutions' as any)
        .select('settings, name')
        .eq('id', instId)
        .single(),

      admin.from('schedule_configs' as any)
        .select('tutores')
        .eq('institution_id', instId)
        .maybeSingle(),
    ])

  // ── Paso 2: enrollments filtrados por los cursos reales de esta institución ─
  const courseIds: string[] = (coursesRes.data || []).map((c: any) => c.id)
  const { data: enrollments } = courseIds.length > 0
    ? await admin
        .from('enrollments' as any)
        .select('course_id, student_id')
        .in('course_id', courseIds)
    : { data: [] }

  const instSettings     = (instRes.data as any)?.settings || {}
  const institutionName  = (instRes.data as any)?.name || ''
  const directoryMetadata = instSettings.directory || {}
  const horariosDocentes  = instSettings.horarios?.docentes || []

  // Combinar tutores de todas las fuentes:
  //   1. schedule_configs.tutores (legado, una sola fila por institución)
  //   2. settings.horarios.config.tutores (legado wizard único)
  //   3. settings.horarios_<slot>.config.tutores (slots: escuela_matutina,
  //      colegio_matutina, etc. — el wizard guarda body completo, los tutores
  //      están dentro de body.config.tutores)
  //   4. Compatibilidad: también revisar slot.tutores por si hay versión vieja.
  // Cada slot suele cubrir cursos distintos, así que la mezcla es segura.
  const tutores: Record<string, string> = {}
  Object.entries(((scheduleRes.data as any)?.tutores || {}) as Record<string, string>)
    .forEach(([k, v]) => { if (v) tutores[k] = v })
  Object.entries(instSettings).forEach(([key, slot]: [string, any]) => {
    if (key === 'horarios' || key.startsWith('horarios_')) {
      const fromConfig = slot?.config?.tutores || {}
      const fromTop    = slot?.tutores || {}
      Object.entries({ ...fromTop, ...fromConfig } as Record<string, string>)
        .forEach(([k, v]) => { if (v) tutores[k] = v })
    }
  })

  // ── Paso 3: assignments, grades, categories para Promoción ──────────────
  const subjectIds = (subjectsRes.data || []).map((s: any) => s.id)
  let assignmentsData: any[] = []
  let gradesData: any[] = []

  if (subjectIds.length > 0) {
    const { data: aData } = await admin
      .from('assignments' as any)
      .select('id, subject_id, title, trimestre, parcial, category_id')
      .in('subject_id', subjectIds)
    assignmentsData = aData || []

    if (assignmentsData.length > 0) {
      const { data: gData } = await admin
        .from('grades' as any)
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignmentsData.map((a: any) => a.id))
      gradesData = gData || []
    }
  }

  const { data: categories } = await admin
    .from('grade_categories' as any)
    .select('*')
    .eq('institution_id', instId)
    .order('sort_order')

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Gestión Académica</h1>
        <p className="text-ink3 text-sm mt-1">Crea cursos, asigna materias a docentes y matricula estudiantes.</p>
      </div>

      <AcademicoClient
        initialCourses={coursesRes.data    || []}
        initialStudents={studentsRes.data   || []}
        initialSubjects={subjectsRes.data   || []}
        initialEnrollments={enrollments     || []}
        initialAssignments={assignmentsData}
        initialGrades={gradesData}
        initialCategories={categories       || []}
        teachers={teachersRes.data          || []}
        parents={parentsRes.data            || []}
        horariosDocentes={horariosDocentes}
        institutionId={instId}
        currentRole={profile.role}
        institutionName={institutionName}
        directoryMetadata={directoryMetadata}
        tutores={tutores}
      />
    </div>
  )
}
