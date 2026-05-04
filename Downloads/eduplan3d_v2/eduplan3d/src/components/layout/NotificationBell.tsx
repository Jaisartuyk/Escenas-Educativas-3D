'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

type NotificationItem = {
  id: string
  category: string
  title: string
  body: string | null
  href: string | null
  metadata: any
  read_at: string | null
  created_at: string
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
}

function categoryLabel(category: string) {
  if (category === 'message') return 'Mensaje'
  if (category === 'finance') return 'Finanzas'
  if (category === 'assignment') return 'Tareas'
  if (category === 'grade') return 'Calificaciones'
  if (category === 'attendance') return 'Asistencia'
  if (category === 'planning') return 'Planificaciones'
  return 'Sistema'
}

export function NotificationBell({ userId }: { userId?: string | null }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadTotal, setUnreadTotal] = useState(0)
  const notifiedIdsRef = useRef<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  async function loadNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setItems(json.notifications || [])
      setUnreadTotal(Number(json.unreadTotal || 0))
    } catch {}
  }

  useEffect(() => {
    if (!userId) return
    loadNotifications()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const supabase = createSupabaseClient()
    const channel = supabase
      .channel(`app-notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const incoming = payload.new as NotificationItem
          if (!incoming?.id || notifiedIdsRef.current.has(incoming.id)) return
          notifiedIdsRef.current.add(incoming.id)
          setItems((prev) => [incoming, ...prev.filter((item) => item.id !== incoming.id)].slice(0, 20))
          setUnreadTotal((prev) => prev + 1)
          toast.success(incoming.title, {
            duration: 4500,
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${userId}` },
        () => {
          loadNotifications()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const baseTitle = 'ClassNova'
    if (typeof document !== 'undefined') {
      document.title = unreadTotal > 0 ? `(${unreadTotal}) ${baseTitle}` : baseTitle
    }
    return () => {
      if (typeof document !== 'undefined') document.title = baseTitle
    }
  }, [unreadTotal])

  const unreadItems = useMemo(() => items.filter((item) => !item.read_at).length, [items])

  async function markOneRead(id: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item)))
    setUnreadTotal((prev) => Math.max(0, prev - 1))
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
    setUnreadTotal(0)
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => {
          setOpen((value) => !value)
          if (!open) loadNotifications()
        }}
        className="relative h-9 w-9 rounded-xl border border-[rgba(120,100,255,0.18)] bg-[rgba(0,0,0,0.03)] hover:bg-[rgba(0,0,0,0.05)] transition-colors flex items-center justify-center"
        aria-label="Abrir notificaciones"
      >
        <Bell size={17} className="text-ink2" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.2rem] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[rgba(120,100,255,0.16)] bg-bg2 shadow-[0_18px_55px_rgba(0,0,0,0.18)] overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-ink">Notificaciones</p>
              <p className="text-[11px] text-ink4">{unreadTotal > 0 ? `${unreadTotal} pendiente(s)` : 'Todo al día'}</p>
            </div>
            {unreadItems > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet2 hover:text-violet transition-colors"
              >
                <CheckCheck size={13} />
                Marcar todo
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink4">Aún no hay notificaciones.</div>
            ) : items.map((item) => {
              const card = (
                <div
                  className={`px-4 py-3 border-b border-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.03)] transition-colors ${
                    item.read_at ? '' : 'bg-[rgba(124,109,250,0.05)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.read_at ? 'bg-slate-300' : 'bg-violet2'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ink4">{categoryLabel(item.category)}</p>
                        <p className="text-[10px] text-ink4 whitespace-nowrap">{fmtTime(item.created_at)}</p>
                      </div>
                      <p className="text-sm font-semibold text-ink mt-0.5">{item.title}</p>
                      {item.body && <p className="text-xs text-ink3 mt-1 line-clamp-2">{item.body}</p>}
                    </div>
                  </div>
                </div>
              )

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      markOneRead(item.id)
                      setOpen(false)
                    }}
                  >
                    {card}
                  </Link>
                )
              }

              return (
                <button
                  key={item.id}
                  onClick={() => markOneRead(item.id)}
                  className="block w-full text-left"
                >
                  {card}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
