// src/components/layout/Topbar.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import type { Profile } from '@/types/supabase'

interface Props { profile: Profile | null }

export function Topbar({ profile }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = profile?.full_name
    ?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-8 border-b border-[rgba(120,100,255,0.14)] bg-bg2 sticky top-0 z-30 ml-0 lg:ml-0">
      {/* Search (decorativo por ahora) */}
      <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-[rgba(0,0,0,0.04)] border border-[rgba(120,100,255,0.12)] w-64">
        <span className="text-ink3 text-sm">🔍</span>
        <span className="text-ink3 text-sm">Buscar planificación...</span>
        <kbd className="ml-auto text-[10px] text-ink3 border border-[rgba(120,100,255,0.2)] rounded px-1.5 py-0.5">⌘K</kbd>
      </div>
      {/* Mobile: spacer for hamburger */}
      <div className="md:hidden w-10" />

      <div className="flex items-center gap-3">
        {/* Plan badge */}
        <span className={`hidden sm:inline text-[11px] font-bold px-3 py-1 rounded-full ${
          profile?.plan === 'pro'
            ? 'bg-[rgba(124,109,250,0.15)] text-violet2 border border-[rgba(124,109,250,0.3)]'
            : profile?.plan === 'institucion'
            ? 'bg-[rgba(38,215,180,0.12)] text-teal border border-[rgba(38,215,180,0.25)]'
            : 'bg-[rgba(255,179,71,0.12)] text-amber border border-[rgba(255,179,71,0.25)]'
        }`}>
          {profile?.plan === 'pro' ? '⭐ Pro' : profile?.plan === 'institucion' ? '🏫 Institución' : 'Starter'}
        </span>

        {/* Avatar + menu */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(v => !v)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-violet to-violet2 flex items-center justify-center text-sm font-bold text-white"
          >
            {initials}
          </button>

          {open && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-surface2 border border-[rgba(120,100,255,0.2)] rounded-2xl p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] animate-fade-in z-50">
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-[rgba(120,100,255,0.14)] mb-2">
                <p className="text-sm font-semibold">{profile?.full_name ?? 'Docente'}</p>
                <p className="text-xs text-ink3 truncate">{profile?.email}</p>
              </div>
              {[
                { icon: '⚙️', label: 'Configuración',  href: '/dashboard/configuracion' },
                { icon: '🔬', label: 'Escenas 3D',      href: '/dashboard/escenas' },
                { icon: '📂', label: 'Historial',       href: '/dashboard/historial' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink2 hover:bg-surface hover:text-ink transition-all w-full"
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-[rgba(120,100,255,0.14)] mt-2 pt-2">
                <form action={signOut}>
                  <button className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-rose hover:bg-[rgba(240,98,146,0.1)] transition-all w-full">
                    <span>↩</span> Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
