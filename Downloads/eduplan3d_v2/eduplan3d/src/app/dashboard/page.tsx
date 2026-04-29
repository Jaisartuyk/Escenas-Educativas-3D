import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminStatsCharts } from '@/components/dashboard/AdminStatsCharts'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export const metadata: Metadata = { title: 'Dashboard' }

const TYPE_LABELS:  Record<string, string> = { anual: 'Anual', semanal: 'Semanal', diaria: 'Diaria', unidad: 'Unidad' }
const TYPE_CLASSES: Record<string, string> = {
  anual:   'badge-violet',
  semanal: 'badge-amber',
  diaria:  'badge-rose',
  unidad:  'badge-blue',
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // ── Perfil completo con rol ───────────────────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, plan, institution_id, role')
    .eq('id', user.id)
    .single()

  const role      = profile?.role ?? 'admin'
  const plan      = profile?.plan ?? ''
  const instId    = profile?.institution_id
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario'

  // ── Redirigir superadmin ─────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPERADMIN_EMAIL
  if (superAdminEmail && user.email === superAdminEmail) redirect('/superadmin')

  // ── Redirigir según rol específico ─────────────────────────────
  if (plan === 'planner_solo') redirect('/dashboard/planificador')
  if (role === 'teacher') redirect('/dashboard/docente')
  if (role === 'student') redirect('/dashboard/alumno')
  if (role === 'secretary') redirect('/dashboard/secretaria')

  const hour     = new Date().getUTCHours() - 5
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  // ── Institución ──────────────────────────────────────────────────────────
  let institution: { name: string; join_code: string } | null = null
  if (instId) {
    const { data } = await admin
      .from('institutions')
      .select('name, join_code')
      .eq('id', instId)
      .single()
    institution = data
  }

  // ════════════════════════════════════════════════════════════════════════
  // DASHBOARD DOCENTE
  // ════════════════════════════════════════════════════════════════════════
  if (role === 'teacher') {
    const { data: mySubjects } = await admin
      .from('subjects' as any)
      .select('*, course:courses(id, name, parallel)')
      .eq('teacher_id', user.id)

    const courseIds  = (mySubjects  || []).map((s: any) => s.course?.id).filter(Boolean)
    const subjectIds = (mySubjects  || []).map((s: any) => s.id)

    let totalStudents = 0
    if (courseIds.length > 0) {
      const { data: enrs } = await admin
        .from('enrollments')
        .select('student_id')
        .in('course_id', courseIds)
      totalStudents = new Set((enrs || []).map((e: any) => e.student_id)).size
    }

    let assignments: any[] = []
    if (subjectIds.length > 0) {
      const { data } = await admin
        .from('assignments')
        .select('id, title, subject_id, due_date, created_at')
        .in('subject_id', subjectIds)
        .order('created_at', { ascending: false })
        .limit(8)
      assignments = data || []
    }

    let ungradedCount = 0
    if (assignments.length > 0 && courseIds.length > 0) {
      const { data: allGrades } = await admin
        .from('grades')
        .select('assignment_id, student_id')
        .in('assignment_id', assignments.map((a: any) => a.id))

      const { data: allEnrs } = await admin
        .from('enrollments')
        .select('course_id, student_id')
        .in('course_id', courseIds)

      assignments.forEach((a: any) => {
        const sub     = (mySubjects || []).find((s: any) => s.id === a.subject_id)
        const courseEnrs = (allEnrs || []).filter((e: any) => e.course_id === sub?.course?.id)
        const graded  = (allGrades || []).filter((g: any) => g.assignment_id === a.id).length
        ungradedCount += Math.max(0, courseEnrs.length - graded)
      })
    }

    return (
      <div className="animate-fade-in space-y-8">
        {/* Banner institución */}
        {institution && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[rgba(38,215,180,0.06)] border border-[rgba(38,215,180,0.2)]">
            <span className="text-2xl">🏫</span>
            <div className="flex-1">
              <strong className="text-sm font-bold block">{institution.name}</strong>
              <span className="text-xs text-ink3">Código de invitación: <code className="text-teal font-mono font-bold">{institution.join_code}</code></span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg bg-violet/10 text-violet">Docente</span>
          </div>
        )}

        {/* Saludo */}
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
          <p className="text-ink3 text-sm mt-1">
            {new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </p>
        </div>

        {/* Stats docente */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Materias asignadas', value: (mySubjects || []).length, color: 'text-violet2' },
            { label: 'Total alumnos',       value: totalStudents,             color: 'text-teal'   },
            { label: 'Tareas publicadas',   value: assignments.length,        color: 'text-blue-400' },
            { label: 'Sin calificar',       value: ungradedCount,             color: ungradedCount > 0 ? 'text-rose' : 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <p className="text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] mb-2">{s.label}</p>
              <p className={`font-display text-[32px] font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Últimas tareas creadas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold tracking-tight">Últimas tareas publicadas</h2>
              <Link href="/dashboard/docente?tab=tareas" className="text-xs text-violet2 font-medium hover:underline">Ver todas →</Link>
            </div>
            <div className="flex flex-col gap-3">
              {assignments.length === 0 ? (
                <div className="card p-10 text-center text-ink3">
                  <p className="text-4xl mb-3">📝</p>
                  <p className="font-medium text-sm mb-1">Aún no has publicado tareas</p>
                  <p className="text-xs">Ve al Panel Docente para crear tu primera tarea</p>
                </div>
              ) : assignments.slice(0, 5).map((a: any) => {
                const sub = (mySubjects || []).find((s: any) => s.id === a.subject_id)
                return (
                  <Link key={a.id} href="/dashboard/docente" className="card-hover p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-violet/10">📋</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.title}</p>
                      <p className="text-xs text-ink3 mt-0.5">
                        {sub?.name} · {sub?.course?.name}
                        {a.due_date && ` · Entrega: ${new Date(a.due_date).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    {ungradedCount > 0 && <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Pendiente</span>}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Accesos rápidos docente */}
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight mb-4">Acciones rápidas</h2>
            <div className="flex flex-col gap-3">
              {[
                { icon: '🧑‍🏫', title: 'Panel Docente',          sub: 'Tareas y calificaciones',       href: '/dashboard/docente',                  bg: 'bg-violet/15'              },
                { icon: '📋', title: 'Nueva planificación',     sub: 'Lista en ~30 segundos',          href: '/dashboard/planificador?type=clase',  bg: 'bg-[rgba(124,109,250,0.15)]' },
                { icon: '📊', title: 'Mis libretas de notas',   sub: 'Ver promedios por curso',        href: '/dashboard/libretas',                 bg: 'bg-[rgba(38,215,180,0.15)]'  },
                { icon: '🔬', title: 'Explorar escenas 3D',     sub: '6 modelos interactivos',         href: '/dashboard/escenas',                  bg: 'bg-[rgba(240,98,146,0.15)]'  },
              ].map(a => (
                <Link key={a.title} href={a.href} className="card-hover p-4 flex items-center gap-4 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${a.bg}`}>{a.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-ink3 mt-0.5">{a.sub}</p>
                  </div>
                  <span className="text-ink3 group-hover:text-violet2 transition-colors text-lg">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // DASHBOARD ESTUDIANTE
  // ════════════════════════════════════════════════════════════════════════
  if (role === 'student') {
    const { data: enrollments } = await admin
      .from('enrollments')
      .select('course:courses(id, name, parallel)')
      .eq('student_id', user.id)

    const courseIds = (enrollments || []).map((e: any) => e.course?.id).filter(Boolean)
    let subjectIds: string[] = []
    let recentAssignments: any[] = []

    if (courseIds.length > 0) {
      const { data: subs } = await admin
        .from('subjects' as any)
        .select('id, name, course_id')
        .in('course_id', courseIds)
      subjectIds = (subs || []).map((s: any) => s.id)

      if (subjectIds.length > 0) {
        const { data } = await admin
          .from('assignments')
          .select('id, title, subject_id, due_date, created_at')
          .in('subject_id', subjectIds)
          .order('due_date', { ascending: true })
          .limit(6)
        recentAssignments = data || []
      }
    }

    const { data: myGrades } = subjectIds.length > 0
      ? await admin.from('grades').select('score').eq('student_id', user.id).in('assignment_id',
          recentAssignments.map((a: any) => a.id).length > 0 ? recentAssignments.map((a: any) => a.id) : ['none']
        )
      : { data: [] }

    const avgGrade = (myGrades || []).length > 0
      ? ((myGrades || []).reduce((acc: number, g: any) => acc + Number(g.score), 0) / (myGrades || []).length).toFixed(1)
      : '—'

    return (
      <div className="animate-fade-in space-y-8">
        {institution && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[rgba(38,215,180,0.06)] border border-[rgba(38,215,180,0.2)]">
            <span className="text-2xl">🏫</span>
            <div className="flex-1">
              <strong className="text-sm font-bold block">{institution.name}</strong>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg bg-teal/10 text-teal">Estudiante</span>
          </div>
        )}

        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
          <p className="text-ink3 text-sm mt-1">
            {new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Cursos matriculados', value: (enrollments || []).length, color: 'text-violet2' },
            { label: 'Tareas pendientes',   value: recentAssignments.length,   color: 'text-amber'  },
            { label: 'Promedio general',    value: avgGrade,                   color: 'text-teal'   },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <p className="text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] mb-2">{s.label}</p>
              <p className={`font-display text-[32px] font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight mb-4">Próximas entregas</h2>
            {recentAssignments.length === 0 ? (
              <div className="card p-10 text-center text-ink3">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-medium text-sm">No tienes tareas pendientes</p>
              </div>
            ) : recentAssignments.map((a: any) => (
              <Link key={a.id} href="/dashboard/alumno" className="card-hover p-4 flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-amber-500/10">📚</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  {a.due_date && (
                    <p className="text-xs text-ink3 mt-0.5">
                      Entrega: {new Date(a.due_date).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div>
            <h2 className="font-display text-lg font-bold tracking-tight mb-4">Acciones rápidas</h2>
            <div className="flex flex-col gap-3">
              {[
                { icon: '📚', title: 'Mis tareas',       sub: 'Ver y entregar tareas',   href: '/dashboard/alumno',    bg: 'bg-amber-500/15'           },
                { icon: '📊', title: 'Mis notas',        sub: 'Ver calificaciones',      href: '/dashboard/libretas',  bg: 'bg-[rgba(38,215,180,0.15)]' },
                { icon: '🔬', title: 'Escenas 3D',       sub: 'Explorar modelos',        href: '/dashboard/escenas',   bg: 'bg-[rgba(240,98,146,0.15)]' },
                { icon: '📖', title: 'Biblioteca',       sub: 'Documentos del curso',    href: '/dashboard/biblioteca',bg: 'bg-violet/15'               },
              ].map(a => (
                <Link key={a.title} href={a.href} className="card-hover p-4 flex items-center gap-4 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${a.bg}`}>{a.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-ink3 mt-0.5">{a.sub}</p>
                  </div>
                  <span className="text-ink3 group-hover:text-violet2 transition-colors text-lg">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // DASHBOARD ADMIN & SUPERVISOR (Estadísticas Universitarias)
  // ════════════════════════════════════════════════════════════════════════
  const startOfPeriod = new Date();
  startOfPeriod.setDate(startOfPeriod.getDate() - 14);
  const startOfPeriodISO = startOfPeriod.toISOString();

  // ─── Institutional Filters for Metrics ───────────────────────────────────
  // Get all teacher IDs of this institution
  const { data: instTeachers } = await admin
    .from('profiles')
    .select('id')
    .eq('institution_id', instId)
    .eq('role', 'teacher');
  const teacherIds = (instTeachers || []).map(t => t.id);

  // Get all subject IDs of this institution (via courses)
  const { data: instCourses } = await admin
    .from('courses')
    .select('id')
    .eq('institution_id', instId);
  const courseIds = (instCourses || []).map(c => c.id);

  const { data: instSubs } = await admin
    .from('subjects')
    .select('id')
    .in('course_id', courseIds.length > 0 ? courseIds : ['none']);
  const subjectIds = (instSubs || []).map(s => s.id);

  // 1. Tendencia de planificaciones manuales (últimos 14 días)
  const { data: trendRaw } = (await admin
    .from('planificaciones_manuales' as any)
    .select('created_at, user_id, status')
    .eq('institution_id', instId)
    .gte('created_at', startOfPeriodISO)) as any;

  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });

  const planningTrend = last14Days.map(date => ({
    date: date.split('-').slice(1).reverse().join('/'), // format DD/MM
    count: ((trendRaw as any[]) || []).filter((p: any) => p.created_at.startsWith(date)).length
  }));

  // 2. Distribución de tipos de planificaciones manuales
  const { data: typeCounts } = (await admin
    .from('planificaciones_manuales' as any)
    .select('type, status')
    .eq('institution_id', instId)) as any;

  const contentDistribution = [
    { name: 'Anual', value: ((typeCounts as any[]) || []).filter((p: any) => p.type === 'anual').length },
    { name: 'Semanal', value: ((typeCounts as any[]) || []).filter((p: any) => p.type === 'semanal').length },
    { name: 'Diaria', value: ((typeCounts as any[]) || []).filter((p: any) => p.type === 'diaria').length },
    { name: 'Borradores', value: ((typeCounts as any[]) || []).filter((p: any) => p.status === 'borrador').length },
  ];

  // 3. Asistencia por Nivel (Escuela vs Colegio)
  const { data: attData } = await admin
    .from('attendance')
    .select('status, subject_id')
    .in('subject_id', subjectIds.length > 0 ? subjectIds : ['none']);

  const { data: subData } = await admin
    .from('subjects')
    .select('id, course:courses(level)')
    .in('id', subjectIds.length > 0 ? subjectIds : ['none']);

  const levels = ['Escuela', 'Colegio'];
  const attendanceByLevel = levels.map(lvl => {
    const relevantSubIds = (subData || [])
      .filter((s: any) => (s.course as any)?.level === lvl)
      .map((s: any) => s.id);
    
    const records = (attData || []).filter(a => relevantSubIds.includes(a.subject_id));
    const present = records.filter(a => a.status === 'present').length;
    
    return {
      level: lvl,
      percentage: records.length > 0 ? Math.round((present / records.length) * 100) : 0
    };
  });

  // 4. Composición de roles
  const { data: roleCounts } = await admin
    .from('profiles')
    .select('role')
    .eq('institution_id', instId);

  const roleDistribution = [
    { name: 'Docentes', count: (roleCounts || []).filter(p => p.role === 'teacher').length },
    { name: 'Alumnos',  count: (roleCounts || []).filter(p => p.role === 'student').length },
    { name: 'Admins',   count: (roleCounts || []).filter(p => p.role === 'admin').length },
  ];

  // Datos recientes para la lista
  const { data: planificaciones } = (await admin
    .from('planificaciones_manuales' as any)
    .select('id, title, subject_name, course_name, type, status, created_at, updated_at')
    .eq('institution_id', instId)
    .order('updated_at', { ascending: false })
    .limit(5)) as any;

  // Adapt data structure for list
  const recentPlans = (planificaciones || []).map((p: any) => ({
    ...p,
    title: p.title,
    subject: p.subject_name,
    grade: p.course_name,
    type: p.type,
    created_at: p.updated_at || p.created_at,
  }));

  const { count: totalPlans } = (await admin
    .from('planificaciones_manuales' as any)
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', instId)) as any;

  const { count: thisMonth } = (await admin
    .from('planificaciones_manuales' as any)
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', instId)
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())) as any;

  return (
    <div className="animate-fade-in pb-12">
      {/* Institution Banner */}
      {institution && (
        <div className="mb-8 flex items-center gap-4 p-4 rounded-2xl bg-[rgba(38,215,180,0.06)] border border-[rgba(38,215,180,0.2)]">
          <span className="text-2xl">🏫</span>
          <div className="flex-1">
            <strong className="text-sm font-bold block">{institution.name}</strong>
            <span className="text-xs text-ink3">Código de invitación: <code className="text-teal font-mono font-bold">{institution.join_code}</code></span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg bg-[rgba(38,215,180,0.15)] text-teal">
            {role === 'supervisor' ? 'Supervisión Académica' : 'Panel Administrativo'}
          </span>
        </div>
      )}

      <div className="mb-8">
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
        <p className="text-ink3 text-sm mt-1">Aquí tienes un resumen estadístico de tu institución para hoy.</p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Planificaciones', value: totalPlans ?? 0,  color: 'text-violet2' },
          { label: 'Generadas este mes',    value: thisMonth ?? 0,   color: 'text-teal'   },
          { label: 'Docentes Activos',      value: roleDistribution[0].count, color: 'text-rose'   },
          { label: 'Total Estudiantes',     value: roleDistribution[1].count, color: 'text-amber' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] mb-2">{s.label}</p>
            <p className={`font-display text-[32px] font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 📊 Charts Section */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="font-display text-xl font-bold tracking-tight">Análisis Institucional</h2>
          <div className="h-px flex-1 bg-[rgba(120,100,255,0.1)]"></div>
        </div>
        
        <script dangerouslySetInnerHTML={{ __html: `window.__DASHBOARD_DATA__ = ${JSON.stringify({ planningTrend, contentDistribution, attendanceByLevel, roleDistribution })}` }} />
        
        {/* Usamos el componente cliente para los gráficos */}
        <AdminStatsCharts data={{ planningTrend, contentDistribution, attendanceByLevel, roleDistribution }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Recientes */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-bold tracking-tight">Últimas planificaciones</h2>
            <Link href="/dashboard/historial" className="text-xs text-violet2 font-medium hover:underline">Gestionar todas →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {!planificaciones?.length ? (
              <div className="card p-10 text-center text-ink3">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-medium text-sm mb-1">Sin actividad reciente</p>
              </div>
            ) : recentPlans.map((p: any) => (
              <Link key={p.id} href={`/dashboard/biblioteca`} className="card-hover p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                  p.type === 'anual' ? 'bg-[rgba(124,109,250,0.15)]' :
                  p.type === 'semanal' ? 'bg-[rgba(255,179,71,0.15)]' :
                  p.type === 'diaria' ? 'bg-[rgba(240,98,146,0.15)]' : 'bg-[rgba(79,195,247,0.15)]'
                }`}>
                  {p.type === 'anual' ? '📘' : p.type === 'semanal' ? '🗓️' : p.type === 'diaria' ? '📝' : '📚'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  <p className="text-xs text-ink3 mt-0.5">{p.subject} · {p.grade} · {new Date(p.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}</p>
                </div>
                <span className={`${TYPE_CLASSES[p.type]} flex-shrink-0`}>{TYPE_LABELS[p.type]}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Acciones */}
        {role !== 'supervisor' && (
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight mb-5">Gestión Institucional</h2>
            <div className="flex flex-col gap-3">
              {[
                { icon: '👥', title: 'Gestionar Miembros',   sub: 'Docentes y alumnos',      href: '/dashboard/institucion',     bg: 'bg-violet/15'              },
                { icon: '📅', title: 'Horarios Escolares',   sub: 'Configuración de clases', href: '/dashboard/horarios',        bg: 'bg-[rgba(38,215,180,0.15)]'  },
                { icon: '📚', title: 'Biblioteca de Recursos', sub: 'Material compartido',      href: '/dashboard/biblioteca',      bg: 'bg-[rgba(255,179,71,0.15)]' },
                { icon: '⚙️', title: 'Configuración',        sub: 'Ajustes de la cuenta',    href: '/dashboard/configuracion',   bg: 'bg-surface'                },
              ].map(a => (
                <Link key={a.title} href={a.href} className="card-hover p-4 flex items-center gap-4 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${a.bg}`}>{a.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-ink3 mt-0.5">{a.sub}</p>
                  </div>
                  <span className="text-ink3 group-hover:text-violet2 transition-colors text-lg">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
