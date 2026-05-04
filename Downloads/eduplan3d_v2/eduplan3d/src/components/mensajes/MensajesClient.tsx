// src/components/mensajes/MensajesClient.tsx
// Interfaz de chat profesional para EduPlan3D.
// Layout split: izquierda = lista de conversaciones, derecha = panel de mensajes.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MessageSquare, Send, Search, Plus, Megaphone, X, CheckCheck, Check,
  Clock, AlertTriangle, CalendarDays, BookOpen, BadgeCheck, ArrowLeft,
  Users, GraduationCap, Sparkles, Trash2,
} from 'lucide-react'

// ── Tipos ───────────────────────────────────────────────────────────────────
interface Me { id: string; fullName: string; role: string }
interface Contact { userId: string; fullName: string; role: string; subtitle?: string; studentId?: string }

interface Participant { user_id: string; role: string; full_name: string; user_role: string }
interface Conversation {
  id: string
  type: 'direct' | 'bulletin'
  title: string | null
  course_id: string | null
  student_id: string | null
  created_by: string
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
  participants: Participant[]
  unread: number
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  kind: 'text' | 'bulletin' | 'system'
  metadata: any
  created_at: string
  sender: { id: string; full_name: string; role: string } | null
}

interface Props {
  me: Me
  institutionName: string
  broadcastCourses: Array<{ id: string; name: string; parallel: string | null }>
  selectedChildId?: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Ayer ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 7) return d.toLocaleDateString('es-EC', { weekday: 'short' }) + ' ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return 'Hoy'
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function initials(name: string): string {
  return (name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]!.toUpperCase()).join('')
}

function avatarColor(id: string): string {
  const palette = ['#6366F1','#8B5CF6','#EC4899','#F43F5E','#F59E0B','#10B981','#06B6D4','#3B82F6','#14B8A6']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

function conversationLabel(c: Conversation, meId: string): { title: string; subtitle: string; avatarId: string } {
  if (c.type === 'bulletin') {
    return { title: c.title || 'Boletín', subtitle: c.last_message_preview || '', avatarId: c.id }
  }
  const other = (c.participants || []).find(p => p.user_id !== meId)
  if (!other) return { title: 'Conversación', subtitle: c.last_message_preview || '', avatarId: c.id }
  let title = other.full_name || 'Contacto'
  let subtitle = c.last_message_preview || ''
  if (other.user_role === 'student') title = `Representante de ${other.full_name}`
  return { title, subtitle, avatarId: other.user_id }
}

const CAT_LABELS: Record<string, { label: string; color: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
  academico:      { label: 'Académico',      color: '#3B82F6', bg: 'bg-blue-50',    text: 'text-blue-700',    icon: BookOpen      },
  administrativo: { label: 'Administrativo', color: '#6366F1', bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: BadgeCheck    },
  evento:         { label: 'Evento',         color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CalendarDays  },
  urgente:        { label: 'Urgente',        color: '#EF4444', bg: 'bg-rose-50',    text: 'text-rose-700',    icon: AlertTriangle },
}

// ── Componente ──────────────────────────────────────────────────────────────
export function MensajesClient({ me, institutionName, broadcastCourses, selectedChildId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [receipts, setReceipts] = useState<Record<string, string[]>>({})
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [msgsError, setMsgsError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [bulletinOpen, setBulletinOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'list' | 'thread'>('list')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Solo administración (admin/assistant/rector) puede publicar boletines.
  const canBroadcast = me.role === 'admin' || me.role === 'assistant' || me.role === 'rector'

  // Cuando el padre cambia de hijo, resetear contactos para recargarlos con el hijo nuevo
  const prevChildId = useRef(selectedChildId)
  useEffect(() => {
    if (me.role === 'parent' && prevChildId.current !== selectedChildId) {
      setContacts([])
      prevChildId.current = selectedChildId
    }
  }, [me.role, selectedChildId])

  // ── Carga ──
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/mensajes/conversations')
      if (!res.ok) return // No limpiar la lista si falla la petición
      const json = await res.json()
      if (json.conversations) {
        setConversations(prev => {
          // Mantener conversaciones que acabamos de crear y que quizás aún no llegan en el GET
          const newlyCreated = prev.filter(p => p.last_message_at === null && !json.conversations.find((c: any) => c.id === p.id))
          return [...newlyCreated, ...json.conversations]
        })
      }
    } catch (e) {
      console.error('Error loading conversations:', e)
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Polling cada 20s
  useEffect(() => {
    const t = setInterval(() => { loadConversations() }, 20000)
    return () => clearInterval(t)
  }, [loadConversations])

  async function loadMessages(conversationId: string, silent = false) {
    if (!silent && messages.length === 0) setLoadingMsgs(true)
    setMsgsError(null)
    try {
      const res = await fetch(`/api/mensajes/conversations/${conversationId}/messages`)
      const json = await res.json()
      if (!res.ok) {
        setMsgsError(json?.error || `Error ${res.status}`)
        if (!silent) setMessages([])
      } else {
        setMessages(json.messages || [])
        setReceipts(json.receipts || {})
      }
    } catch (e: any) {
      if (!silent) {
        setMsgsError(e?.message || 'Error de red')
        setMessages([])
      }
    } finally {
      setLoadingMsgs(false)
    }
    // Marcar leído
    fetch(`/api/mensajes/conversations/${conversationId}/read`, { method: 'POST' })
      .then(() => loadConversations())
      .catch(() => {})
  }

  function selectConversation(id: string) {
    setSelectedId(id)
    setMobilePane('thread')
    loadMessages(id)
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Polling de mensajes en el hilo abierto cada 8s
  useEffect(() => {
    if (!selectedId) return
    const t = setInterval(async () => {
      const res = await fetch(`/api/mensajes/conversations/${selectedId}/messages`)
      const json = await res.json()
      setMessages(json.messages || [])
      setReceipts(json.receipts || {})
    }, 8000)
    return () => clearInterval(t)
  }, [selectedId])

  async function send() {
    if (!selectedId || !input.trim() || sending) return
    setSending(true)
    const body = input.trim()
    setInput('')
    try {
      const res = await fetch(`/api/mensajes/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        await loadMessages(selectedId, true)
        loadConversations()
      } else {
        setInput(body) // devolver al textarea si falla
      }
    } finally {
      setSending(false)
    }
  }

  async function openNewChat() {
    setNewOpen(true)
    setChatError(null)
    if (contacts.length === 0) {
      setLoadingContacts(true)
      const suffix = me.role === 'parent' && selectedChildId ? `?child_id=${selectedChildId}` : ''
      const res = await fetch(`/api/mensajes/contacts${suffix}`)
      const json = await res.json()
      setContacts(json.contacts || [])
      setLoadingContacts(false)
    }
  }

  async function startChatWith(contact: Contact) {
    setStartingChat(true)
    setChatError(null)
    try {
      const res = await fetch('/api/mensajes/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: contact.userId, studentId: contact.studentId }),
      })
      
      const text = await res.text()
      let json: any = {}
      try { json = JSON.parse(text) } catch (e) { 
        throw new Error(`Error del servidor (${res.status}): El servidor no devolvió un JSON válido.`)
      }

      if (res.ok && json.conversation) {
        setNewOpen(false)
        // Añadir a la lista localmente para que aparezca de inmediato sin esperar al polling
        setConversations(prev => {
          const exists = prev.find(c => c.id === json.conversation.id)
          if (exists) return prev
          return [json.conversation, ...prev]
        })
        selectConversation(json.conversation.id)
      } else {
        setChatError(json.error || `Error ${res.status}: No se pudo crear la conversación`)
      }
    } catch (e: any) {
      console.error('Error starting chat:', e)
      setChatError(e?.message || 'Error de red al crear la conversación')
    } finally {
      setStartingChat(false)
    }
  }

  async function ackBulletin(messageId: string) {
    const res = await fetch(`/api/mensajes/messages/${messageId}/ack`, { method: 'POST' })
    if (res.ok && selectedId) loadMessages(selectedId)
  }

  async function publishBulletin(payload: {
    title: string; body: string; category: string; requiresAck: boolean;
    scope: 'institution' | { courseIds: string[] }
  }) {
    const res = await fetch('/api/mensajes/bulletins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (res.ok && json.conversation) {
      setBulletinOpen(false)
      await loadConversations()
      selectConversation(json.conversation.id)
      return { ok: true, recipients: json.recipients }
    }
    return { ok: false, error: json.error }
  }

  async function deleteConversation(convId: string, isBulletin: boolean) {
    const msg = isBulletin
      ? '¿Eliminar este boletín? Se borrará para TODOS los destinatarios y no podrá recuperarse.'
      : '¿Eliminar esta conversación? Se borrarán todos los mensajes para ambos participantes.'
    if (!confirm(msg)) return
    const res = await fetch(`/api/mensajes/conversations/${convId}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert('Error al eliminar: ' + (json?.error || 'desconocido'))
      return
    }
    // Si era el seleccionado, limpiar selección.
    if (selectedId === convId) {
      setSelectedId(null)
      setMessages([])
    }
    await loadConversations()
  }

  // ── Listado filtrado ──
  const filteredConvs = useMemo(() => {
    if (!search.trim()) return conversations
    const s = search.toLowerCase()
    return conversations.filter(c => {
      const { title, subtitle } = conversationLabel(c, me.id)
      return title.toLowerCase().includes(s) || subtitle.toLowerCase().includes(s)
    })
  }, [conversations, search, me.id])

  const selected = conversations.find(c => c.id === selectedId) || null

  // ── Render ──
  return (
    <div className="h-[calc(100vh-8rem)] min-h-[560px] bg-bg2 rounded-3xl border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden flex">
      {/* ══ Sidebar de conversaciones ══════════════════════════════════════════ */}
      <aside className={`${mobilePane === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[340px] border-r border-[rgba(0,0,0,0.06)] bg-bg2`}>
        {/* Header */}
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
                <MessageSquare size={20} className="text-violet2" />
                Mensajes
              </h1>
              {institutionName && <p className="text-[11px] text-ink4">{institutionName}</p>}
            </div>
            <div className="flex items-center gap-1.5">
              {canBroadcast && (
                <button
                  onClick={() => setBulletinOpen(true)}
                  className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center justify-center"
                  title="Publicar boletín">
                  <Megaphone size={16} />
                </button>
              )}
              <button
                onClick={openNewChat}
                className="h-9 w-9 rounded-xl bg-violet text-white hover:bg-violet2 transition-colors flex items-center justify-center shadow-sm"
                title="Nueva conversación">
                <Plus size={16} />
              </button>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversación…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg3 text-sm focus:bg-bg2 focus:ring-2 focus:ring-violet2/30 outline-none transition-all" />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingConvs ? (
            <div className="p-6 text-center text-ink4 text-sm">Cargando…</div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center">
              <Sparkles size={28} className="mx-auto text-ink4 opacity-50" />
              <p className="mt-2 text-sm text-ink3 font-medium">Sin conversaciones</p>
              <p className="text-[11px] text-ink4 mt-1">
                Empieza una nueva con el botón <span className="inline-flex items-center gap-0.5 font-semibold"><Plus size={10} /></span>
              </p>
            </div>
          ) : filteredConvs.map(c => {
            const { title, subtitle, avatarId } = conversationLabel(c, me.id)
            const isActive = c.id === selectedId
            const isBulletin = c.type === 'bulletin'
            return (
              <button key={c.id} onClick={() => selectConversation(c.id)}
                className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-[rgba(0,0,0,0.04)] hover:bg-bg3 transition-colors ${
                  isActive ? 'bg-[rgba(124,109,250,0.08)]' : ''
                }`}>
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                  isBulletin ? 'bg-gradient-to-br from-amber-400 to-orange-500' : ''
                }`}
                  style={{ backgroundColor: isBulletin ? undefined : avatarColor(avatarId) }}>
                  {isBulletin ? <Megaphone size={18} /> : initials(title.replace(/^Representante de /, ''))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate flex-1 ${c.unread > 0 ? 'font-bold text-ink' : 'font-semibold text-ink2'}`}>
                      {isBulletin && <Megaphone size={11} className="inline text-amber-500 mr-1 -mt-0.5" />}
                      {title}
                    </p>
                    {c.last_message_at && (
                      <span className={`text-[10px] shrink-0 ${c.unread > 0 ? 'text-violet2 font-bold' : 'text-ink4'}`}>
                        {fmtTime(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-xs truncate flex-1 ${c.unread > 0 ? 'text-ink2' : 'text-ink4'}`}>
                      {subtitle || 'Sin mensajes aún'}
                    </p>
                    {c.unread > 0 && (
                      <span className="bg-violet text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ══ Panel de mensajes ════════════════════════════════════════════════ */}
      <main className={`${mobilePane === 'thread' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 bg-bg3/30`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet to-teal flex items-center justify-center text-white shadow-lg">
                <MessageSquare size={36} />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">Tu bandeja de comunicaciones</h3>
              <p className="text-ink3 text-sm mt-2">
                Selecciona una conversación para empezar a leer o abre una nueva con el botón <span className="font-semibold">+</span>.
              </p>
              {canBroadcast && (
                <p className="text-ink4 text-xs mt-3">
                  Para enviar un comunicado a todo un curso, usa el botón <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><Megaphone size={11} /> boletín</span>.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Header del hilo */}
            <ThreadHeader
              me={me}
              conversation={selected}
              onBack={() => { setSelectedId(null); setMobilePane('list') }}
              onDelete={deleteConversation}
            />

            {/* Lista de mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-6 py-4 space-y-1">
              {loadingMsgs ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 rounded-full border-2 border-violet2 border-t-transparent animate-spin" />
                </div>
              ) : msgsError ? (
                <div className="mx-auto max-w-md text-center py-10 px-4 rounded-2xl bg-rose-50 border border-rose-200">
                  <p className="text-rose-700 text-sm font-semibold mb-1">No se pudieron cargar los mensajes</p>
                  <p className="text-rose-600 text-xs break-words">{msgsError}</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-ink4 text-sm py-10">
                  Aún no hay mensajes. Sé el primero en escribir 👇
                </div>
              ) : (
                <MessageList
                  messages={messages}
                  meId={me.id}
                  conversation={selected}
                  receipts={receipts}
                  onAck={ackBulletin}
                />
              )}
            </div>

            {/* Composer */}
            {selected.type !== 'bulletin' || selected.created_by === me.id ? (
              <div className="p-3 md:p-4 border-t border-[rgba(0,0,0,0.06)] bg-bg2">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                    }}
                    rows={1}
                    placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para salto de línea)"
                    className="flex-1 resize-none max-h-40 rounded-2xl px-4 py-2.5 bg-bg3 text-sm focus:bg-bg2 focus:ring-2 focus:ring-violet2/30 outline-none transition-all"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || sending}
                    className="h-10 w-10 shrink-0 rounded-full bg-violet text-white hover:bg-violet2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-sm transition-all"
                    title="Enviar">
                    <Send size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-[rgba(0,0,0,0.06)] bg-amber-50 text-center">
                <p className="text-xs text-amber-700 font-medium">
                  Los boletines son de solo lectura. Para responder, envía un mensaje directo al tutor.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ══ Modal: Nueva conversación ═══════════════════════════════════════ */}
      {newOpen && (
        <ContactsModal
          contacts={contacts}
          loading={loadingContacts}
          starting={startingChat}
          error={chatError}
          onClose={() => { setNewOpen(false); setChatError(null) }}
          onPick={startChatWith}
        />
      )}

      {/* ══ Modal: Publicar boletín ═════════════════════════════════════════ */}
      {bulletinOpen && canBroadcast && (
        <BulletinModal
          me={me}
          broadcastCourses={broadcastCourses}
          onClose={() => setBulletinOpen(false)}
          onPublish={publishBulletin}
        />
      )}
    </div>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function ThreadHeader({
  me, conversation, onBack, onDelete,
}: {
  me: Me; conversation: Conversation; onBack: () => void
  onDelete?: (convId: string, isBulletin: boolean) => void
}) {
  const { title, avatarId } = conversationLabel(conversation, me.id)
  const isBulletin = conversation.type === 'bulletin'
  const other = (conversation.participants || []).find(p => p.user_id !== me.id)
  const subtitle = isBulletin
    ? `Boletín · ${(conversation.participants || []).length - 1} destinatario${(conversation.participants || []).length - 1 !== 1 ? 's' : ''}`
    : (other?.user_role === 'teacher' || other?.role === 'teacher') ? 'Docente tutor'
    : (other?.user_role === 'student' || other?.role === 'student') ? 'Representante / Estudiante'
    : 'Administración'

  // Permiso para eliminar:
  //  · Boletín → solo admin/assistant/rector
  //  · DM     → creador o admin/assistant/rector
  const isAdminRole = me.role === 'admin' || me.role === 'assistant' || me.role === 'rector'
  const canDelete = isBulletin
    ? isAdminRole
    : (conversation.created_by === me.id || isAdminRole)

  return (
    <div className="px-4 md:px-6 py-3 border-b border-[rgba(0,0,0,0.06)] bg-bg2 flex items-center gap-3">
      <button onClick={onBack} className="md:hidden p-1.5 -ml-1 hover:bg-bg3 rounded-lg">
        <ArrowLeft size={18} />
      </button>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
        isBulletin ? 'bg-gradient-to-br from-amber-400 to-orange-500' : ''
      }`}
        style={{ backgroundColor: isBulletin ? undefined : avatarColor(avatarId) }}>
        {isBulletin ? <Megaphone size={16} /> : initials(title.replace(/^Representante de /, ''))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{title}</p>
        <p className="text-[11px] text-ink4 truncate">{subtitle}</p>
      </div>
      {isBulletin && (
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-ink4">
          <Users size={12} /> {(conversation.participants || []).length - 1}
        </div>
      )}
      {canDelete && onDelete && (
        <button
          onClick={() => onDelete(conversation.id, isBulletin)}
          className="p-2 hover:bg-rose-50 rounded-lg text-ink4 hover:text-rose-600 transition-colors"
          title={isBulletin ? 'Eliminar boletín (para todos)' : 'Eliminar conversación'}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

function MessageList({
  messages, meId, conversation, receipts, onAck,
}: {
  messages: Message[]; meId: string; conversation: Conversation
  receipts: Record<string, string[]>; onAck: (id: string) => void
}) {
  // Agrupar por día
  const grouped: Array<{ day: string; items: Message[] }> = []
  for (const m of messages) {
    const key = new Date(m.created_at).toDateString()
    let last = grouped[grouped.length - 1]
    if (!last || last.day !== key) {
      last = { day: key, items: [] }
      grouped.push(last)
    }
    last.items.push(m)
  }

  const nonMeCount = (conversation.participants || []).filter(p => p.user_id !== conversation.created_by).length

  return (
    <>
      {grouped.map(g => (
        <div key={g.day}>
          <div className="flex items-center justify-center my-3">
            <span className="bg-bg2 border border-[rgba(0,0,0,0.06)] text-ink4 text-[10px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
              {dayLabel(g.items[0].created_at)}
            </span>
          </div>
          {g.items.map((m, idx) => {
            const prev = idx > 0 ? g.items[idx - 1] : null
            const showSender = conversation.type === 'bulletin' ? false : (!prev || prev.sender_id !== m.sender_id)
            return (
              <MessageBubble key={m.id}
                m={m} meId={meId}
                showSender={showSender}
                isBulletinType={m.kind === 'bulletin'}
                ackCount={(receipts[m.id] || []).length}
                totalRecipients={nonMeCount}
                hasAcked={(receipts[m.id] || []).includes(meId)}
                isBulletinOwner={m.sender_id === meId}
                onAck={() => onAck(m.id)}
              />
            )
          })}
        </div>
      ))}
    </>
  )
}

function MessageBubble({
  m, meId, showSender, isBulletinType, ackCount, totalRecipients, hasAcked, isBulletinOwner, onAck,
}: {
  m: Message; meId: string; showSender: boolean
  isBulletinType: boolean; ackCount: number; totalRecipients: number
  hasAcked: boolean; isBulletinOwner: boolean
  onAck: () => void
}) {
  const isMine = m.sender_id === meId

  // Boletín → banner a ancho completo
  if (isBulletinType) {
    const cat = CAT_LABELS[m.metadata?.category] || CAT_LABELS.administrativo
    const requiresAck: boolean = !!m.metadata?.requiresAck
    const Icon = cat.icon
    return (
      <div className="my-3">
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cat.bg}`}
             style={{ borderColor: cat.color + '33' }}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: cat.color + '15' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                 style={{ backgroundColor: cat.color }}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${cat.text}`}>{cat.label}</span>
                <span className="text-[10px] text-ink4">·</span>
                <span className="text-[11px] text-ink3 font-semibold">{m.sender?.full_name || 'Emisor'}</span>
              </div>
              <p className="text-[10px] text-ink4 mt-0.5">{fmtTime(m.created_at)}</p>
            </div>
            {requiresAck && !isBulletinOwner && (
              hasAcked ? (
                <span className="text-[11px] text-emerald-600 font-bold inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCheck size={12} /> Recibido
                </span>
              ) : (
                <button onClick={onAck}
                  className="text-[11px] font-bold inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border shadow-sm hover:bg-bg3 transition-colors"
                  style={{ color: cat.color, borderColor: cat.color + '66' }}>
                  <Check size={12} /> Marcar como recibido
                </button>
              )
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{m.body}</p>
            {isBulletinOwner && requiresAck && (
              <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)] flex items-center gap-2 text-[11px] text-ink3">
                <CheckCheck size={12} className="text-emerald-600" />
                <span className="font-semibold">{ackCount}</span> de {totalRecipients} confirmaron la lectura
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Sistema
  if (m.kind === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-ink4 italic">{m.body}</span>
      </div>
    )
  }

  // Texto (burbuja)
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-0.5`}>
      <div className="max-w-[82%] md:max-w-[65%]">
        {showSender && !isMine && (
          <p className="text-[11px] text-ink4 font-semibold ml-3 mb-0.5">{m.sender?.full_name}</p>
        )}
        <div className={`px-3.5 py-2 rounded-2xl shadow-sm ${
          isMine
            ? 'bg-violet text-white rounded-br-md'
            : 'bg-bg2 text-ink border border-[rgba(0,0,0,0.04)] rounded-bl-md'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
          <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${isMine ? 'text-white/70 justify-end' : 'text-ink4'}`}>
            {fmtTime(m.created_at)}
            {isMine && <CheckCheck size={10} className="opacity-90" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactsModal({ contacts, loading, starting, error, onClose, onPick }: {
  contacts: Contact[]
  loading?: boolean
  starting?: boolean
  error?: string | null
  onClose: () => void
  onPick: (c: Contact) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const s = search.toLowerCase()
    return contacts.filter(c => c.fullName.toLowerCase().includes(s) || (c.subtitle || '').toLowerCase().includes(s))
  }, [contacts, search])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg2 rounded-2xl shadow-xl max-w-md w-full max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Nueva conversación</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-bg3 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-3 border-b border-[rgba(0,0,0,0.06)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4" />
            <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
              placeholder="Buscar contacto…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg3 text-sm focus:bg-bg2 focus:ring-2 focus:ring-violet2/30 outline-none transition-all" />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
            <AlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-700 font-medium leading-snug">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-violet2 border-t-transparent animate-spin" />
              <p className="text-xs text-ink4">Cargando contactos…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-ink4 text-sm">No hay contactos disponibles.</div>
          ) : filtered.map(c => (
            <button key={c.userId + (c.studentId || '')} onClick={() => !starting && onPick(c)}
              disabled={starting}
              className="w-full text-left px-4 py-3 flex items-center gap-3 border-b border-[rgba(0,0,0,0.04)] hover:bg-bg3 transition-colors disabled:opacity-50 disabled:cursor-wait">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                   style={{ backgroundColor: avatarColor(c.userId) }}>
                {starting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : initials(c.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{c.fullName}</p>
                <p className="text-[11px] text-ink4 truncate flex items-center gap-1">
                  {c.role === 'teacher' ? <GraduationCap size={10} /> : c.role === 'parent' ? <Users size={10} /> : <BookOpen size={10} />}
                  {c.subtitle || (c.role === 'teacher' ? 'Docente' : c.role === 'parent' ? 'Representante' : 'Estudiante')}
                </p>
              </div>
              {starting && <div className="w-4 h-4 border-2 border-violet2/30 border-t-violet2 rounded-full animate-spin shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BulletinModal({
  me, broadcastCourses, onClose, onPublish,
}: {
  me: Me
  broadcastCourses: Array<{ id: string; name: string; parallel: string | null }>
  onClose: () => void
  onPublish: (p: { title: string; body: string; category: string; requiresAck: boolean; scope: 'institution' | { courseIds: string[] } }) =>
    Promise<{ ok: boolean; recipients?: number; error?: string }>
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<'academico'|'administrativo'|'evento'|'urgente'>('administrativo')
  const [requiresAck, setRequiresAck] = useState(true)
  const [scopeKind, setScopeKind] = useState<'institution'|'courses'>(me.role === 'admin' || me.role === 'assistant' ? 'institution' : 'courses')
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = me.role === 'admin' || me.role === 'assistant'

  async function handlePublish() {
    setError(null)
    if (!title.trim() || !body.trim()) { setError('Título y mensaje son requeridos'); return }
    const scope: 'institution' | { courseIds: string[] } =
      scopeKind === 'institution' ? 'institution' : { courseIds: Array.from(selectedCourses) }
    if (scopeKind === 'courses' && selectedCourses.size === 0) { setError('Selecciona al menos un curso'); return }
    setBusy(true)
    const res = await onPublish({ title: title.trim(), body: body.trim(), category, requiresAck, scope })
    setBusy(false)
    if (!res.ok) setError(res.error || 'No se pudo publicar')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg2 rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm">
              <Megaphone size={18} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Publicar boletín</h3>
              <p className="text-[11px] text-ink3">Comunicado oficial con acuse de lectura</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/60 rounded-lg"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="text-[11px] uppercase tracking-wide font-bold text-ink4 block mb-1.5">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={140}
              placeholder="Ej. Reunión de representantes — viernes 28"
              className="w-full px-3 py-2 rounded-xl bg-bg3 text-sm focus:bg-bg2 focus:ring-2 focus:ring-amber-400/40 outline-none" />
          </div>
          {/* Categoría */}
          <div>
            <label className="text-[11px] uppercase tracking-wide font-bold text-ink4 block mb-1.5">Categoría</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(CAT_LABELS) as Array<keyof typeof CAT_LABELS>).map(k => {
                const c = CAT_LABELS[k]
                const Icon = c.icon
                const active = category === k
                return (
                  <button key={k} onClick={() => setCategory(k as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      active ? `${c.bg} ${c.text}` : 'bg-bg3 text-ink3 border-transparent hover:bg-bg2'
                    }`}
                    style={active ? { borderColor: c.color + '66' } : undefined}>
                    <Icon size={12} />
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Destinatarios */}
          <div>
            <label className="text-[11px] uppercase tracking-wide font-bold text-ink4 block mb-1.5">Destinatarios</label>
            <div className="flex gap-2 mb-2">
              {isAdmin && (
                <button onClick={() => setScopeKind('institution')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    scopeKind === 'institution' ? 'bg-violet text-white' : 'bg-bg3 text-ink3 hover:bg-bg2'
                  }`}>
                  Toda la institución
                </button>
              )}
              <button onClick={() => setScopeKind('courses')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scopeKind === 'courses' ? 'bg-violet text-white' : 'bg-bg3 text-ink3 hover:bg-bg2'
                }`}>
                Cursos específicos
              </button>
            </div>
            {scopeKind === 'courses' && (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-2 border border-[rgba(0,0,0,0.06)] rounded-xl bg-bg3">
                {broadcastCourses.length === 0 ? (
                  <p className="col-span-full text-center text-ink4 text-xs py-4">Sin cursos disponibles.</p>
                ) : broadcastCourses.map(c => {
                  const checked = selectedCourses.has(c.id)
                  return (
                    <label key={c.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      checked ? 'bg-violet text-white' : 'bg-bg2 hover:bg-bg3 text-ink2'
                    }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => {
                          setSelectedCourses(prev => {
                            const n = new Set(prev)
                            if (n.has(c.id)) n.delete(c.id); else n.add(c.id)
                            return n
                          })
                        }}
                        className="sr-only" />
                      <span className="font-semibold">{c.name}{c.parallel ? ' ' + c.parallel : ''}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          {/* Mensaje */}
          <div>
            <label className="text-[11px] uppercase tracking-wide font-bold text-ink4 block mb-1.5">Mensaje</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} maxLength={3000}
              placeholder="Escribe el comunicado con el detalle necesario…"
              className="w-full px-3 py-2 rounded-xl bg-bg3 text-sm focus:bg-bg2 focus:ring-2 focus:ring-amber-400/40 outline-none resize-none" />
            <p className="text-[10px] text-ink4 mt-1 text-right">{body.length}/3000</p>
          </div>
          {/* Acuse */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
            <input type="checkbox" checked={requiresAck}
              onChange={e => setRequiresAck(e.target.checked)} className="mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-800">Requerir acuse de lectura</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Cada destinatario verá un botón &quot;Marcar como recibido&quot;. Queda registrado con fecha y hora.
              </p>
            </div>
          </label>
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-3 py-2">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-[rgba(0,0,0,0.06)] flex items-center justify-end gap-2 bg-bg2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-ink2 hover:bg-bg3 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={handlePublish} disabled={busy}
            className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-sm hover:shadow-md disabled:opacity-60 transition-all inline-flex items-center gap-2">
            {busy ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Megaphone size={14} />}
            Publicar boletín
          </button>
        </div>
      </div>
    </div>
  )
}
