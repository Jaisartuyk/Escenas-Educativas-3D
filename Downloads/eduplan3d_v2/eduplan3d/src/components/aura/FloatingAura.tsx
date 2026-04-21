// src/components/aura/FloatingAura.tsx
// "Aura" — copiloto pedagógico flotante. Montado en el dashboard layout.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Send, Trash2, Bot } from 'lucide-react'

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
    </>
  )
}
