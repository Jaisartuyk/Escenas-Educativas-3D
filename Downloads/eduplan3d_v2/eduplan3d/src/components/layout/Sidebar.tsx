// src/components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'

const NAV_FULL = [
  { href: '/dashboard',                 icon: '⊞',  label: 'Dashboard',    roles: ['admin', 'teacher', 'student'] },
  { href: '/dashboard/planificador',    icon: '📋', label: 'Planificador', roles: ['admin', 'teacher'] },
  { href: '/dashboard/horarios',        icon: '📅', label: 'Horarios',     roles: ['admin', 'teacher'] },
  { href: '/dashboard/academico',       icon: '🎓', label: 'Académico',    roles: ['admin'] },
  { href: '/dashboard/secretaria',      icon: '💼', label: 'Secretaría',   roles: ['admin', 'secretary'] },
  { href: '/dashboard/docente',         icon: '📝', label: 'Docencia',     roles: ['admin', 'teacher'] },
  { href: '/dashboard/alumno',          icon: '🎒', label: 'Mis Tareas',   roles: ['student'] },
  { href: '/dashboard/libretas',        icon: '📊', label: 'Libretas',     roles: ['admin', 'teacher', 'student'] },
  { href: '/dashboard/institucion',     icon: '🏢', label: 'Institución',  roles: ['admin'] },
  { href: '/dashboard/biblioteca',      icon: '📚', label: 'Biblioteca',   roles: ['admin', 'teacher', 'student'] },
  { href: '/dashboard/escenas',         icon: '🔬', label: 'Escenas 3D',   roles: ['admin', 'teacher', 'student'] },
  { href: '/dashboard/historial',       icon: '📂', label: 'Historial',    roles: ['admin', 'teacher'] },
  { href: '/dashboard/configuracion',   icon: '⚙️', label: 'Configuración', roles: ['admin', 'teacher', 'student'] },
]

export function Sidebar({ role = 'admin' }: { role?: string }) {
  const pathname = usePathname()
  
  // horarios_only special case
  let NAV = NAV_FULL.filter(i => i.roles.includes(role))
  if (role === 'horarios_only') {
    NAV = [
      { href: '/dashboard/horarios',        icon: '📅', label: 'Horarios', roles: []},
      { href: '/dashboard/configuracion',   icon: '⚙️', label: 'Configuración', roles: []},
    ]
  }

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
