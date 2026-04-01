// src/components/planner/PlannerClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { PlanType, Planificacion } from '@/types/supabase'

const SUBJECTS = ['Matemáticas','Física','Química','Biología','Historia','Geografía','Literatura','Inglés','Filosofía','Ciencias Naturales','Educación Física','Arte']
const GRADES   = ['8° EGB','9° EGB','10° EGB','1° BGU','2° BGU','3° BGU']
const DURATIONS = ['45 minutos','90 minutos','2 sesiones (90 min c/u)','1 semana (5 sesiones)','Unidad completa (4 semanas)']
const METHODOLOGIES = ['Aprendizaje basado en problemas','Flipped classroom','Trabajo colaborativo','Gamificación','Proyecto integrador','Investigación guiada','Visualización 3D','Aprendizaje cooperativo','Design Thinking','Aula invertida']

const TYPES: { id: PlanType; label: string; icon: string; desc: string }[] = [
  { id: 'clase',   label: 'Clase',   icon: '📋', desc: 'Planificación de una sesión' },
  { id: 'unidad',  label: 'Unidad',  icon: '📚', desc: 'Unidad didáctica completa'   },
  { id: 'rubrica', label: 'Rúbrica', icon: '🎯', desc: 'Evaluación con descriptores'  },
]

export function PlannerClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [type,          setType]          = useState<PlanType>((searchParams.get('type') as PlanType) ?? 'clase')
  const [subject,       setSubject]       = useState('')
  const [grade,         setGrade]         = useState('')
  const [topic,         setTopic]         = useState('')
  const [duration,      setDuration]      = useState('45 minutos')
  const [methodologies, setMethodologies] = useState<string[]>(['Trabajo colaborativo', 'Visualización 3D'])
  const [extra,         setExtra]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState<Planificacion | null>(null)

  function toggleMethodology(m: string) {
    setMethodologies(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function handleGenerate() {
    if (!subject || !grade || !topic.trim()) {
      toast.error('Completa asignatura, nivel y tema')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/planificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, subject, grade, topic, duration, methodologies, extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.planificacion)
      toast.success('Planificación generada y guardada')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result.content)
    toast.success('Copiado al portapapeles')
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 items-start">
      {/* ── FORM PANEL ── */}
      <div className="card p-6 sticky top-24">
        <h2 className="font-display text-base font-bold tracking-tight mb-5">Configurar planificación</h2>

        {/* Type tabs */}
        <div className="flex bg-bg2 rounded-xl p-1 gap-1 mb-5">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex-1 py-2 rounded-[9px] text-xs font-semibold text-center transition-all ${
                type === t.id ? 'bg-surface2 text-ink' : 'text-ink3 hover:text-ink2'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Asignatura</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} className="input-base">
              <option value="">Seleccionar...</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nivel / Grado</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="input-base">
              <option value="">Seleccionar...</option>
              {GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Tema / Destreza</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Ej: La célula eucariota y sus orgánulos"
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Duración</label>
            <select value={duration} onChange={e => setDuration(e.target.value)} className="input-base">
              {DURATIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-2">Metodologías activas</label>
            <div className="flex flex-wrap gap-1.5">
              {METHODOLOGIES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMethodology(m)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    methodologies.includes(m)
                      ? 'bg-[rgba(124,109,250,0.15)] border-[rgba(124,109,250,0.4)] text-violet2'
                      : 'border-[rgba(120,100,255,0.14)] text-ink3 hover:text-ink2'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Notas adicionales (opcional)</label>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="Contexto especial, necesidades del grupo..."
              className="input-base resize-none h-16 text-sm"
            />
          </div>

          <button onClick={handleGenerate} disabled={loading} className="btn-primary w-full py-3">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="dot-bounce"><span/><span/><span/></span>
                Generando...
              </span>
            ) : '✨ Generar con IA'}
          </button>
        </div>
      </div>

      {/* ── RESULT PANEL ── */}
      <div className="card overflow-hidden min-h-[480px] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(120,100,255,0.14)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink2">
            {result && <span className="w-2 h-2 rounded-full bg-teal animate-[pulse-dot_2s_infinite]" />}
            {result ? result.title : 'Resultado'}
          </div>
          {result && (
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-secondary text-xs px-3 py-1.5">Copiar</button>
              <button
                onClick={() => router.push(`/dashboard/historial/${result.id}`)}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Ver completo →
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 px-6 py-8 text-ink3 text-sm">
            <span className="dot-bounce"><span className="w-1.5 h-1.5 bg-violet rounded-full"/><span className="w-1.5 h-1.5 bg-violet rounded-full"/><span className="w-1.5 h-1.5 bg-violet rounded-full"/></span>
            Generando tu planificación con IA...
          </div>
        )}

        {!loading && !result && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-ink3">
            <span className="text-5xl mb-4 opacity-40">✨</span>
            <p className="text-base font-medium mb-1">Tu planificación aparecerá aquí</p>
            <p className="text-sm">Completa el formulario y presiona <strong className="text-ink2">Generar con IA</strong></p>
          </div>
        )}

        {result && (
          <div className="flex-1 p-6 overflow-y-auto">
            <pre className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed font-body">
              {result.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
