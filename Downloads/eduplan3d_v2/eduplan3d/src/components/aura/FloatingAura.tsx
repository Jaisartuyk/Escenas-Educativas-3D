// src/components/aura/FloatingAura.tsx
// "Aura" — copiloto pedagógico flotante. Montado en el dashboard layout.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Send, Trash2, Bot, FileText, Download } from 'lucide-react'
import { NEE_SIN_DISCAPACIDAD, NEE_CON_DISCAPACIDAD } from '@/lib/pedagogy/nee'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

const STORAGE_KEY = 'aura_chat_v1'
const MAX_STORED = 40 // se guardan como máximo 40 mensajes

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: '📚 Explícame ERCA',         prompt: 'Explícame brevemente la metodología ERCA y cuándo conviene usarla.' },
  { label: '✨ Actividades para un tema', prompt: 'Sugiéreme 3 actividades creativas para un tema. Te digo el tema:' },
  { label: '♿ Adaptar a NEE',           prompt: 'Quiero adaptar una actividad para un estudiante con TDAH. ¿Qué ajustes claves recomiendas?' },
  { label: '📝 Preguntas de examen',    prompt: 'Necesito 5 preguntas tipo opción múltiple sobre un tema. Te paso el tema:' },
  { label: '🎯 Redactar indicador',     prompt: 'Ayúdame a redactar un indicador de evaluación para una destreza que te diré.' },
]

export function FloatingAura() {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Generador de evaluaciones
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalResult, setEvalResult] = useState<{ regular: string; variants: Array<{ kind: string; label: string; content: string }> } | null>(null)
  const [evalTab, setEvalTab] = useState(0)
  const [evalForm, setEvalForm] = useState({
    tema: '',
    grado: '',
    asignatura: '',
    numPreguntas: 10,
    nivelDificultad: 'mixto' as 'basico' | 'intermedio' | 'avanzado' | 'mixto',
    tipos: ['opcion_multiple', 'respuesta_corta'] as string[],
    incluirRubrica: true,
    incluirNeeSinDisc: false,
    neeSinDiscCodes: [] as string[],
    incluirDiac: false,
    neeConDiscCode: '',
    diacGradoReal: '',
    diacEstudiante: '',
    instruccionesExtra: '',
  })

  // Hidratar desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORED))
      }
    } catch {
      // ignore
    }
  }, [])

  // Persistir en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)))
    } catch {
      // quota exceeded o similar — ignorar
    }
  }, [messages])

  // Scroll auto al final cuando hay mensajes nuevos
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, loading])

  const isOnPlanificador = pathname.startsWith('/dashboard/planificador')
  const isOnBiblioteca   = pathname.startsWith('/dashboard/biblioteca')
  const isOnHistorial    = pathname.startsWith('/dashboard/historial')
  const contextLabel = useMemo(() => {
    if (isOnPlanificador) return 'Planificador'
    if (isOnBiblioteca)   return 'Biblioteca'
    if (isOnHistorial)    return 'Historial'
    if (pathname.startsWith('/dashboard/horarios'))    return 'Horarios'
    if (pathname.startsWith('/dashboard/docente'))     return 'Docente'
    if (pathname.startsWith('/dashboard/alumno'))      return 'Estudiante'
    return 'Dashboard'
  }, [pathname, isOnPlanificador, isOnBiblioteca, isOnHistorial])

  async function sendMessage(text: string) {
    const clean = text.trim()
    if (!clean || loading) return

    const userMsg: ChatMessage = { role: 'user', content: clean, ts: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/aura/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          pathname,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error del servidor')
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data?.message?.content || 'No recibí respuesta.',
        ts: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${err.message || 'No pude responder. Intenta de nuevo.'}`, ts: Date.now() },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  async function generarEvaluacion() {
    if (!evalForm.tema.trim() || evalLoading) return
    setEvalLoading(true)
    setEvalResult(null)
    try {
      const res = await fetch('/api/aura/evaluacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error generando evaluacion')
      setEvalResult({ regular: data.regular, variants: data.variants || [] })
      setEvalTab(0)
    } catch (err: any) {
      alert(err.message || 'No se pudo generar la evaluacion')
    } finally {
      setEvalLoading(false)
    }
  }

  function descargarMarkdown(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleTipo(t: string) {
    setEvalForm(f => ({
      ...f,
      tipos: f.tipos.includes(t) ? f.tipos.filter(x => x !== t) : [...f.tipos, t],
    }))
  }

  function toggleNeeSinDisc(code: string) {
    setEvalForm(f => ({
      ...f,
      neeSinDiscCodes: f.neeSinDiscCodes.includes(code)
        ? f.neeSinDiscCodes.filter(x => x !== code)
        : [...f.neeSinDiscCodes, code],
    }))
  }

  function clearChat() {
    if (messages.length === 0) return
    if (!confirm('¿Borrar toda la conversación con Aura?')) return
    setMessages([])
  }

  return (
    <>
      {/* ── Botón flotante ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #7C6DFA 0%, #26D7B4 100%)',
          }}
          aria-label="Abrir Aura, copiloto pedagógico"
        >
          <Sparkles size={18} />
          <span className="hidden sm:inline">Aura</span>
          {messages.some(m => m.role === 'assistant') && (
            <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
          )}
        </button>
      )}

      {/* ── Panel expandido ── */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(380px,calc(100vw-24px))] h-[min(560px,calc(100vh-48px))] bg-white rounded-2xl shadow-2xl border border-[rgba(120,100,255,0.2)] flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: 'linear-gradient(135deg, #7C6DFA 0%, #26D7B4 100%)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">Aura</p>
                <p className="text-[10px] text-white/80 leading-tight">Copiloto pedagógico · {contextLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEvalOpen(true)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Generar evaluacion"
                title="Generar evaluacion / examen"
              >
                <FileText size={14} />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Borrar conversación"
                  title="Borrar conversación"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Cerrar Aura"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#faf9ff]">
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-violet-100 to-teal-100 flex items-center justify-center">
                  <Sparkles size={24} style={{ color: '#7C6DFA' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Hola, soy Aura 👋</p>
                  <p className="text-xs text-ink3 mt-1 px-4">
                    Tu copiloto pedagógico MinEduc. Pregúntame sobre planificación, metodologías, NEE o evaluación.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 px-2 pt-2">
                  {QUICK_PROMPTS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q.prompt)}
                      className="text-left text-xs px-3 py-2 rounded-xl bg-white border border-[rgba(120,100,255,0.2)] hover:border-violet-400 hover:bg-violet-50 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white text-ink border border-[rgba(120,100,255,0.15)] rounded-bl-sm'
                  }`}
                  style={m.role === 'user' ? { backgroundColor: '#7C6DFA' } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[rgba(120,100,255,0.15)] rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-ink3">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-[rgba(120,100,255,0.15)] p-2 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="Pregúntame algo..."
                rows={1}
                className="flex-1 resize-none bg-[#faf9ff] border border-[rgba(120,100,255,0.2)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 max-h-32"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 rounded-xl text-white shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#7C6DFA' }}
                aria-label="Enviar mensaje"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-ink4 mt-1 px-1">
              Enter para enviar · Shift+Enter para nueva línea
            </p>
          </form>
        </div>
      )}

      {/* ── Modal: Generador de evaluaciones ── */}
      {evalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !evalLoading && setEvalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 text-white"
              style={{ background: 'linear-gradient(135deg, #7C6DFA 0%, #26D7B4 100%)' }}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <p className="text-sm font-bold">Generar evaluacion con Aura</p>
              </div>
              <button
                onClick={() => !evalLoading && setEvalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Cerrar"
                disabled={evalLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!evalResult ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-ink">Tema *</span>
                      <input
                        type="text"
                        value={evalForm.tema}
                        onChange={e => setEvalForm(f => ({ ...f, tema: e.target.value }))}
                        placeholder="Ej: Ecuaciones de primer grado"
                        className="mt-1 w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-ink">Asignatura</span>
                      <input
                        type="text"
                        value={evalForm.asignatura}
                        onChange={e => setEvalForm(f => ({ ...f, asignatura: e.target.value }))}
                        placeholder="Matematica"
                        className="mt-1 w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-ink">Grado</span>
                      <input
                        type="text"
                        value={evalForm.grado}
                        onChange={e => setEvalForm(f => ({ ...f, grado: e.target.value }))}
                        placeholder="4to EGB"
                        className="mt-1 w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-ink">N° de preguntas</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={evalForm.numPreguntas}
                        onChange={e => setEvalForm(f => ({ ...f, numPreguntas: Math.max(1, Math.min(30, Number(e.target.value) || 10)) }))}
                        className="mt-1 w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-xs font-semibold text-ink">Nivel</span>
                      <select
                        value={evalForm.nivelDificultad}
                        onChange={e => setEvalForm(f => ({ ...f, nivelDificultad: e.target.value as any }))}
                        className="mt-1 w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                      >
                        <option value="basico">Basico</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                        <option value="mixto">Mixto</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-ink">Tipos de pregunta</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[
                        ['opcion_multiple', 'Opcion multiple'],
                        ['verdadero_falso', 'V / F'],
                        ['respuesta_corta', 'Respuesta corta'],
                        ['ensayo', 'Ensayo'],
                        ['resolucion_problema', 'Resolucion problema'],
                      ].map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => toggleTipo(val)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            evalForm.tipos.includes(val)
                              ? 'bg-violet-500 text-white border-violet-500'
                              : 'bg-white text-ink border-[rgba(120,100,255,0.3)] hover:border-violet-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={evalForm.incluirRubrica}
                      onChange={e => setEvalForm(f => ({ ...f, incluirRubrica: e.target.checked }))}
                    />
                    Incluir rubrica de evaluacion
                  </label>

                  {/* NEE sin discapacidad */}
                  <div className="border-t pt-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={evalForm.incluirNeeSinDisc}
                        onChange={e => setEvalForm(f => ({ ...f, incluirNeeSinDisc: e.target.checked }))}
                      />
                      Tambien generar version NEE sin discapacidad
                    </label>
                    {evalForm.incluirNeeSinDisc && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-6">
                        {NEE_SIN_DISCAPACIDAD.map(n => (
                          <button
                            key={n.code}
                            type="button"
                            onClick={() => toggleNeeSinDisc(n.code)}
                            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                              evalForm.neeSinDiscCodes.includes(n.code)
                                ? 'bg-teal-500 text-white border-teal-500'
                                : 'bg-white text-ink border-[rgba(38,215,180,0.3)] hover:border-teal-400'
                            }`}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DIAC */}
                  <div className="border-t pt-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={evalForm.incluirDiac}
                        onChange={e => setEvalForm(f => ({ ...f, incluirDiac: e.target.checked }))}
                      />
                      Tambien generar DIAC (adaptacion significativa)
                    </label>
                    {evalForm.incluirDiac && (
                      <div className="pl-6 mt-2 space-y-2">
                        <select
                          value={evalForm.neeConDiscCode}
                          onChange={e => setEvalForm(f => ({ ...f, neeConDiscCode: e.target.value }))}
                          className="w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2"
                        >
                          <option value="">Selecciona tipo de discapacidad…</option>
                          {NEE_CON_DISCAPACIDAD.map(n => (
                            <option key={n.code} value={n.code}>{n.label}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Nombre del estudiante"
                            value={evalForm.diacEstudiante}
                            onChange={e => setEvalForm(f => ({ ...f, diacEstudiante: e.target.value }))}
                            className="text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2"
                          />
                          <input
                            type="text"
                            placeholder="Grado curricular real"
                            value={evalForm.diacGradoReal}
                            onChange={e => setEvalForm(f => ({ ...f, diacGradoReal: e.target.value }))}
                            className="text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-ink">Instrucciones adicionales (opcional)</span>
                    <textarea
                      rows={2}
                      value={evalForm.instruccionesExtra}
                      onChange={e => setEvalForm(f => ({ ...f, instruccionesExtra: e.target.value }))}
                      className="mt-1 w-full text-sm border border-[rgba(120,100,255,0.25)] rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                      placeholder="Ej: Enfocar en aplicacion a la vida cotidiana"
                    />
                  </label>
                </>
              ) : (
                <>
                  {/* Tabs de variantes */}
                  <div className="flex gap-1 border-b">
                    <button
                      onClick={() => setEvalTab(0)}
                      className={`text-xs px-3 py-2 font-semibold border-b-2 transition-colors ${
                        evalTab === 0 ? 'border-violet-500 text-violet-700' : 'border-transparent text-ink3'
                      }`}
                    >
                      Regular
                    </button>
                    {evalResult.variants.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setEvalTab(i + 1)}
                        className={`text-xs px-3 py-2 font-semibold border-b-2 transition-colors ${
                          evalTab === i + 1 ? 'border-teal-500 text-teal-700' : 'border-transparent text-ink3'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap bg-[#faf9ff] p-4 rounded-lg border border-[rgba(120,100,255,0.15)] max-h-[50vh] overflow-auto">
                    {evalTab === 0 ? evalResult.regular : evalResult.variants[evalTab - 1]?.content}
                  </pre>
                </>
              )}
            </div>

            <div className="border-t px-5 py-3 flex items-center justify-between gap-2 bg-white">
              {!evalResult ? (
                <>
                  <p className="text-[10px] text-ink4">La evaluacion se genera con Claude Sonnet.</p>
                  <button
                    onClick={generarEvaluacion}
                    disabled={evalLoading || !evalForm.tema.trim() || evalForm.tipos.length === 0}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7C6DFA 0%, #26D7B4 100%)' }}
                  >
                    {evalLoading ? 'Generando…' : 'Generar evaluacion'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setEvalResult(null); setEvalTab(0) }}
                    className="px-3 py-2 rounded-lg text-sm border border-[rgba(120,100,255,0.3)] hover:bg-violet-50"
                  >
                    ← Nueva evaluacion
                  </button>
                  <button
                    onClick={() => {
                      const txt = evalTab === 0 ? evalResult.regular : evalResult.variants[evalTab - 1]?.content || ''
                      const suf = evalTab === 0 ? 'regular' : evalResult.variants[evalTab - 1]?.kind || 'adaptada'
                      const safeTema = evalForm.tema.slice(0, 40).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
                      descargarMarkdown(txt, `evaluacion-${safeTema}-${suf}.md`)
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
                    style={{ backgroundColor: '#7C6DFA' }}
                  >
                    <Download size={14} /> Descargar .md
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
