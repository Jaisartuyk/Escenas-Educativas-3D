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

const STEPS = [
  { n: 1, label: 'Institución' },
  { n: 2, label: 'Docentes' },
  { n: 3, label: 'Horas' },
  { n: 4, label: 'Generar' },
  { n: 5, label: 'Editar y exportar' },
]

export function HorariosClient() {
  const [loadingInitial, setLoadingInitial] = useState(true)
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
          // Safeguard: Merge backend config with empty config to ensure all arrays/objects exist
          const safeConfig = { ...getEmptyConfig(data.config?.nombre || ''), ...data.config }
          safeConfig.cursos = safeConfig.cursos || []
          safeConfig.horarios = safeConfig.horarios || []
          safeConfig.tutores = safeConfig.tutores || {}
          
          // Safeguard: Normalize teachers if english keys were used by accident in the DB
          const safeDocentes = (data.docentes || []).map((d: any) => ({
            id: d.id,
            titulo: d.titulo || '',
            nombre: d.nombre || d.name || 'Profesor',
            materias: d.materias || d.subjects || [],
            jornada: d.jornada || 'AMBAS',
            nivel: d.nivel || 'AMBOS'
          }))

          setState({
            ...data,
            config: safeConfig,
            docentes: safeDocentes,
            horasPorCurso: data.horasPorCurso || {},
            horario: data.horario || {},
            step: 0
          })
        }
        setLoadingInitial(false)
      })
      .catch((e) => {
        toast.error('Error al cargar datos del horario')
        setLoadingInitial(false)
      })
  }, [])

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastStateRef = useRef<HorariosState | null>(null)

  // Sincroniza al desmontar la vista si hay cambios en cola (Navigator abandona / cambia pagina)
  useEffect(() => {
    lastStateRef.current = state
  }, [state])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current && lastStateRef.current) {
        clearTimeout(saveTimeoutRef.current)
        try {
           fetch('/api/horarios', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lastStateRef.current) }).catch(()=>{})
        } catch(e) {}
      }
    }
  }, [])

  // Guarda automáticamente en el backend (Debounced 1 segundo para evitar Overwrites)
  const saveStateToDB = (newState: HorariosState, forceNow = false) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    
    const doSave = async () => {
      try {
        await fetch('/api/horarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newState),
        })
      } catch (e) {
        console.error('Error auto-saving', e)
      }
    }

    if (forceNow) {
      doSave()
    } else {
      saveTimeoutRef.current = setTimeout(doSave, 800)
    }
  }

  function updateState(updater: Partial<HorariosState> | ((s: HorariosState) => HorariosState), forceSave = false) {
    setState((s) => {
      const newState = typeof updater === 'function' ? updater(s) : { ...s, ...updater }
      saveStateToDB(newState, forceSave)
      return newState
    })
  }

  function setStep(n: number) { 
    updateState(s => ({ ...s, step: n }), true) // FORZAR GUARDADO INMEDIATO
  }

  const handleGenerar = useCallback(() => {
    const horario = generarHorario(state.config, state.docentes, state.horasPorCurso)
    updateState(s => ({ ...s, horario, step: 4 }))
    toast.success('Horario generado sin conflictos ✓')
  }, [state.config, state.docentes, state.horasPorCurso])

  async function handleExport() {
    const t = toast.loading('Generando Excel...')
    try {
      const res = await fetch('/api/horarios/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  return (
    <div>
      {/* ── STEPS INDICATOR ── */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => i <= state.step || i === state.step + 1 ? setStep(i) : undefined}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                state.step === i
                  ? 'bg-[rgba(124,109,250,0.15)] border-[rgba(124,109,250,0.4)] text-violet2'
                  : i < state.step
                  ? 'bg-[rgba(38,215,180,0.1)] border-[rgba(38,215,180,0.3)] text-teal cursor-pointer'
                  : 'border-[rgba(120,100,255,0.14)] text-ink3 cursor-not-allowed'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i < state.step ? 'bg-teal text-[#04342C]' : state.step === i ? 'bg-violet text-white' : 'bg-surface2 text-ink3'
              }`}>
                {i < state.step ? '✓' : s.n}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px flex-shrink-0 ${i < state.step ? 'bg-teal' : 'bg-[rgba(120,100,255,0.2)]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP CONTENT ── */}
      {loadingInitial ? (
        <div className="flex justify-center items-center py-20 text-ink3">Cargando datos de institución...</div>
      ) : (
        <>
          {state.step === 0 && (
            <StepInstitucion
              config={state.config}
              onChange={config => updateState(s => ({ ...s, config }))}
              onNext={() => setStep(1)}
            />
          )}
          {state.step === 1 && (
            <StepDocentes
              docentes={state.docentes}
              jornadaInstitucional={state.config.jornada}
              nivelInstitucional={state.config.nivel}
              directoryMetadata={(state as any).directory || {}}
              onChange={docentes => updateState(s => ({ ...s, docentes }))}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
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
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {state.step === 3 && (
            <StepGenerar
              state={state}
              onBack={() => setStep(2)}
              onGenerar={handleGenerar}
            />
          )}
          {state.step === 4 && (
            <StepEditar
              state={state}
              onChange={horario => updateState(s => ({ ...s, horario }))}
              onBack={() => setStep(3)}
              onExport={handleExport}
            />
          )}
        </>
      )}
    </div>
  )
}
