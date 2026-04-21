// src/components/notas/MisNotasClient.tsx
// Vista interactiva "Mis Notas" para estudiantes y padres.
// Tarjetas por materia con promedio ponderado, desglose por categoría,
// actividades recientes, asistencia y comportamiento.
'use client'

import { useMemo, useState } from 'react'
import {
  GraduationCap, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, CircleX, CalendarCheck, Smile, Frown, Trophy,
  BookOpen,
} from 'lucide-react'

// ── Tipos ───────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; color: string; weight_percent: number; sort_order: number }
interface Subject  { id: string; name: string; course_id: string; teacher?: { id: string; full_name: string } | null }
interface Assignment { id: string; subject_id: string; title: string; trimestre: number | null; parcial: number | null; category_id: string | null; created_at: string }
interface Grade   { assignment_id: string; student_id: string; score: number | null }
interface Att     { student_id: string; subject_id: string; status: string; date: string }
interface Behav   { student_id: string; subject_id: string; type: string; description: string | null; created_at: string }

interface Props {
  studentName:      string
  institutionName:  string
  enrollments:      any[]
  subjects:         Subject[]
  categories:       Category[]
  assignments:      Assignment[]
  grades:           Grade[]
  attendance:       Att[]
  behaviors:        Behav[]
  parcialesCount:   number
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const SCALE_MAX = 10

function avg(nums: number[]): number | null {
  const valid = nums.filter(n => typeof n === 'number' && !isNaN(n))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function levelForScore(score: number | null): {
  label: string
  sublabel: string
  color: string
  bg: string
  text: string
  ring: string
  icon: typeof CheckCircle2
} {
  if (score == null) {
    return {
      label: 'Sin notas',
      sublabel: 'Aún no registrado',
      color: '#94A3B8',
      bg: 'bg-slate-100',
      text: 'text-slate-500',
      ring: 'ring-slate-200',
      icon: Minus,
    }
  }
  if (score >= 9) {
    return {
      label: 'Supera',
      sublabel: 'Excelente',
      color: '#10B981',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      ring: 'ring-emerald-200',
      icon: Trophy,
    }
  }
  if (score >= 7) {
    return {
      label: 'Alcanza',
      sublabel: 'Buen desempeño',
      color: '#3B82F6',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      ring: 'ring-blue-200',
      icon: CheckCircle2,
    }
  }
  if (score >= 4.01) {
    return {
      label: 'Próximo',
      sublabel: 'Necesita reforzar',
      color: '#F59E0B',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      ring: 'ring-amber-200',
      icon: AlertCircle,
    }
  }
  return {
    label: 'No alcanza',
    sublabel: 'Requiere apoyo urgente',
    color: '#EF4444',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    icon: CircleX,
  }
}

function trendIcon(curr: number | null, prev: number | null) {
  if (curr == null || prev == null) return { icon: Minus, color: 'text-ink4', label: 'sin datos' }
  const diff = curr - prev
  if (diff >= 0.3)  return { icon: TrendingUp,   color: 'text-emerald-500', label: `+${diff.toFixed(2)}` }
  if (diff <= -0.3) return { icon: TrendingDown, color: 'text-rose-500',    label: diff.toFixed(2) }
  return { icon: Minus, color: 'text-ink4', label: '≈' }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

// ── Componente ──────────────────────────────────────────────────────────────
export function MisNotasClient(props: Props) {
  const {
    studentName, institutionName, subjects, categories, assignments,
    grades, attendance, behaviors, parcialesCount,
  } = props

  const trimestresDisponibles = [1, 2, 3]
  const [trimestre, setTrimestre] = useState<number | 'all'>(1)
  const [parcial, setParcial]     = useState<number | 'all'>('all')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Assignments filtrados por trimestre/parcial
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (trimestre !== 'all' && a.trimestre !== trimestre) return false
      if (parcial    !== 'all' && a.parcial    !== parcial)    return false
      return true
    })
  }, [assignments, trimestre, parcial])

  // Grade map para lookup rápido
  const gradesByAssignment = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of grades) {
      if (g.score != null) m.set(g.assignment_id, g.score)
    }
    return m
  }, [grades])

  // Total suma de pesos (para normalizar si no suma 100)
  const totalWeight = useMemo(
    () => categories.reduce((acc, c) => acc + Number(c.weight_percent || 0), 0) || 100,
    [categories]
  )

  // Data por materia
  const subjectRows = useMemo(() => {
    return subjects.map(s => {
      const subjAsgs = filteredAssignments.filter(a => a.subject_id === s.id)

      // promedio por categoría
      const byCat = categories.map(cat => {
        const asgs = subjAsgs.filter(a => a.category_id === cat.id)
        const scores = asgs
          .map(a => gradesByAssignment.get(a.id))
          .filter((x): x is number => x != null)
        return {
          category: cat,
          count: asgs.length,
          avg: avg(scores),
        }
      })

      // promedio ponderado de la materia (solo categorías con notas)
      const catsConNota = byCat.filter(b => b.avg != null)
      let weighted: number | null = null
      if (catsConNota.length > 0) {
        const sumW = catsConNota.reduce((a, b) => a + Number(b.category.weight_percent || 0), 0) || totalWeight
        weighted = catsConNota.reduce(
          (a, b) => a + (b.avg! * Number(b.category.weight_percent || 0)) / sumW,
          0
        )
      }

      // Comparar con promedio del parcial anterior
      const currParcial = (parcial !== 'all' ? parcial : null) as number | null
      let prevAvg: number | null = null
      if (currParcial && currParcial > 1) {
        const prevAsgs = assignments.filter(a =>
          a.subject_id === s.id &&
          (trimestre === 'all' || a.trimestre === trimestre) &&
          a.parcial === currParcial - 1
        )
        const prevScores = prevAsgs
          .map(a => gradesByAssignment.get(a.id))
          .filter((x): x is number => x != null)
        prevAvg = avg(prevScores)
      }

      // asistencia
      const att = attendance.filter(a => a.subject_id === s.id)
      const attPresent = att.filter(a => a.status === 'presente' || a.status === 'tarde').length
      const attPct = att.length > 0 ? (attPresent / att.length) * 100 : null

      // comportamientos
      const beh = behaviors.filter(b => b.subject_id === s.id)
      const behPos = beh.filter(b => b.type === 'positivo' || b.type === 'positive').length
      const behNeg = beh.length - behPos

      // actividades recientes (últimas 5 con nota)
      const recent = subjAsgs
        .map(a => ({ a, score: gradesByAssignment.get(a.id) ?? null, cat: categories.find(c => c.id === a.category_id) || null }))
        .sort((x, y) => (new Date(y.a.created_at).getTime() - new Date(x.a.created_at).getTime()))
        .slice(0, 6)

      return {
        subject: s,
        weighted,
        prevAvg,
        byCat,
        attPct,
        attTotal: att.length,
        behPos, behNeg,
        recent,
      }
    })
  }, [subjects, categories, filteredAssignments, gradesByAssignment, assignments, trimestre, parcial, attendance, behaviors, totalWeight])

  // Promedio general
  const overall = useMemo(() => {
    const vals = subjectRows.map(r => r.weighted).filter((x): x is number => x != null)
    return avg(vals)
  }, [subjectRows])

  const subjectsConNota = subjectRows.filter(r => r.weighted != null).length
  const subjectsAlcanzan = subjectRows.filter(r => r.weighted != null && r.weighted >= 7).length

  const overallLevel = levelForScore(overall)

  return (
    <div className="space-y-6">
      {/* ── Header / resumen ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet via-violet2 to-teal p-6 lg:p-8 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px, 60px 60px',
        }} />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wider font-semibold">Mis Notas</p>
            <h1 className="font-display text-2xl lg:text-4xl font-bold mt-1">{studentName}</h1>
            {institutionName && <p className="text-white/80 text-sm mt-1">{institutionName}</p>}
          </div>

          <div className="flex gap-4 lg:gap-6">
            <div className="text-center">
              <p className="text-white/70 text-xs">Promedio general</p>
              <p className="text-4xl lg:text-5xl font-display font-bold tracking-tight">
                {overall != null ? overall.toFixed(2) : '—'}
              </p>
              <p className="text-white/80 text-xs font-medium">{overallLevel.label}</p>
            </div>
            <div className="text-center">
              <p className="text-white/70 text-xs">Materias aprobadas</p>
              <p className="text-4xl lg:text-5xl font-display font-bold tracking-tight">
                {subjectsAlcanzan}<span className="text-xl text-white/70">/{subjectsConNota}</span>
              </p>
              <p className="text-white/80 text-xs font-medium">con nota</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="bg-bg2 rounded-2xl border border-[rgba(0,0,0,0.06)] p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink4 font-semibold block mb-1.5">Trimestre</label>
          <div className="flex gap-1.5">
            {trimestresDisponibles.map(t => (
              <button key={t}
                onClick={() => setTrimestre(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  trimestre === t
                    ? 'bg-violet text-white shadow-sm'
                    : 'bg-bg3 text-ink2 hover:bg-slate-200'
                }`}>
                T{t}
              </button>
            ))}
            <button
              onClick={() => setTrimestre('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                trimestre === 'all'
                  ? 'bg-violet text-white shadow-sm'
                  : 'bg-bg3 text-ink2 hover:bg-slate-200'
              }`}>
              Año
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-ink4 font-semibold block mb-1.5">Parcial</label>
          <div className="flex gap-1.5">
            {Array.from({ length: parcialesCount }, (_, i) => i + 1).map(p => (
              <button key={p}
                onClick={() => setParcial(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  parcial === p
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-bg3 text-ink2 hover:bg-slate-200'
                }`}>
                P{p}
              </button>
            ))}
            <button
              onClick={() => setParcial('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                parcial === 'all'
                  ? 'bg-teal text-white shadow-sm'
                  : 'bg-bg3 text-ink2 hover:bg-slate-200'
              }`}>
              Todos
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid de materias ──────────────────────────────────────────── */}
      {subjectRows.length === 0 ? (
        <div className="text-center py-12 text-ink3 bg-bg2 rounded-2xl border border-[rgba(0,0,0,0.06)]">
          <BookOpen size={40} className="mx-auto opacity-40" />
          <p className="mt-3 text-sm">Aún no hay materias registradas en tu curso.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {subjectRows.map(row => {
            const level = levelForScore(row.weighted)
            const isOpen = expanded.has(row.subject.id)
            const tr = trendIcon(row.weighted, row.prevAvg)
            const TrIcon = tr.icon

            return (
              <div key={row.subject.id}
                className="group bg-bg2 rounded-2xl border border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)] hover:shadow-md transition-all overflow-hidden">
                {/* Barra superior de color */}
                <div className="h-1.5" style={{ backgroundColor: level.color }} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold text-ink truncate">
                        {row.subject.name}
                      </h3>
                      {row.subject.teacher?.full_name && (
                        <p className="text-ink3 text-xs mt-0.5 flex items-center gap-1">
                          <GraduationCap size={12} />
                          {row.subject.teacher.full_name}
                        </p>
                      )}
                    </div>
                    <div className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${level.bg} ${level.text}`}>
                      {level.label}
                    </div>
                  </div>

                  {/* Score grande */}
                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="text-5xl font-display font-bold tracking-tight" style={{ color: level.color }}>
                      {row.weighted != null ? row.weighted.toFixed(2) : '—'}
                    </span>
                    <span className="text-ink4 text-sm">/ {SCALE_MAX}</span>
                    {row.prevAvg != null && (
                      <span className={`ml-auto flex items-center gap-1 text-xs font-semibold ${tr.color}`}>
                        <TrIcon size={14} /> {tr.label}
                      </span>
                    )}
                  </div>

                  {/* Barra de progreso */}
                  <div className="mt-3 h-2 bg-bg3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${row.weighted != null ? Math.min(100, (row.weighted / SCALE_MAX) * 100) : 0}%`,
                        backgroundColor: level.color,
                      }}
                    />
                  </div>
                  <p className="text-ink4 text-[11px] mt-1.5">{level.sublabel}</p>

                  {/* Stats rápidos */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="bg-bg3 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-ink4 uppercase tracking-wide font-semibold flex items-center justify-center gap-1">
                        <CalendarCheck size={10} /> Asist.
                      </p>
                      <p className="text-sm font-bold text-ink mt-0.5">
                        {row.attPct != null ? `${row.attPct.toFixed(0)}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-emerald-700 uppercase tracking-wide font-semibold flex items-center justify-center gap-1">
                        <Smile size={10} /> Pos.
                      </p>
                      <p className="text-sm font-bold text-emerald-700 mt-0.5">{row.behPos}</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-rose-700 uppercase tracking-wide font-semibold flex items-center justify-center gap-1">
                        <Frown size={10} /> Neg.
                      </p>
                      <p className="text-sm font-bold text-rose-700 mt-0.5">{row.behNeg}</p>
                    </div>
                  </div>

                  {/* Desglose por categoría */}
                  <div className="mt-4 space-y-1.5">
                    {row.byCat.map(b => (
                      <div key={b.category.id} className="flex items-center gap-2.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.category.color }} />
                        <span className="text-ink2 truncate flex-1">{b.category.name}</span>
                        <span className="text-ink4 shrink-0">
                          {b.count > 0 ? `${b.count} act.` : '—'}
                        </span>
                        <span className="font-bold tabular-nums shrink-0 w-12 text-right"
                              style={{ color: b.avg != null ? levelForScore(b.avg).color : '#CBD5E1' }}>
                          {b.avg != null ? b.avg.toFixed(2) : '—'}
                        </span>
                        <span className="text-ink4 shrink-0 text-[10px] w-10 text-right">
                          {Number(b.category.weight_percent).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Toggle detalle */}
                  <button
                    onClick={() => toggle(row.subject.id)}
                    className="mt-4 w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold text-violet2 hover:bg-[rgba(124,109,250,0.08)] transition-colors"
                  >
                    {isOpen ? <>Ocultar actividades <ChevronUp size={14} /></> : <>Ver actividades recientes <ChevronDown size={14} /></>}
                  </button>

                  {/* Actividades recientes */}
                  {isOpen && (
                    <div className="mt-3 border-t border-[rgba(0,0,0,0.06)] pt-3 space-y-2 animate-fade-in">
                      {row.recent.length === 0 ? (
                        <p className="text-ink4 text-xs text-center py-3">Sin actividades en este período.</p>
                      ) : row.recent.map(({ a, score, cat }) => {
                        const lvl = levelForScore(score)
                        return (
                          <div key={a.id} className="flex items-center gap-2 text-xs">
                            <span
                              className="w-1.5 h-8 rounded-full shrink-0"
                              style={{ backgroundColor: cat?.color || '#CBD5E1' }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-ink2 font-medium truncate">{a.title}</p>
                              <p className="text-ink4 text-[10px]">
                                {cat?.name || 'Sin categoría'} · {fmtDate(a.created_at)}
                                {a.parcial ? ` · P${a.parcial}` : ''}
                              </p>
                            </div>
                            <span className={`shrink-0 w-12 text-right font-bold tabular-nums ${lvl.text}`}>
                              {score != null ? score.toFixed(1) : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Leyenda ────────────────────────────────────────────────── */}
      <div className="bg-bg2 rounded-2xl border border-[rgba(0,0,0,0.06)] p-4">
        <p className="text-[11px] uppercase tracking-wide text-ink4 font-semibold mb-3">Escala de calificación</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { min: 9,    label: 'Supera',      sub: '9.00 – 10.00', color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
            { min: 7,    label: 'Alcanza',     sub: '7.00 – 8.99',  color: '#3B82F6', bg: 'bg-blue-50',    text: 'text-blue-700'    },
            { min: 4.01, label: 'Próximo',     sub: '4.01 – 6.99',  color: '#F59E0B', bg: 'bg-amber-50',   text: 'text-amber-700'   },
            { min: 0,    label: 'No alcanza',  sub: '≤ 4.00',       color: '#EF4444', bg: 'bg-rose-50',    text: 'text-rose-700'    },
          ].map(l => (
            <div key={l.label} className={`${l.bg} rounded-xl p-3 flex items-center gap-3`}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
              <div>
                <p className={`${l.text} text-sm font-bold leading-none`}>{l.label}</p>
                <p className="text-ink4 text-[11px] mt-1">{l.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
