// src/components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

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

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[rgba(120,100,255,0.14)] bg-bg2 flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[rgba(120,100,255,0.14)]">
        <Logo size="sm" />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
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

      {/* Bottom: plan chip */}
      <div className="p-4 border-t border-[rgba(120,100,255,0.14)]">
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
    </aside>
  )
}
