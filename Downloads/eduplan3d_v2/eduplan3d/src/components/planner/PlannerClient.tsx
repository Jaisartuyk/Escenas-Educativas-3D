// src/components/planner/PlannerClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Planificacion } from '@/types/supabase'
import {
  BookOpen, CalendarDays, Clock, GraduationCap,
  FileText, ClipboardList, Target, Sparkles, Copy, ExternalLink,
} from 'lucide-react'
import { METHODOLOGIES, DEFAULT_METHODOLOGY } from '@/lib/pedagogy/methodologies'

// ── Constants ────────────────────────────────────────────────────────────────
const TRIMESTRES = [
  { value: 1, label: 'Trimestre 1' },
  { value: 2, label: 'Trimestre 2' },
  { value: 3, label: 'Trimestre 3' },
]

// PARCIALES se genera dinámicamente según parcialesCount

const SEMANAS = [
  { value: 1, label: 'Semana 1' },
  { value: 2, label: 'Semana 2' },
  { value: 3, label: 'Semana 3' },
  { value: 4, label: 'Semana 4' },
  { value: 5, label: 'Semana 5' },
  { value: 6, label: 'Semana 6 (Aporte)' },
]

const EJES_TRANSVERSALES = ['Justicia', 'Innovacion', 'Solidaridad']

const GENERATION_MODES = [
  { id: 'clase',   label: 'Clase diaria',     icon: FileText,     desc: 'Una sesion de clase' },
  { id: 'parcial', label: 'Parcial completo', icon: CalendarDays, desc: '6 semanas de clases' },
  { id: 'unidad',  label: 'Unidad didactica', icon: BookOpen,     desc: 'Unidad completa' },
  { id: 'rubrica', label: 'Rubrica',          icon: Target,       desc: 'Evaluacion con descriptores' },
]

// ── Component ────────────────────────────────────────────────────────────────
export function PlannerClient({
  teacherName, teacherPlan, institutionName,
  subjects, periodMinutes, parcialesCount = 2,
}: {
  teacherName: string
  teacherPlan: string
  institutionName: string
  subjects: any[]
  periodMinutes: number
  parcialesCount?: number
}) {
  const router = useRouter()

  // Form state
  const [mode,       setMode]       = useState('clase')
  const [subjectId,  setSubjectId]  = useState('')
  const [trimestre,  setTrimestre]  = useState(1)
  const [parcial,    setParcial]    = useState(1)
  const [semana,     setSemana]     = useState(1)
  const [topic,      setTopic]      = useState('')
  const [eje,        setEje]        = useState('Justicia')
  const [methodology, setMethodology] = useState(DEFAULT_METHODOLOGY)
  const [cuadernillo, setCuadernillo] = useState('')
  const [extra,      setExtra]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<Planificacion | null>(null)
  const [results,    setResults]    = useState<Planificacion[]>([]) // for parcial mode

  // Derived
  const selectedSubject = subjects.find((s: any) => s.id === subjectId)
  const courseName  = selectedSubject?.course?.name || ''
  const courseLevel  = selectedSubject?.course?.level || ''
  const courseParallel = selectedSubject?.course?.parallel || ''
  const weeklyHours = selectedSubject?.weekly_hours || 0
  const subjectName = selectedSubject?.name || ''
  const gradeLabel  = `${courseName} ${courseParallel}`.trim()
  const classDuration = `${periodMinutes * (weeklyHours > 0 ? Math.min(weeklyHours, 2) : 1)} minutos`

  // Unique subjects for dropdown (group by name + course)
  const subjectOptions = subjects.map((s: any) => ({
    id: s.id,
    label: `${s.name} — ${s.course?.name || ''} ${s.course?.parallel || ''}`.trim(),
    name: s.name,
    course: s.course,
  }))

  async function handleGenerate() {
    if (!subjectId) return toast.error('Selecciona una materia')
    if (mode === 'clase' && !topic.trim()) return toast.error('Ingresa el tema de la clase')

    setLoading(true)
    setResult(null)
    setResults([])

    try {
      const payload = {
        type: mode,
        subject: subjectName,
        grade: gradeLabel,
        topic,
        duration: classDuration,
        methodology,
        methodologies: [methodology],
        extra,
        // New fields
        trimestre,
        parcial,
        semana,
        eje,
        cuadernillo,
        periodMinutes,
        weeklyHours,
        teacherName,
        institutionName,
        subjectId,
      }

      if (mode === 'parcial') {
        // Generate all 6 weeks — multiple calls
        const allResults: Planificacion[] = []
        for (let w = 1; w <= 6; w++) {
          const res = await fetch('/api/planificaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, type: 'clase', semana: w, topic: topic || `Semana ${w}` }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          allResults.push(data.planificacion)
        }
        setResults(allResults)
        toast.success(`${allResults.length} planificaciones generadas`)
      } else {
        const res = await fetch('/api/planificaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setResult(data.planificacion)
        toast.success('Planificacion generada y guardada')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  const showSemana = mode === 'clase'
  const showTopic  = mode === 'clase' || mode === 'rubrica'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
      {/* ── FORM PANEL ── */}
      <div className="bg-surface rounded-2xl border border-surface2 p-6 lg:sticky lg:top-24 space-y-5">
        <h2 className="font-display text-base font-bold tracking-tight flex items-center gap-2">
          <Sparkles size={18} style={{ color: '#7C6DFA' }} />
          Configurar planificacion
        </h2>

        {/* Mode selector */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink3 mb-2">Tipo de generacion</label>
          <div className="grid grid-cols-2 gap-2">
            {GENERATION_MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                    mode === m.id
                      ? 'text-white shadow-md border-transparent'
                      : 'bg-bg border-surface2 text-ink3 hover:border-ink4'
                  }`}
                  style={mode === m.id ? { backgroundColor: '#7C6DFA' } : {}}
                >
                  <Icon size={14} />
                  <div>
                    <div className="font-semibold">{m.label}</div>
                    <div className={`text-[10px] ${mode === m.id ? 'text-white/70' : 'text-ink4'}`}>{m.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Subject selector — from teacher's real data */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
            <GraduationCap size={12} className="inline mr-1" />
            Materia y Curso
          </label>
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
          >
            <option value="">Seleccionar...</option>
            {subjectOptions.map((s: any) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {selectedSubject && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface2 text-ink3">
                <Clock size={10} className="inline mr-0.5" /> {weeklyHours}h/sem
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface2 text-ink3">
                {periodMinutes} min/periodo
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface2 text-ink3">
                {classDuration}/clase
              </span>
            </div>
          )}
        </div>

        {/* Trimestre + Parcial + Semana */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Trimestre</label>
            <select
              value={trimestre}
              onChange={e => setTrimestre(Number(e.target.value))}
              className="w-full bg-bg border border-surface2 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-violet/50"
            >
              {TRIMESTRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Parcial</label>
            <select
              value={parcial}
              onChange={e => setParcial(Number(e.target.value))}
              className="w-full bg-bg border border-surface2 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-violet/50"
            >
              {Array.from({ length: parcialesCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>Parcial {i + 1} (Unidad)</option>
              ))}
            </select>
          </div>
          {showSemana && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Semana</label>
              <select
                value={semana}
                onChange={e => setSemana(Number(e.target.value))}
                className="w-full bg-bg border border-surface2 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-violet/50"
              >
                {SEMANAS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Eje transversal */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">Eje transversal</label>
          <div className="flex gap-1.5">
            {EJES_TRANSVERSALES.map(e => (
              <button
                key={e}
                onClick={() => setEje(e)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                  eje === e
                    ? 'text-white border-transparent'
                    : 'bg-bg border-surface2 text-ink3 hover:border-ink4'
                }`}
                style={eje === e ? { backgroundColor: '#7C6DFA' } : {}}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Estrategia metodológica */}
        {(mode === 'clase' || mode === 'parcial') && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
              Estrategia metodológica
            </label>
            <select
              value={methodology}
              onChange={e => setMethodology(e.target.value)}
              className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
            >
              {METHODOLOGIES.map(m => (
                <option key={m.code} value={m.code}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink4 mt-1">
              Define las fases de las actividades en la clase.
            </p>
          </div>
        )}

        {/* Topic */}
        {showTopic && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
              {mode === 'clase' ? 'Tema / Destreza de la clase' : 'Tema / Actividad a evaluar'}
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={mode === 'clase' ? 'Ej: La celula eucariota y sus organulos' : 'Ej: Proyecto de investigacion'}
              className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
            />
          </div>
        )}

        {/* Cuadernillo reference */}
        {(mode === 'clase' || mode === 'parcial') && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">
              Ref. Cuadernillo de Trabajo (opcional)
            </label>
            <input
              value={cuadernillo}
              onChange={e => setCuadernillo(e.target.value)}
              placeholder="Ej: Pagina 45-48, Ejercicios 1 al 5"
              className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
            />
          </div>
        )}

        {/* Extra notes */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1.5">Notas adicionales (opcional)</label>
          <textarea
            value={extra}
            onChange={e => setExtra(e.target.value)}
            placeholder="Contexto especial, NEE del grupo, recursos disponibles..."
            className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50 resize-none h-16"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#7C6DFA' }}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {mode === 'parcial' ? 'Generando 6 semanas...' : 'Generando...'}
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {mode === 'parcial' ? 'Generar parcial completo' : 'Generar con IA'}
            </>
          )}
        </button>

        {mode === 'parcial' && (
          <p className="text-[10px] text-ink4 text-center">
            Se generaran 6 planificaciones (1 por semana del parcial)
          </p>
        )}
      </div>

      {/* ── RESULT PANEL ── */}
      <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden min-h-[480px] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink2">
            {(result || results.length > 0) && <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#10b981' }} />}
            {result ? result.title : results.length > 0 ? `Parcial T${trimestre}-P${parcial} — ${subjectName}` : 'Resultado'}
          </div>
          {result && (
            <div className="flex gap-2">
              <button onClick={() => handleCopy(result.content)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface2 text-xs font-medium text-ink3 hover:bg-surface2 transition-colors">
                <Copy size={12} /> Copiar
              </button>
              <button
                onClick={() => router.push(`/dashboard/historial/${result.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                style={{ backgroundColor: '#7C6DFA' }}
              >
                <ExternalLink size={12} /> Ver completo
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-3 border-surface2 rounded-full mx-auto relative" style={{ borderTopColor: '#7C6DFA', animation: 'spin 1s linear infinite' }} />
              <div>
                <p className="text-sm font-medium text-ink2">Generando planificacion MINEDUC...</p>
                <p className="text-xs text-ink4 mt-1">Formato {methodology} con tiempos calculados</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !result && results.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-ink3">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
              <ClipboardList size={28} style={{ color: '#7C6DFA' }} />
            </div>
            <p className="text-base font-medium mb-1">Tu planificacion aparecera aqui</p>
            <p className="text-sm text-ink4">Selecciona materia, trimestre y tema, luego presiona <strong className="text-ink2">Generar con IA</strong></p>
          </div>
        )}

        {/* Single result */}
        {result && (
          <div className="flex-1 p-6 overflow-y-auto">
            <pre className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed font-body">
              {result.content}
            </pre>
          </div>
        )}

        {/* Parcial results — multiple weeks */}
        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto divide-y divide-surface2">
            {results.map((r, idx) => (
              <div key={r.id} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-sm" style={{ color: '#7C6DFA' }}>
                    Semana {idx + 1}{idx === 5 ? ' (Aporte)' : ''}
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(r.content)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-surface2 text-[11px] text-ink3 hover:bg-surface2">
                      <Copy size={10} /> Copiar
                    </button>
                    <button onClick={() => router.push(`/dashboard/historial/${r.id}`)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-white" style={{ backgroundColor: '#7C6DFA' }}>
                      <ExternalLink size={10} /> Ver
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-ink2 whitespace-pre-wrap leading-relaxed font-body">
                  {r.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
