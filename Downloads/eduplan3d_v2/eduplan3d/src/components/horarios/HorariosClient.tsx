'use client'
// src/components/horarios/HorariosClient.tsx

import { useState, useCallback, useEffect, useRef } from 'react'
import { StepInstitucion }  from './steps/StepInstitucion'
import { StepGenerar }      from './steps/StepGenerar'
import { StepEditar }       from './steps/StepEditar'
import { generarHorario }   from '@/lib/horarios/generator'
import type { HorariosState } from '@/types/horarios'
import { getEmptyConfig, DEFAULT_HORAS } from '@/types/horarios'
import toast from 'react-hot-toast'

const TABS = [
  { label: 'Institución',       icon: '🏫' },
  { label: 'Generar',           icon: '⚡' },
  { label: 'Editar / Exportar', icon: '📋' },
]

interface SlotInfo {
  nivel: string
  jornada: string
  key: string
}

const NIVELES  = ['Escuela', 'Colegio'] as const
const JORNADAS = ['MATUTINA', 'VESPERTINA'] as const

export function HorariosClient() {
  // ── Slot selector state ───────────────────────────────────────────────────
  const [slotSelected, setSlotSelected] = useState(false)
  const [savedSlots, setSavedSlots] = useState<SlotInfo[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [selectedNivel, setSelectedNivel] = useState<string>('Colegio')
  const [selectedJornada, setSelectedJornada] = useState<string>('MATUTINA')

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<HorariosState>({
    config:        getEmptyConfig('Cargando...'),
    docentes:      [],
    horasPorCurso: DEFAULT_HORAS,
    horario:       {},
    step:          0,
  })

  // ── Load saved slots on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/horarios?list=true', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.slots) setSavedSlots(data.slots)
        setLoadingSlots(false)
      })
      .catch(() => {
        setLoadingSlots(false)
      })
  }, [])

  // ── Load a specific slot ──────────────────────────────────────────────────
  function loadSlot(nivel: string, jornada: string) {
    setSlotSelected(true)
    setLoadingInitial(true)
    setSelectedNivel(nivel)
    setSelectedJornada(jornada)

    fetch(`/api/horarios?nivel=${encodeURIComponent(nivel)}&jornada=${encodeURIComponent(jornada)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          const safeConfig = { ...getEmptyConfig(data.config?.nombre || ''), ...data.config }
          safeConfig.cursos   = safeConfig.cursos   || []
          safeConfig.horarios = safeConfig.horarios || []
          safeConfig.tutores  = safeConfig.tutores  || {}

          const safeDocentes = (data.docentes || []).map((d: any) => ({
            id:       d.id,
            titulo:   d.titulo  || '',
            nombre:   d.nombre  || d.name || 'Profesor',
            materias: d.materias || d.subjects || [],
            jornada:  d.jornada  || 'AMBAS',
            nivel:    d.nivel    || 'AMBOS',
          }))

          setState({
            ...data,
            config:        safeConfig,
            docentes:      safeDocentes,
            horasPorCurso: data.horasPorCurso || {},
            horario:       data.horario       || {},
            step: typeof data.step === 'number' ? Math.min(data.step, 2) : 0,
          })
        }
        setLoadingInitial(false)
      })
      .catch(() => {
        toast.error('Error al cargar datos del horario')
        setLoadingInitial(false)
      })
  }

  // ── Guardado automático ────────────────────────────────────────────────────
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSaveRef = useRef<HorariosState | null>(null)

  const saveStateToDB = (newState: HorariosState, forceNow = false) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    pendingSaveRef.current = newState

    const doSave = async () => {
      pendingSaveRef.current = null
      setSaving(true)
      try {
        const res = await fetch('/api/horarios', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(newState),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error('Error al guardar: ' + (err.error || res.statusText))
        }
      } catch (e) {
        console.error('Error auto-saving', e)
        toast.error('Error de conexión al guardar')
      } finally {
        setSaving(false)
      }
    }

    if (forceNow) {
      doSave()
    } else {
      saveTimeoutRef.current = setTimeout(doSave, 800)
    }
  }

  // Guardar al abandonar la vista con el estado más reciente
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      const pending = pendingSaveRef.current
      if (pending) {
        fetch('/api/horarios', {
          method:    'POST',
          keepalive: true,
          headers:   { 'Content-Type': 'application/json' },
          body:      JSON.stringify(pending),
        }).catch(() => {})
      }
    }
  }, [])

  function updateState(
    updater: Partial<HorariosState> | ((s: HorariosState) => HorariosState),
    forceSave = false
  ) {
    setState(s => {
      const newState = typeof updater === 'function' ? updater(s) : { ...s, ...updater }
      saveStateToDB(newState, forceSave)
      return newState
    })
  }

  // ✅ setTab: siempre accesible, sin restricciones de orden
  function setTab(n: number) {
    updateState(s => ({ ...s, step: n }), true)
  }

  const handleGenerar = useCallback(() => {
    const horario = generarHorario(state.config, state.docentes, state.horasPorCurso)
    console.log('HORARIO OBTENIDO:', horario)
    updateState(s => ({ ...s, horario, step: 2 }), true)
    toast.success('Horario generado ✓')
  }, [state.config, state.docentes, state.horasPorCurso])

  async function handleExport() {
    const t = toast.loading('Generando Excel...')
    try {
      const res = await fetch('/api/horarios/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          config:        state.config,
          docentes:      state.docentes,
          horasPorCurso: state.horasPorCurso,
          horario:       state.horario,
        }),
      })
      if (!res.ok) throw new Error('Error al generar Excel')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `HORARIO_${state.config.anio.replace(/\s/g, '')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel descargado', { id: t })
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  // ── Go back to slot selector ──────────────────────────────────────────────
  function handleBackToSelector() {
    // Force save current state before going back
    if (pendingSaveRef.current || saveTimeoutRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      const pending = pendingSaveRef.current || state
      fetch('/api/horarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(pending),
      }).catch(() => {})
      pendingSaveRef.current = null
    }

    setSlotSelected(false)
    // Refresh saved slots
    fetch('/api/horarios?list=true', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.slots) setSavedSlots(data.slots)
      })
      .catch(() => {})
  }

  // ── SLOT SELECTOR SCREEN ──────────────────────────────────────────────────
  if (!slotSelected) {
    return (
      <div>
        <div className="card p-6 mb-6">
          <h2 className="font-display text-lg font-bold tracking-tight mb-2">Seleccionar Horario</h2>
          <p className="text-sm text-ink3 mb-6">
            Cada combinación de nivel y jornada tiene su propio horario independiente.
            Selecciona uno existente o crea uno nuevo.
          </p>

          {/* Saved slots */}
          {loadingSlots ? (
            <div className="flex justify-center py-8 text-ink3 text-sm">Cargando horarios guardados...</div>
          ) : savedSlots.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-ink2 mb-3">Horarios guardados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedSlots.map(slot => (
                  <button
                    key={slot.key}
                    onClick={() => loadSlot(slot.nivel, slot.jornada)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(120,100,255,0.2)] bg-[rgba(124,109,250,0.05)] hover:bg-[rgba(124,109,250,0.12)] transition-all text-left group"
                  >
                    <span className="w-10 h-10 rounded-xl bg-[rgba(124,109,250,0.15)] flex items-center justify-center text-lg">
                      {slot.nivel === 'Escuela' ? '🏫' : '🎓'}
                    </span>
                    <div>
                      <div className="font-semibold text-sm text-ink">
                        {slot.nivel === 'Escuela' ? 'Escuela / Básica' : 'Colegio / Bachillerato'}
                      </div>
                      <div className="text-xs text-ink3">
                        Jornada {slot.jornada === 'MATUTINA' ? '🌅 Matutina' : '🌇 Vespertina'}
                      </div>
                    </div>
                    <span className="ml-auto text-ink4 group-hover:text-violet2 transition-colors text-lg">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Create new */}
          <div>
            <h3 className="text-sm font-semibold text-ink2 mb-3">
              {savedSlots.length > 0 ? 'Crear nuevo horario' : 'Crear horario'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nivel</label>
                <select
                  value={selectedNivel}
                  onChange={e => setSelectedNivel(e.target.value)}
                  className="input-base"
                >
                  <option value="Colegio">Colegio / Bachillerato</option>
                  <option value="Escuela">Escuela / Básica</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Jornada</label>
                <select
                  value={selectedJornada}
                  onChange={e => setSelectedJornada(e.target.value)}
                  className="input-base"
                >
                  <option value="MATUTINA">Matutina 🌅</option>
                  <option value="VESPERTINA">Vespertina 🌇</option>
                </select>
              </div>
            </div>

            {/* Warn if slot already exists */}
            {savedSlots.some(s =>
              s.nivel.toLowerCase() === selectedNivel.toLowerCase() &&
              s.jornada.toUpperCase() === selectedJornada.toUpperCase()
            ) && (
              <div className="px-3 py-2 rounded-xl bg-[rgba(255,179,71,0.1)] border border-[rgba(255,179,71,0.25)] text-amber text-xs mb-4">
                ⚠ Ya existe un horario para {selectedNivel} — {selectedJornada}. Se abrirá el existente.
              </div>
            )}

            <button
              onClick={() => loadSlot(selectedNivel, selectedJornada)}
              className="btn-primary px-8 py-3"
            >
              {savedSlots.some(s =>
                s.nivel.toLowerCase() === selectedNivel.toLowerCase() &&
                s.jornada.toUpperCase() === selectedJornada.toUpperCase()
              ) ? 'Abrir horario existente →' : 'Crear horario →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── WIZARD SCREEN ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Slot indicator + back button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleBackToSelector}
          className="btn-secondary text-sm px-3 py-1.5"
        >
          ← Horarios
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[rgba(124,109,250,0.08)] border border-[rgba(120,100,255,0.15)]">
          <span className="text-sm">
            {selectedNivel === 'Escuela' ? '🏫' : '🎓'}
          </span>
          <span className="text-sm font-medium text-ink2">
            {selectedNivel === 'Escuela' ? 'Escuela / Básica' : 'Colegio / Bachillerato'}
          </span>
          <span className="text-ink4 text-xs">•</span>
          <span className="text-sm text-ink3">
            {selectedJornada === 'MATUTINA' ? '🌅 Matutina' : '🌇 Vespertina'}
          </span>
        </div>
      </div>

      {/* ── BARRA DE TABS ── */}
      <div className="flex items-center gap-1 mb-8 bg-surface border border-[rgba(120,100,255,0.1)] rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((tab, i) => {
          const isActive    = state.step === i
          const isCompleted = !loadingInitial && i < state.step

          return (
            <button
              key={i}
              onClick={() => !loadingInitial && setTab(i)}
              disabled={loadingInitial}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                transition-all flex-shrink-0 relative
                ${isActive
                  ? 'bg-[rgba(124,109,250,0.18)] text-violet2 shadow-[0_0_0_1px_rgba(124,109,250,0.35)]'
                  : isCompleted
                  ? 'text-teal hover:bg-[rgba(38,215,180,0.08)] hover:text-teal'
                  : 'text-ink3 hover:bg-[rgba(0,0,0,0.04)] hover:text-ink2'
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              <span className={`
                w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                ${isActive    ? 'bg-violet text-white'
                : isCompleted ? 'bg-teal text-[#04342C]'
                : 'bg-surface2 text-ink3'}
              `}>
                {isCompleted ? '✓' : i + 1}
              </span>
              <span>{tab.label}</span>

              {/* Indicador de guardado en el tab activo */}
              {isActive && saving && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />
              )}
            </button>
          )
        })}

        {/* Indicador de guardado global */}
        <div className="ml-auto pr-2 flex-shrink-0">
          {saving
            ? <span className="text-[11px] text-ink4 animate-pulse">Guardando...</span>
            : !loadingInitial && <span className="text-[11px] text-teal">✓ Guardado</span>
          }
        </div>
      </div>

      {/* ── CONTENIDO DEL TAB ACTIVO ── */}
      {loadingInitial ? (
        <div className="flex justify-center items-center py-20 text-ink3">
          Cargando datos de institución...
        </div>
      ) : (
        <>
          {state.step === 0 && (
            <StepInstitucion
              config={state.config}
              onChange={config => updateState(s => ({ ...s, config }))}
              onNext={() => setTab(1)}
            />
          )}
          {state.step === 1 && (
            <StepGenerar
              state={state}
              onBack={() => setTab(0)}
              onGenerar={handleGenerar}
            />
          )}
          {state.step === 2 && (
            <StepEditar
              state={state}
              onChange={horario => updateState(s => ({ ...s, horario }))}
              onBack={() => setTab(1)}
              onExport={handleExport}
            />
          )}
        </>
      )}
    </div>
  )
}
