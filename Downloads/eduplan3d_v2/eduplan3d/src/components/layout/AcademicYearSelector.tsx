// src/components/layout/AcademicYearSelector.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useAcademicYear } from '@/lib/context/AcademicYearContext'
import toast from 'react-hot-toast'

interface Props {
  role: string | null | undefined
}

export function AcademicYearSelector({ role }: Props) {
  const ctx = useAcademicYear()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newIsCurrent, setNewIsCurrent] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setShowNewForm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Oculto para estudiantes o si no hay contexto (planner_solo/sin institución)
  if (!ctx || role === 'student' || role === 'parent') return null
  if (ctx.years.length === 0) return null

  const viewing = ctx.viewingYear
  const isHistoric = ctx.isReadOnly

  async function handleCreate() {
    const label = newLabel.trim()
    if (!label) return
    setCreating(true)
    try {
      const res = await fetch('/api/academic-years', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ label, is_current: newIsCurrent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error al crear año')
      toast.success(`Año ${label} creado${newIsCurrent ? ' y marcado como actual' : ''}`)
      setNewLabel(''); setNewIsCurrent(false); setShowNewForm(false)
      await ctx!.refresh()
      // Si se marcó como current, recargar para que todo apunte al nuevo
      if (newIsCurrent) setTimeout(() => window.location.reload(), 400)
    } catch (e: any) {
      toast.error(e?.message || 'Error al crear año')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
          isHistoric
            ? 'bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.35)] text-amber'
            : 'bg-[rgba(38,215,180,0.1)] border-[rgba(38,215,180,0.25)] text-teal hover:bg-[rgba(38,215,180,0.15)]'
        }`}
        title={isHistoric ? 'Viendo año histórico (solo lectura)' : 'Año lectivo actual'}
      >
        <span>📅</span>
        <span className="truncate max-w-[120px]">{viewing?.label || '—'}</span>
        {isHistoric && <span className="text-[9px]">histórico</span>}
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] w-64 bg-surface2 border border-[rgba(120,100,255,0.2)] rounded-2xl p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] z-50">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-ink3 font-semibold">
            Año lectivo
          </div>
          <div className="max-h-72 overflow-y-auto">
            {ctx.years.map(y => {
              const isCurrent = y.id === ctx.currentYearId
              const isSelected = y.id === ctx.viewingYearId
              return (
                <button
                  key={y.id}
                  onClick={() => { setOpen(false); ctx.setViewingYearId(y.id) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                    isSelected
                      ? 'bg-[rgba(124,109,250,0.15)] text-ink'
                      : 'text-ink2 hover:bg-surface hover:text-ink'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{y.label}</span>
                    {isCurrent && (
                      <span className="text-[9px] bg-[rgba(38,215,180,0.15)] text-teal px-1.5 py-0.5 rounded-full">
                        Actual
                      </span>
                    )}
                    {y.status === 'archived' && (
                      <span className="text-[9px] bg-[rgba(148,163,184,0.2)] text-ink3 px-1.5 py-0.5 rounded-full">
                        Archivado
                      </span>
                    )}
                  </span>
                  {isSelected && <span className="text-violet2">✓</span>}
                </button>
              )
            })}
          </div>

          {role === 'admin' && (
            <div className="border-t border-[rgba(120,100,255,0.14)] mt-2 pt-2">
              {!showNewForm ? (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-violet2 hover:bg-[rgba(124,109,250,0.08)] transition-all"
                >
                  <span>＋</span> Nuevo año lectivo
                </button>
              ) : (
                <div className="px-3 py-2 space-y-2">
                  <input
                    type="text"
                    placeholder="Ej: 2027 - 2028"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    className="w-full text-sm px-2 py-1.5 rounded-lg bg-[rgba(0,0,0,0.15)] border border-[rgba(120,100,255,0.2)] text-ink outline-none focus:border-violet2"
                    autoFocus
                  />
                  <label className="flex items-center gap-2 text-[11px] text-ink3">
                    <input
                      type="checkbox"
                      checked={newIsCurrent}
                      onChange={e => setNewIsCurrent(e.target.checked)}
                    />
                    Marcar como actual (reemplaza al actual)
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newLabel.trim()}
                      className="flex-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-violet2 text-white disabled:opacity-50"
                    >
                      {creating ? 'Creando...' : 'Crear'}
                    </button>
                    <button
                      onClick={() => { setShowNewForm(false); setNewLabel(''); setNewIsCurrent(false) }}
                      className="text-[11px] px-2 py-1.5 rounded-lg text-ink3 hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
