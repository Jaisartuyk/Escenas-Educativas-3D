'use client'
// src/components/superadmin/SuperAdminClient.tsx

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2, Users, Zap, FileText, TrendingUp,
  Search, LogOut, RefreshCw, ChevronRight, Calendar,
  Shield, X
} from 'lucide-react'

interface Stats {
  totalInstitutions: number
  totalUsers:        number
  plannerSoloCount:  number
  totalPlans:        number
  newUsersMonth:     number
}

interface Institution {
  id:          string
  name:        string
  join_code:   string
  created_at:  string
  memberCount: number
}

interface PlannerUser {
  id:         string
  full_name:  string
  email:      string
  plan:       string
  created_at: string
}

interface Props {
  stats:        Stats
  institutions: Institution[]
  plannerUsers: PlannerUser[]
}

type Tab = 'overview' | 'institutions' | 'planner'

const STAT_CARDS = (s: Stats) => [
  { icon: Building2, label: 'Instituciones',       value: s.totalInstitutions, color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
  { icon: Users,     label: 'Usuarios totales',    value: s.totalUsers,        color: 'text-teal-400',    bg: 'bg-teal-500/10'    },
  { icon: Zap,       label: 'Docentes externos',   value: s.plannerSoloCount,  color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  { icon: FileText,  label: 'Planificaciones',     value: s.totalPlans,        color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  { icon: TrendingUp,label: 'Nuevos (30 días)',    value: s.newUsersMonth,     color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SuperAdminClient({ stats, institutions, plannerUsers }: Props) {
  const [tab, setTab]           = useState<Tab>('overview')
  const [search, setSearch]     = useState('')
  const [refreshing, setRefresh] = useState(false)

  function refresh() {
    setRefresh(true)
    window.location.reload()
  }

  const filteredInst = institutions.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.join_code.toLowerCase().includes(search.toLowerCase())
  )

  const filteredPlanner = plannerUsers.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.07] bg-[#0a0a10]/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Shield size={16} className="text-violet-400" />
          </div>
          <div>
            <span className="font-bold text-sm">SuperAdmin</span>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
              ClassNova Platform
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            <LogOut size={12} />
            Salir
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Page title ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Panel de Control</h1>
          <p className="text-white/40 text-sm">
            Visibilidad completa de toda la plataforma ClassNova.
          </p>
        </div>

        {/* ── Stats grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {STAT_CARDS(stats).map(s => (
            <div key={s.label} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon size={18} className={s.color} />
              </div>
              <p className={`text-3xl font-black tracking-tight ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/40 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 border-b border-white/[0.07] pb-0">
          {([
            { key: 'overview',     label: 'Resumen'             },
            { key: 'institutions', label: `Instituciones (${institutions.length})` },
            { key: 'planner',      label: `Docentes externos (${plannerUsers.length})` },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch('') }}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
                tab === t.key
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Overview ────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent institutions */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm">Últimas instituciones registradas</h3>
                <button onClick={() => setTab('institutions')} className="text-xs text-violet-400 hover:underline">
                  Ver todas →
                </button>
              </div>
              <div className="space-y-2">
                {institutions.slice(0, 6).map(i => (
                  <div key={i.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-sm">🏫</div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{i.name}</p>
                        <p className="text-[11px] text-white/30">{i.memberCount} miembros · {fmt(i.created_at)}</p>
                      </div>
                    </div>
                    <code className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                      {i.join_code}
                    </code>
                  </div>
                ))}
                {institutions.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-6">Sin instituciones aún.</p>
                )}
              </div>
            </div>

            {/* Recent planner solo users */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm">Últimos docentes externos</h3>
                <button onClick={() => setTab('planner')} className="text-xs text-amber-400 hover:underline">
                  Ver todos →
                </button>
              </div>
              <div className="space-y-2">
                {plannerUsers.slice(0, 6).map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name}</p>
                      <p className="text-[11px] text-white/30 truncate">{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        u.plan === 'planner_pro'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/5 text-white/30'
                      }`}>
                        {u.plan === 'planner_pro' ? 'Pro' : 'Free'}
                      </span>
                      <p className="text-[10px] text-white/20 mt-0.5">{fmt(u.created_at)}</p>
                    </div>
                  </div>
                ))}
                {plannerUsers.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-6">Sin docentes externos aún.</p>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="lg:col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <h3 className="font-bold text-sm mb-4">Acciones de plataforma</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '🌐', label: 'Ver landing planificador', href: '/planificador', color: 'border-violet-500/20 hover:border-violet-500/40' },
                  { icon: '📊', label: 'Dashboard institucional', href: '/dashboard',     color: 'border-teal-500/20  hover:border-teal-500/40'  },
                  { icon: '🔐', label: 'Auth Supabase',           href: 'https://app.supabase.com', color: 'border-white/10 hover:border-white/20', external: true },
                  { icon: '📋', label: 'Ver registro externo',    href: '/planificador/registro', color: 'border-amber-500/20 hover:border-amber-500/40' },
                ].map(a => (
                  <Link
                    key={a.label}
                    href={a.href}
                    target={a.external ? '_blank' : undefined}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border bg-white/[0.02] transition-all text-center ${a.color}`}
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-xs text-white/60 leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Institutions ────────────────────────────────────────── */}
        {tab === 'institutions' && (
          <div>
            {/* Search */}
            <div className="relative mb-5 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por nombre o código…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-white/[0.07] text-[11px] font-bold uppercase tracking-widest text-white/30">
                <span>Institución</span>
                <span>Código</span>
                <span>Miembros</span>
                <span>Registro</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-white/[0.04]">
                {filteredInst.map(i => (
                  <div key={i.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-sm flex-shrink-0">🏫</div>
                      <span className="text-sm font-medium truncate">{i.name}</span>
                    </div>
                    <code className="text-xs font-mono text-teal-400">{i.join_code}</code>
                    <span className="text-sm text-white/60">{i.memberCount}</span>
                    <div className="flex items-center gap-1.5 text-xs text-white/30">
                      <Calendar size={11} />
                      {fmt(i.created_at)}
                    </div>
                  </div>
                ))}
                {filteredInst.length === 0 && (
                  <div className="py-12 text-center text-white/30 text-sm">
                    {search ? 'Sin resultados para esa búsqueda.' : 'No hay instituciones registradas.'}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-white/20 mt-3 text-right">{filteredInst.length} de {institutions.length} instituciones</p>
          </div>
        )}

        {/* ── TAB: Planner Solo users ───────────────────────────────────── */}
        {tab === 'planner' && (
          <div>
            {/* Search */}
            <div className="relative mb-5 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por nombre o correo…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-5 py-3 border-b border-white/[0.07] text-[11px] font-bold uppercase tracking-widest text-white/30">
                <span>Docente</span>
                <span>Correo</span>
                <span>Plan</span>
                <span>Registro</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-white/[0.04]">
                {filteredPlanner.map(u => (
                  <div key={u.id} className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate">{u.full_name}</span>
                    </div>
                    <span className="text-xs text-white/50 truncate">{u.email}</span>
                    <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded w-fit ${
                      u.plan === 'planner_pro'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-white/30'
                    }`}>
                      {u.plan === 'planner_pro' ? 'Pro' : 'Free'}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-white/30">
                      <Calendar size={11} />
                      {fmt(u.created_at)}
                    </div>
                  </div>
                ))}
                {filteredPlanner.length === 0 && (
                  <div className="py-12 text-center text-white/30 text-sm">
                    {search ? 'Sin resultados para esa búsqueda.' : 'Aún no hay docentes externos registrados.'}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-white/20 mt-3 text-right">{filteredPlanner.length} de {plannerUsers.length} docentes externos</p>
          </div>
        )}
      </div>
    </div>
  )
}
