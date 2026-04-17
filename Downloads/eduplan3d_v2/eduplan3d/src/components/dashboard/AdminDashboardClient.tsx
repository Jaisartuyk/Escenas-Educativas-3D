'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Props {
  firstName: string
  greeting: string
  institution: { name: string; join_code: string } | null
  plan: string
  remainingPlans: number
  // Institutional data
  stats: {
    totalTeachers: number
    totalStudents: number
    totalCourses: number
    totalSubjects: number
    totalAssignments: number
    totalGradesEntered: number
    totalPlans: number
    thisMonthPlans: number
  }
  // Chart data
  enrollmentsByLevel: { level: string; count: number }[]
  gradeDistribution: { range: string; count: number; color: string }[]
  attendanceSummary: { name: string; value: number; color: string }[]
  teacherActivity: { name: string; tareas: number; notas: number }[]
  recentAssignments: any[]
  weeklyActivity: { day: string; tareas: number; asistencias: number }[]
}

const TYPE_LABELS:  Record<string, string> = { anual: 'Anual', trimestral: 'Trimestral', unidad: 'Unidad', semanal: 'Semanal', diaria: 'Diaria' }

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-ink mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-surface border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold" style={{ color: d.payload.color }}>{d.name}: {d.value}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export function AdminDashboardClient({
  firstName, greeting, institution, plan, remainingPlans,
  stats, enrollmentsByLevel, gradeDistribution, attendanceSummary,
  teacherActivity, recentAssignments, weeklyActivity,
}: Props) {

  const dateStr = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())

  // Total attendance for percentage calculation
  const totalAttendance = attendanceSummary.reduce((s, a) => s + a.value, 0)

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {institution && (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[rgba(38,215,180,0.08)] to-[rgba(124,109,250,0.06)] border border-[rgba(38,215,180,0.2)]">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal to-violet2 flex items-center justify-center text-white text-lg font-bold shadow-md">
            {institution.name.charAt(0)}
          </div>
          <div className="flex-1">
            <strong className="text-sm font-bold block">{institution.name}</strong>
            <span className="text-xs text-ink3">
              Codigo: <code className="text-teal font-mono font-bold">{institution.join_code}</code>
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet/15 to-teal/15 text-violet2">
            Administrador
          </span>
        </div>
      )}

      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-ink3 text-sm mt-1 capitalize">{dateStr}</p>
      </div>

      {plan === 'free' && (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[rgba(124,109,250,0.12)] to-[rgba(240,98,146,0.10)] border border-[rgba(124,109,250,0.25)]">
          <span className="text-2xl">⚡</span>
          <div className="flex-1">
            <strong className="text-sm font-semibold block mb-0.5">Plan ClassNova</strong>
            <span className="text-xs text-ink2">Soporte y almacenamiento activo para tu institución</span>
          </div>
          <Link href="/dashboard/configuracion?tab=plan" className="btn-primary text-sm px-5 py-2 whitespace-nowrap">
            Mejorar a Pro →
          </Link>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Docentes',         value: stats.totalTeachers,     icon: '👨‍🏫', color: 'from-violet/15 to-violet2/10',   textColor: 'text-violet2'    },
          { label: 'Estudiantes',      value: stats.totalStudents,     icon: '🎓', color: 'from-teal/15 to-teal/5',          textColor: 'text-teal'       },
          { label: 'Cursos',           value: stats.totalCourses,      icon: '📚', color: 'from-blue-500/15 to-blue-500/5',  textColor: 'text-blue-500'   },
          { label: 'Materias',         value: stats.totalSubjects,     icon: '📖', color: 'from-amber-500/15 to-amber-500/5', textColor: 'text-amber-500' },
          { label: 'Planificaciones',      value: stats.totalPlans,        icon: '📋', color: 'from-rose/15 to-rose/5',          textColor: 'text-rose'       },
          { label: 'Calificaciones',   value: stats.totalGradesEntered, icon: '📊', color: 'from-emerald-500/15 to-emerald-500/5', textColor: 'text-emerald-500' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 border border-[rgba(0,0,0,0.04)]`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className={`font-display text-2xl lg:text-3xl font-extrabold tracking-tight ${s.textColor}`}>
              {s.value}
            </p>
            <p className="text-[10px] font-semibold text-ink3 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Charts Row 1 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance Pie */}
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold tracking-tight mb-1">Asistencia General</h3>
          <p className="text-[11px] text-ink3 mb-4">{totalAttendance} registros totales</p>
          {totalAttendance > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[160px] h-[160px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceSummary}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {attendanceSummary.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {attendanceSummary.map(a => {
                  const pct = totalAttendance > 0 ? (a.value / totalAttendance * 100).toFixed(1) : '0'
                  return (
                    <div key={a.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color }} />
                      <span className="text-xs text-ink2 flex-1">{a.name}</span>
                      <span className="text-xs font-bold" style={{ color: a.color }}>{a.value}</span>
                      <span className="text-[10px] text-ink4 w-10 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-ink4 text-sm">
              Sin datos de asistencia
            </div>
          )}
        </div>

        {/* Grade Distribution */}
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold tracking-tight mb-1">Distribucion de Calificaciones</h3>
          <p className="text-[11px] text-ink3 mb-4">Escala MINEDUC Ecuador</p>
          {gradeDistribution.some(g => g.count > 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={gradeDistribution} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Estudiantes" radius={[6, 6, 0, 0]}>
                  {gradeDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-ink4 text-sm">
              Sin calificaciones registradas
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Enrollment by Level */}
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold tracking-tight mb-1">Estudiantes por Nivel</h3>
          <p className="text-[11px] text-ink3 mb-4">Distribucion de matriculas</p>
          {enrollmentsByLevel.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={enrollmentsByLevel} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="level" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Estudiantes" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-ink4 text-sm">
              Sin datos de matriculacion
            </div>
          )}
        </div>

        {/* Teacher Activity */}
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold tracking-tight mb-1">Docentes más Activos</h3>
          <p className="text-[11px] text-ink3 mb-4">Planificaciones y tareas publicadas</p>
          {teacherActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={teacherActivity} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="tareas" name="Tareas" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notas" name="Notas" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-ink4 text-sm">
              Sin actividad docente
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly Activity Area Chart ──────────────────────────────────── */}
      {weeklyActivity.length > 0 && weeklyActivity.some(w => w.tareas > 0 || w.asistencias > 0) && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold tracking-tight mb-1">Actividad Semanal</h3>
          <p className="text-[11px] text-ink3 mb-4">Ultimas 4 semanas</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyActivity}>
              <defs>
                <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="tareas" name="Tareas" stroke="#6366F1" fill="url(#gradViolet)" strokeWidth={2} />
              <Area type="monotone" dataKey="asistencias" name="Asistencia" stroke="#10B981" fill="url(#gradTeal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom Section: Recent + Quick Actions ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Recent Assignments across institution */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold tracking-tight">Actividad Reciente</h2>
            <Link href="/dashboard/docencia" className="text-xs text-violet2 font-medium hover:underline">
              Ver supervision →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentAssignments.length === 0 ? (
              <div className="card p-10 text-center text-ink3">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-medium text-sm mb-1">Sin actividad reciente</p>
                <p className="text-xs">Los docentes aun no han creado tareas</p>
              </div>
            ) : recentAssignments.map((a: any) => (
              <div key={a.id} className="card-hover p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-violet/10">
                  📝
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-ink3 mt-0.5">
                    {a.teacherName} · {a.subjectName} · {a.courseName}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-ink4">
                    {new Date(a.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      a.graded >= a.totalStudents
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {a.graded}/{a.totalStudents}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight mb-4">Acciones Rapidas</h2>
          <div className="flex flex-col gap-3">
            {[
              { icon: '📝', title: 'Supervision Docente',       sub: 'Monitorear actividad',     href: '/dashboard/docencia',                bg: 'bg-violet/15' },
              { icon: '📋', title: 'Biblioteca de Planificaciones', sub: 'Control de documentos',    href: '/dashboard/biblioteca',              bg: 'bg-[rgba(124,109,250,0.15)]' },
              { icon: '📅', title: 'Generar horario',            sub: 'Sin choques de docentes',  href: '/dashboard/horarios',                bg: 'bg-[rgba(38,215,180,0.15)]' },
              { icon: '🏫', title: 'Mi Institucion',             sub: 'Cursos, materias, personal', href: '/dashboard/institucion',           bg: 'bg-[rgba(255,179,71,0.15)]' },
              { icon: '📊', title: 'Libretas',                   sub: 'Calificaciones generales', href: '/dashboard/libretas',                bg: 'bg-[rgba(240,98,146,0.15)]' },

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
