import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export const metadata: Metadata = { title: 'Dashboard' }

const TYPE_LABELS:  Record<string, string> = { clase: 'Clase', unidad: 'Unidad', rubrica: 'Rúbrica' }
const TYPE_CLASSES: Record<string, string> = {
  clase:   'badge-violet',
  unidad:  'badge-amber',
  rubrica: 'badge-rose',
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

  const role      = profile?.role ?? 'teacher'
  const instId    = profile?.institution_id
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario'

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

        <div className="grid grid-cols-[1fr_320px] gap-6">
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

        <div className="grid grid-cols-[1fr_300px] gap-6">
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
  // DASHBOARD ADMIN (original, mejorado con adminClient)
  // ════════════════════════════════════════════════════════════════════════
  const { data: planificaciones } = await admin
    .from('planificaciones')
    .select('id, title, subject, grade, type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: totalPlans } = await admin
    .from('planificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: thisMonth } = await admin
    .from('planificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  return (
    <div className="animate-fade-in">
      {/* Institution Banner */}
      {institution && (
        <div className="mb-6 flex items-center gap-4 p-4 rounded-2xl bg-[rgba(38,215,180,0.06)] border border-[rgba(38,215,180,0.2)]">
          <span className="text-2xl">🏫</span>
          <div className="flex-1">
            <strong className="text-sm font-bold block">{institution.name}</strong>
            <span className="text-xs text-ink3">Código de invitación: <code className="text-teal font-mono font-bold">{institution.join_code}</code></span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg bg-[rgba(38,215,180,0.15)] text-teal">Admin</span>
        </div>
      )}

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
        <p className="text-ink3 text-sm mt-1">
          {new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
        </p>
      </div>

      {profile?.plan === 'free' && (
        <div className="mb-6 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[rgba(124,109,250,0.12)] to-[rgba(240,98,146,0.10)] border border-[rgba(124,109,250,0.25)]">
          <span className="text-2xl">⚡</span>
          <div className="flex-1">
            <strong className="text-sm font-semibold block mb-0.5">Estás en el plan Starter</strong>
            <span className="text-xs text-ink2">Tienes {Math.max(0, 10 - (thisMonth ?? 0))} planificaciones restantes este mes</span>
          </div>
          <Link href="/dashboard/configuracion?tab=plan" className="btn-primary text-sm px-5 py-2 whitespace-nowrap">Mejorar a Pro →</Link>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total planificaciones', value: totalPlans ?? 0,  color: 'text-violet2' },
          { label: 'Este mes',              value: thisMonth ?? 0,   color: 'text-teal'   },
          { label: 'Escenas 3D vistas',     value: 12,               color: 'text-rose'   },
          { label: 'Horas ahorradas',       value: `${((totalPlans ?? 0) * 1.5).toFixed(0)}h`, color: 'text-amber' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] mb-2">{s.label}</p>
            <p className={`font-display text-[32px] font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold tracking-tight">Planificaciones recientes</h2>
            <Link href="/dashboard/historial" className="text-xs text-violet2 font-medium hover:underline">Ver todas →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {!planificaciones?.length ? (
              <div className="card p-10 text-center text-ink3">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-medium text-sm mb-1">Aún no tienes planificaciones</p>
                <p className="text-xs">Ve al Planificador para generar tu primera</p>
              </div>
            ) : planificaciones.map((p: any) => (
              <Link key={p.id} href={`/dashboard/historial/${p.id}`} className="card-hover p-4 flex items-center gap-4 cursor-pointer">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                  p.type === 'clase' ? 'bg-[rgba(124,109,250,0.15)]' :
                  p.type === 'unidad' ? 'bg-[rgba(255,179,71,0.15)]' : 'bg-[rgba(240,98,146,0.15)]'
                }`}>
                  {p.type === 'clase' ? '📋' : p.type === 'unidad' ? '📚' : '🎯'}
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

        <div>
          <h2 className="font-display text-lg font-bold tracking-tight mb-4">Acciones rápidas</h2>
          <div className="flex flex-col gap-3">
            {[
              { icon: '📋', title: 'Nueva planificación de clase', sub: 'Lista en ~30 segundos',   href: '/dashboard/planificador?type=clase',  bg: 'bg-[rgba(124,109,250,0.15)]' },
              { icon: '📚', title: 'Nueva unidad didáctica',       sub: 'Completa y estructurada', href: '/dashboard/planificador?type=unidad',  bg: 'bg-[rgba(255,179,71,0.15)]' },
              { icon: '📅', title: 'Generar horario',              sub: 'Sin choques de docentes', href: '/dashboard/horarios',                  bg: 'bg-[rgba(38,215,180,0.15)]'  },
              { icon: '🔬', title: 'Explorar escenas 3D',          sub: '6 modelos interactivos',  href: '/dashboard/escenas',                  bg: 'bg-[rgba(240,98,146,0.15)]'  },
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
