'use client'
// src/components/inserciones-distribucion/MatrizClient.tsx
// UI de la Matriz Anual: 3 trimestres × 5 inserciones toggleables.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle2, Save, Loader2, Info } from 'lucide-react'
import { INSERCIONES, type InsercionId } from '@/lib/pedagogy/inserciones'
import { setTrimestreInserciones } from '@/lib/actions/inserciones-distribucion'

type Row = { trimestre: 1 | 2 | 3; inserciones: InsercionId[] }

export function MatrizClient({
  initialRows,
  academicYearId,
  canEdit,
}: {
  initialRows: Row[]
  academicYearId: string | null
  canEdit: boolean
}) {
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [savingTrim, setSavingTrim] = useState<number | null>(null)
  const [dirty, setDirty] = useState<Set<number>>(new Set())

  function toggle(trim: 1 | 2 | 3, id: InsercionId) {
    if (!canEdit) return
    setRows(prev =>
      prev.map(r => {
        if (r.trimestre !== trim) return r
        const has = r.inserciones.includes(id)
        return {
          ...r,
          inserciones: has
            ? r.inserciones.filter(x => x !== id)
            : [...r.inserciones, id],
        }
      })
    )
    setDirty(prev => new Set(prev).add(trim))
  }

  async function saveTrim(trim: 1 | 2 | 3) {
    const row = rows.find(r => r.trimestre === trim)
    if (!row) return
    setSavingTrim(trim)
    try {
      const r = await setTrimestreInserciones({
        trimestre: trim,
        inserciones: row.inserciones,
        academicYearId,
      })
      if (!r.ok) throw new Error(r.error || 'Error desconocido')
      setDirty(prev => {
        const n = new Set(prev)
        n.delete(trim)
        return n
      })
      toast.success(`Trimestre ${trim} guardado`)
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err.message || ''))
    } finally {
      setSavingTrim(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-violet/5 border border-violet/20">
        <Info size={16} className="text-violet flex-shrink-0 mt-0.5" />
        <div className="text-xs text-ink3 leading-snug">
          <strong className="text-ink2">Cómo funciona:</strong> selecciona qué
          inserciones se trabajan en cada trimestre del año lectivo. Cuando un
          docente genere una planificación de un trimestre, las inserciones
          asignadas aparecerán pre-seleccionadas (modificables). Las inserciones
          se integran <em>dentro</em> de las DCDs, no como sección aparte.
          {!canEdit && (
            <div className="text-amber-700 mt-1.5">
              ⚠ Solo administración/rectoría puede modificar la matriz.
            </div>
          )}
        </div>
      </div>

      {/* 3 cards, una por trimestre */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {rows.map(row => {
          const isDirty = dirty.has(row.trimestre)
          const isSaving = savingTrim === row.trimestre
          return (
            <div
              key={row.trimestre}
              className="bg-white border border-line rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold">
                  Trimestre {row.trimestre}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink4">
                  {row.inserciones.length} de {INSERCIONES.length}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {INSERCIONES.map(i => {
                  const active = row.inserciones.includes(i.id)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggle(row.trimestre, i.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? `${i.bg} ${i.border} ${i.text}`
                          : 'bg-bg border-surface2 text-ink3'
                      } ${
                        canEdit
                          ? 'hover:border-ink4 cursor-pointer'
                          : 'cursor-not-allowed opacity-80'
                      }`}
                      title={i.description}
                    >
                      <span className="text-base leading-none">{i.emoji}</span>
                      <span className="flex-1 text-left">{i.shortLabel}</span>
                      {active && (
                        <CheckCircle2 size={14} className="opacity-80" />
                      )}
                    </button>
                  )
                })}
              </div>

              {canEdit && (
                <button
                  type="button"
                  disabled={!isDirty || isSaving}
                  onClick={() => saveTrim(row.trimestre)}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    isDirty
                      ? 'bg-violet text-white hover:bg-violet/90'
                      : 'bg-bg border border-line text-ink4 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Guardando…
                    </>
                  ) : isDirty ? (
                    <>
                      <Save size={12} />
                      Guardar Trimestre {row.trimestre}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} />
                      Guardado
                    </>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
