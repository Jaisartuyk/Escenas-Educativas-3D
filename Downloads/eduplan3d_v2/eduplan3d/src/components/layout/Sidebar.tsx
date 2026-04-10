// src/components/layout/Sidebar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { Menu, X } from 'lucide-react'

// ─── Nav completo (admin ve todo) ────────────────────────────────────────────
const NAV_ADMIN = [
  { href: '/dashboard',              icon: '⊞',  label: 'Dashboard'    },
  { href: '/dashboard/planificador', icon: '📋', label: 'Planificador' },
  { href: '/dashboard/horarios',     icon: '📅', label: 'Horarios'     },
  { href: '/dashboard/academico',    icon: '🎓', label: 'Académico'    },
  { href: '/dashboard/secretaria',   icon: '💼', label: 'Secretaría'   },
  { href: '/dashboard/docente',      icon: '📝', label: 'Docencia'     },
  { href: '/dashboard/libretas',     icon: '📊', label: 'Libretas'     },
  { href: '/dashboard/institucion',  icon: '🏢', label: 'Institución'  },
  { href: '/dashboard/biblioteca',   icon: '📚', label: 'Biblioteca'   },
  { href: '/dashboard/escenas',      icon: '🔬', label: 'Escenas 3D'   },
  { href: '/dashboard/historial',    icon: '📂', label: 'Historial'    },
  { href: '/dashboard/configuracion',icon: '⚙️', label: 'Configuración'},
]

// ─── Nav docente ─────────────────────────────────────────────────────────────
const NAV_TEACHER = [
  { href: '/dashboard/docente',      icon: '📝', label: 'Panel Docente' },
  { href: '/dashboard/planificador', icon: '📋', label: 'Planificador'  },
  { href: '/dashboard/libretas',     icon: '📊', label: 'Libretas'      },
  { href: '/dashboard/escenas',      icon: '🔬', label: 'Escenas 3D'    },
  { href: '/dashboard/biblioteca',   icon: '📚', label: 'Biblioteca'    },
  { href: '/dashboard/configuracion',icon: '⚙️', label: 'Configuración' },
]

// ─── Nav estudiante ───────────────────────────────────────────────────────────
const NAV_STUDENT = [
  { href: '/dashboard/alumno',       icon: '🎒', label: 'Mis Tareas'   },
  { href: '/dashboard/libretas',     icon: '📊', label: 'Mis Notas'    },
  { href: '/dashboard/escenas',      icon: '🔬', label: 'Escenas 3D'   },
  { href: '/dashboard/biblioteca',   icon: '📚', label: 'Biblioteca'   },
  { href: '/dashboard/configuracion',icon: '⚙️', label: 'Configuración'},
]

// ─── Nav secretaria ──────────────────────────────────────────────────────────
const NAV_SECRETARY = [
  { href: '/dashboard/secretaria',   icon: '💼', label: 'Secretaría'   },
  { href: '/dashboard/configuracion',icon: '⚙️', label: 'Configuración'},
]

// ─── Nav horarios_only ───────────────────────────────────────────────────────
const NAV_HORARIOS = [
  { href: '/dashboard/horarios',     icon: '📅', label: 'Horarios'     },
  { href: '/dashboard/configuracion',icon: '⚙️', label: 'Configuración'},
]

function getNav(role: string) {
  switch (role) {
    case 'teacher':       return NAV_TEACHER
    case 'student':       return NAV_STUDENT
    case 'secretary':     return NAV_SECRETARY
    case 'horarios_only': return NAV_HORARIOS
    default:              return NAV_ADMIN
  }
}

export function Sidebar({ role = 'admin' }: { role?: string }) {
  const pathname = usePathname()
  const NAV      = getNav(role)
  const [open, setOpen] = useState(false)

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  // Capture PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[rgba(120,100,255,0.14)]">
        <Logo size="sm" />
        {/* Close button visible only on mobile */}
        <button onClick={() => setOpen(false)} className="lg:hidden text-ink3 hover:text-ink">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(item.href)
                ? 'bg-[rgba(124,109,250,0.15)] text-violet2 border border-[rgba(124,109,250,0.25)]'
                : 'text-ink3 hover:text-ink hover:bg-[rgba(0,0,0,0.04)]'
            }`}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-[rgba(120,100,255,0.14)] space-y-2">
        {/* PWA Install button */}
        {deferredPrompt && (
          <button onClick={handleInstall}
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-violet/10 to-teal/10 border border-violet/20 hover:border-violet/40 transition-all">
            <span className="text-sm">📲</span>
            <div>
              <p className="text-xs font-bold text-violet2">Instalar App</p>
              <p className="text-[10px] text-ink3">Usar sin navegador</p>
            </div>
          </button>
        )}
        {/* Plan chip */}
        <Link
          href="/dashboard/configuracion?tab=plan"
          className="flex items-center gap-2 p-3 rounded-xl bg-[rgba(124,109,250,0.08)] border border-[rgba(124,109,250,0.18)] hover:border-[rgba(124,109,250,0.35)] transition-colors"
        >
          <span className="text-sm">⚡</span>
          <div>
            <p className="text-xs font-bold text-violet2">Plan Starter</p>
            <p className="text-[10px] text-ink3">Mejorar a Pro →</p>
          </div>
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile hamburger button (visible on < lg) ─────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-surface border border-surface2 rounded-xl p-2 shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu size={20} className="text-ink" />
      </button>

      {/* ── Mobile overlay ────────────────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
      )}

      {/* ── Sidebar: mobile = drawer, desktop = static column ─────── */}
      <aside className={`
        bg-bg2 flex flex-col border-r border-[rgba(120,100,255,0.14)]
        fixed lg:sticky top-0 h-screen z-40
        w-64 lg:w-56 flex-shrink-0
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {sidebarContent}
      </aside>
    </>
  )
}
