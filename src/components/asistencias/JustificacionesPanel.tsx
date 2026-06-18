// src/components/asistencias/JustificacionesPanel.tsx
// Panel del tutor/admin para revisar justificaciones de falta y atraso.
// Usa POST /api/attendance/justifications/review para aprobar/rechazar con
// validación de permisos en servidor (admin OR tutor del curso).
'use client'

import { useMemo, useState } from 'react'
import { ThumbsUp, ThumbsDown, FileText, ChevronDown, Filter, CheckCircle2, XCircle, Clock3 } from 'lucide-react'

interface JustificationRow {
  id: string
  student_id: string
  subject_id: string
  status: string
  date: string
  justification_status: 'pending' | 'approved' | 'rejected'
  justification_text: string | null
  justification_file_url: string | null
  student_name: string
  subject_name: string
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

export function JustificacionesPanel({ justifications }: { justifications: JustificationRow[] }) {
  const [filter, setFilter] = useState<Filter>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [local, setLocal] = useState<Record<string, 'approved' | 'rejected'>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effective: JustificationRow[] = useMemo(
    () => justifications.map(j => {
      const override = local[j.id]
      const st: 'pending' | 'approved' | 'rejected' = override ?? j.justification_status
      const row: JustificationRow = { ...j, justification_status: st }
      return row
    }),
    [justifications, local]
  )

  const counts = useMemo(() => ({
    pending:  effective.filter(j => j.justification_status === 'pending').length,
    approved: effective.filter(j => j.justification_status === 'approved').length,
    rejected: effective.filter(j => j.justification_status === 'rejected').length,
    all:      effective.length,
  }), [effective])

  const visible = useMemo(() => {
    if (filter === 'all') return effective
    return effective.filter(j => j.justification_status === filter)
  }, [effective, filter])

  async function review(id: string, action: 'approved' | 'rejected') {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch('/api/attendance/justifications/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: id, action }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'No se pudo actualizar')
      }
      setLocal(prev => ({ ...prev, [id]: action }))
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setBusy(null)
    }
  }

  if (justifications.length === 0) {
    return (
      <div className="bg-surface border border-surface2 rounded-2xl p-8 text-center">
        <FileText size={40} className="mx-auto text-ink4 opacity-40" />
        <p className="mt-3 text-sm text-ink3">
          No hay justificaciones registradas para tus cursos.
        </p>
        <p className="text-[11px] text-ink4 mt-1">
          Cuando un representante o estudiante justifique una falta o atraso, aparecerá aquí para tu revisión.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Filtros en chips ── */}
      <div className="bg-surface border border-surface2 rounded-2xl p-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink4 font-semibold mr-2">
          <Filter size={12} /> Filtrar:
        </span>
        {([
          { k: 'pending',  label: 'Pendientes', icon: Clock3,       color: 'amber' },
          { k: 'approved', label: 'Aprobadas',  icon: CheckCircle2, color: 'emerald' },
          { k: 'rejected', label: 'Rechazadas', icon: XCircle,      color: 'rose' },
          { k: 'all',      label: 'Todas',      icon: FileText,     color: 'slate' },
        ] as Array<{ k: Filter; label: string; icon: any; color: string }>).map(c => {
          const active = filter === c.k
          const Icon = c.icon
          const n = counts[c.k]
          const colorMap: Record<string, { active: string; idle: string }> = {
            amber:   { active: 'bg-amber-500 text-white',   idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            emerald: { active: 'bg-emerald-500 text-white', idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
            rose:    { active: 'bg-rose-500 text-white',    idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
            slate:   { active: 'bg-slate-700 text-white',   idle: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
          }
          return (
            <button key={c.k}
              onClick={() => setFilter(c.k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? colorMap[c.color].active : colorMap[c.color].idle}`}>
              <Icon size={12} />
              {c.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-black/5'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* ── Lista ── */}
      {visible.length === 0 ? (
        <div className="text-center py-10 text-ink4 bg-surface border border-surface2 rounded-2xl">
          <p className="text-sm">No hay justificaciones en este filtro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(j => {
            const isOpen = expanded === j.id
            const isPending  = j.justification_status === 'pending'
            const isApproved = j.justification_status === 'approved'
            const isRejected = j.justification_status === 'rejected'
            const isBusy = busy === j.id

            return (
              <div key={j.id} className={`rounded-xl border overflow-hidden transition-all ${
                isOpen ? 'border-violet2/30 shadow-md bg-surface' : 'border-[rgba(0,0,0,0.06)] bg-surface hover:border-violet2/20'
              }`}>
                {/* Header */}
                <button onClick={() => setExpanded(isOpen ? null : j.id)}
                  className="w-full p-3 flex items-center gap-3 text-left cursor-pointer">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    isPending  ? 'bg-amber-100 text-amber-600'
                    : isApproved ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-rose-100 text-rose-600'
                  }`}>
                    {isPending ? <Clock3 size={16} /> : isApproved ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-ink">{j.student_name}</span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        j.status === 'absent' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {j.status === 'absent' ? 'Falta' : 'Atraso'}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink4 mt-0.5">
                      {new Date(j.date + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}<span className="font-medium">{j.subject_name}</span>
                    </p>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                    isPending  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                    : isApproved ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    {isPending ? 'Pendiente' : isApproved ? 'Aprobada' : 'Rechazada'}
                  </span>

                  <ChevronDown size={14} className={`text-ink4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Body */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[rgba(0,0,0,0.05)] space-y-3 pt-3 animate-fade-in">
                    {j.justification_text ? (
                      <div className="p-3 rounded-lg bg-bg border border-[rgba(0,0,0,0.04)]">
                        <p className="text-[10px] font-bold text-ink4 uppercase tracking-wider mb-1.5">Motivo</p>
                        <p className="text-sm text-ink2 leading-relaxed italic">&quot;{j.justification_text}&quot;</p>
                      </div>
                    ) : (
                      <p className="text-xs text-ink4 italic">Sin motivo detallado.</p>
                    )}

                    {j.justification_file_url && (
                      <a href={j.justification_file_url} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet2/10 text-violet2 text-xs font-bold hover:bg-violet2/20 transition-colors">
                        <FileText size={13} />
                        Ver documento adjunto →
                      </a>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-2 pt-1 border-t border-[rgba(0,0,0,0.05)]">
                        <span className="text-[10px] text-ink4 font-semibold flex-1">Resolución:</span>
                        <button onClick={() => review(j.id, 'approved')} disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50 border border-emerald-500/20">
                          {isBusy ? <span className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" /> : <ThumbsUp size={12} />}
                          Aprobar
                        </button>
                        <button onClick={() => review(j.id, 'rejected')} disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs font-bold hover:bg-rose-500/20 transition-colors disabled:opacity-50 border border-rose-500/20">
                          {isBusy ? <span className="w-3 h-3 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" /> : <ThumbsDown size={12} />}
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
