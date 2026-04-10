'use client'
// src/components/horarios/HorariosClient.tsx

import { useState, useCallback, useEffect, useRef } from 'react'
import { StepInstitucion }  from './steps/StepInstitucion'
import { StepDocentes }     from './steps/StepDocentes'
import { StepHoras }        from './steps/StepHoras'
import { StepGenerar }      from './steps/StepGenerar'
import { StepEditar }       from './steps/StepEditar'
import { generarHorario }   from '@/lib/horarios/generator'
import type { HorariosState } from '@/types/horarios'
import { getEmptyConfig, DEFAULT_HORAS } from '@/types/horarios'
import toast from 'react-hot-toast'

const TABS = [
  { label: 'Institución',      icon: '🏫' },
  { label: 'Docentes',         icon: '👨‍🏫' },
  { label: 'Horas',            icon: '⏱' },
  { label: 'Generar',          icon: '⚡' },
  { label: 'Editar / Exportar', icon: '📋' },
]

export function HorariosClient() {
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<HorariosState>({
    config:        getEmptyConfig('Cargando...'),
    docentes:      [],
    horasPorCurso: DEFAULT_HORAS,
    horario:       {},
    step:          0,
  })

  useEffect(() => {
    fetch('/api/horarios', { cache: 'no-store' })
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
            // ✅ Restaurar el último tab activo, no siempre arrancar en 0
            step: typeof data.step === 'number' ? data.step : 0,
          })
        }
        setLoadingInitial(false)
      })
      .catch(() => {
        toast.error('Error al cargar datos del horario')
        setLoadingInitial(false)
      })
  }, [])

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
    updateState(s => ({ ...s, horario, step: 4 }), true)
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
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
            <StepDocentes
              docentes={state.docentes}
              jornadaInstitucional={state.config.jornada}
              nivelInstitucional={state.config.nivel}
              directoryMetadata={(state as any).directory || {}}
              onChange={docentes => updateState(s => ({ ...s, docentes }))}
              onBack={() => setTab(0)}
              onNext={() => setTab(2)}
            />
          )}
          {state.step === 2 && (
            <StepHoras
              config={state.config}
              cursos={state.config.cursos}
              docentes={state.docentes}
              horasPorCurso={state.horasPorCurso}
              jornada={state.config.jornada}
              onChange={horasPorCurso => updateState(s => ({ ...s, horasPorCurso }))}
              onBack={() => setTab(1)}
              onNext={() => setTab(3)}
            />
          )}
          {state.step === 3 && (
            <StepGenerar
              state={state}
              onBack={() => setTab(2)}
              onGenerar={handleGenerar}
            />
          )}
          {state.step === 4 && (
            <StepEditar
              state={state}
              onChange={horario => updateState(s => ({ ...s, horario }))}
              onBack={() => setTab(3)}
              onExport={handleExport}
            />
          )}
        </>
      )}
    </div>
  )
}
