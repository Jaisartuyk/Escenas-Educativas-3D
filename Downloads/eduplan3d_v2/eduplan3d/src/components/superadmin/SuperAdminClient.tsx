'use client'
// src/components/superadmin/SuperAdminClient.tsx

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2, Users, Zap, FileText, TrendingUp,
  Search, LogOut, RefreshCw, ChevronRight, Calendar,
  Shield, X, Settings2, CheckCircle2, Sparkles, Trash2,
  DollarSign, Lock, Unlock, AlertTriangle
} from 'lucide-react'
import { updateUserPlan, deleteInstitutionUser } from '@/lib/actions/users'
import { recordPlannerPayment, setPlannerSuspended } from '@/lib/actions/subscriptions'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

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

interface TeacherSub {
  id: string
  full_name: string
  email: string
  plan: string
  role: string
  planner_suspended: boolean
  institution_id: string | null
  institution_name: string
  current_period_end: string | null
  sub_status: 'active' | 'expired' | 'suspended' | 'cancelled' | 'never'
  monthly_amount: number
}

interface PaymentStats {
  activeCount: number
  expiredCount: number
  monthRevenue: number
  totalTeachers: number
}

interface Props {
  stats:        Stats
  institutions: Institution[]
  plannerUsers: PlannerUser[]
  teacherSubs?: TeacherSub[]
  paymentStats?: PaymentStats
}

type Tab = 'overview' | 'institutions' | 'planner' | 'payments'

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

export function SuperAdminClient({ stats, institutions, plannerUsers, teacherSubs = [], paymentStats }: Props) {
  const [tab, setTab]           = useState<Tab>('overview')
  const [search, setSearch]     = useState('')
  const [refreshing, setRefresh] = useState(false)

  // Member management
  const [viewingInst, setViewingInst] = useState<Institution | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  const supabase = createClient()

  function refresh() {
    setRefresh(true)
    window.location.reload()
  }

  async function openMembers(inst: Institution) {
    setViewingInst(inst)
    setLoadingMembers(true)
    setMembers([])
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, plan, created_at')
        .eq('institution_id', inst.id)
        .order('role', { ascending: true })
        .order('full_name', { ascending: true })

      if (error) throw error
      setMembers(data || [])
    } catch (err: any) {
      toast.error('Error al cargar miembros: ' + err.message)
    } finally {
      setLoadingMembers(false)
    }
  }

  async function togglePlan(user: any) {
    const newPlan = user.plan === 'institucion_premium' ? 'institucion' : 'institucion_premium'
    setUpdatingUserId(user.id)
    try {
      const res = await updateUserPlan(user.id, newPlan)
      if (res.error) throw new Error(res.error)
      
      setMembers(prev => prev.map(m => m.id === user.id ? { ...m, plan: newPlan } : m))
      toast.success(`Plan actualizado para ${user.full_name}`)
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function bulkUpdatePlan(premium: boolean) {
    if (!viewingInst) return
    const newPlan = premium ? 'institucion_premium' : 'institucion'
    const teachers = members.filter(m => m.role === 'teacher')
    if (teachers.length === 0) return toast.error('No hay docentes para actualizar')

    const verb = premium ? 'Habilitar' : 'Deshabilitar'
    const extraMsg = premium
      ? 'Quedan habilitados para usar el planificador.'
      : 'NO podrán usar el planificador hasta volver a habilitarlos o registrar un pago.'
    if (!confirm(`¿${verb} el planificador para los ${teachers.length} docentes?\n\n${extraMsg}`)) return

    setLoadingMembers(true)
    try {
      for (const t of teachers) {
        // Cambia el plan
        await updateUserPlan(t.id, newPlan)
        // Y aplica el bloqueo duro: deshabilitar = suspended true; habilitar = suspended false
        await setPlannerSuspended(t.id, !premium)
      }
      setMembers(prev =>
        prev.map(m =>
          m.role === 'teacher' ? { ...m, plan: newPlan, planner_suspended: !premium } : m
        )
      )
      toast.success(
        premium
          ? `Planificador habilitado para ${teachers.length} docentes`
          : `Planificador deshabilitado para ${teachers.length} docentes`
      )
    } catch (err: any) {
      toast.error('Error en actualización masiva')
    } finally {
      setLoadingMembers(false)
    }
  }

  async function handleDeleteUser(user: any) {
    if (!confirm(`¿Estás seguro de eliminar permanentemente a ${user.full_name}?\nEsta acción no se puede deshacer.`)) return
    
    setDeletingUserId(user.id)
    try {
      const res = await deleteInstitutionUser(user.id)
      if (res.error) throw new Error(res.error)
      
      setMembers(prev => prev.filter(m => m.id !== user.id))
      toast.success('Usuario eliminado del sistema')
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message)
    } finally {
      setDeletingUserId(null)
    }
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
            { key: 'payments',     label: `Pagos (${teacherSubs.length})` },
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
                  <div 
                    key={i.id} 
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors items-center cursor-pointer group"
                    onClick={() => openMembers(i)}
                  >
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
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={16} className="text-white/20" />
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

        {/* ── TAB: Payments / Suscripciones ─────────────────────────────── */}
        {tab === 'payments' && (
          <PaymentsTab
            teacherSubs={teacherSubs}
            paymentStats={paymentStats}
            search={search}
            setSearch={setSearch}
          />
        )}
      </div>

      {/* ── Modal: Gestión de Miembros ────────────────────────────────── */}
      {viewingInst && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121e] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-2xl">🏫</div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{viewingInst?.name || 'Institución'}</h2>
                  <p className="text-white/40 text-xs mt-0.5">
                    Gestión de personal y accesos premium · {members.length} miembros
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingInst(null)}
                className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Bulk Actions Bar */}
            <div className="px-6 py-3 bg-white/[0.01] border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Acciones masivas de Institución:</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => bulkUpdatePlan(true)}
                  disabled={loadingMembers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-violet-500/20 text-violet-400 border border-violet-500/20 hover:bg-violet-500/30 transition-all disabled:opacity-50"
                >
                  <Sparkles size={12} /> Habilitar Planificador (Todos)
                </button>
                <button 
                  onClick={() => bulkUpdatePlan(false)}
                  disabled={loadingMembers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <X size={12} /> Deshabilitar Todo
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {loadingMembers ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                  <p className="text-xs text-white/40 animate-pulse">Cargando base de miembros...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {members.map(u => {
                    const isPremium = u.plan === 'institucion_premium'
                    const isTeacher = u.role === 'teacher'
                    const isUpdating = updatingUserId === u.id

                    return (
                      <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] transition-all">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                          u.role === 'admin' || u.role === 'rector' ? 'bg-red-500/10 text-red-400' :
                          u.role === 'teacher' ? 'bg-violet-500/10 text-violet-400' :
                          'bg-teal-500/10 text-teal-400'
                        }`}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{u.full_name}</p>
                          <p className="text-[10px] text-white/30 truncate mb-1">{u.role.toUpperCase()} · {u.email}</p>
                          
                          {/* Plan Status Badge */}
                          <div className="flex items-center gap-2">
                             <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                               isPremium 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' 
                                : 'bg-white/5 text-white/30'
                             }`}>
                               {isPremium ? <><CheckCircle2 size={10} /> Planificador Pro</> : 'Plan Estándar'}
                             </div>
                             {isPremium && (
                               <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                                 <Zap size={8} /> Activo
                               </span>
                             )}
                          </div>
                        </div>

                        {/* Toggle Button (only for teachers, as they use the planner) */}
                        {isTeacher && (
                          <button
                            onClick={() => togglePlan(u)}
                            disabled={isUpdating}
                            className={`p-2.5 rounded-xl transition-all ${
                              isPremium
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                                : 'bg-white/5 text-white/30 border border-white/5 hover:border-white/10 hover:text-white'
                            }`}
                            title={isPremium ? 'Desactivar Planificador' : 'Activar Planificador'}
                          >
                            {isUpdating ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : isPremium ? (
                              <Zap size={16} />
                            ) : (
                              <Settings2 size={16} />
                            )}
                          </button>
                        )}

                        {/* Delete Button for SuperAdmin */}
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={deletingUserId === u.id}
                          className="p-2.5 rounded-xl border border-white/5 hover:bg-red-500/10 hover:text-red-500 transition-all text-white/20"
                          title="Eliminar usuario definitivamente"
                        >
                          {deletingUserId === u.id ? (
                            <RefreshCw size={16} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01] flex justify-end">
              <button 
                onClick={() => setViewingInst(null)}
                className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold transition-all"
              >
                Cerrar Gestión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// PaymentsTab: gestión de suscripciones y pagos del planificador IA
// ────────────────────────────────────────────────────────────────────────────

function PaymentsTab({
  teacherSubs,
  paymentStats,
  search,
  setSearch,
}: {
  teacherSubs: TeacherSub[]
  paymentStats?: PaymentStats
  search: string
  setSearch: (s: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'never'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [list, setList] = useState(teacherSubs)
  const [payModal, setPayModal] = useState<TeacherSub | null>(null)
  const [payAmount, setPayAmount] = useState(20)
  const [payMethod, setPayMethod] = useState<'efectivo' | 'transferencia' | 'deposito' | 'otro'>('efectivo')
  const [payNotes, setPayNotes] = useState('')

  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  const enriched = list.map(t => {
    const end = t.current_period_end ? new Date(t.current_period_end).getTime() : null
    const daysLeft = end ? Math.round((end - now) / (24 * 60 * 60 * 1000)) : null
    let computedStatus: 'active' | 'expiring' | 'expired' | 'suspended' | 'never'
    if (t.planner_suspended) computedStatus = 'suspended'
    else if (!end) computedStatus = 'never'
    else if (end < now) computedStatus = 'expired'
    else if (end - now < sevenDays) computedStatus = 'expiring'
    else computedStatus = 'active'
    return { ...t, daysLeft, computedStatus }
  })

  const filtered = enriched
    .filter(t => {
      if (filter === 'active' && t.computedStatus !== 'active' && t.computedStatus !== 'expiring') return false
      if (filter === 'expired' && t.computedStatus !== 'expired' && t.computedStatus !== 'suspended') return false
      if (filter === 'never' && t.computedStatus !== 'never') return false
      return true
    })
    .filter(t => {
      if (!search) return true
      const s = search.toLowerCase()
      return t.full_name?.toLowerCase().includes(s) ||
             t.email?.toLowerCase().includes(s) ||
             t.institution_name?.toLowerCase().includes(s)
    })

  async function handleSuspend(t: TeacherSub, suspended: boolean) {
    setBusyId(t.id)
    try {
      const res = await setPlannerSuspended(t.id, suspended)
      if ((res as any).error) throw new Error((res as any).error)
      setList(prev => prev.map(x => x.id === t.id ? { ...x, planner_suspended: suspended, sub_status: suspended ? 'suspended' : x.sub_status } : x))
      toast.success(suspended ? 'Docente suspendido' : 'Docente reactivado')
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleRecordPayment() {
    if (!payModal) return
    setBusyId(payModal.id)
    try {
      const res = await recordPlannerPayment({
        userId: payModal.id,
        amount: payAmount,
        method: payMethod,
        notes: payNotes || undefined,
      })
      if ((res as any).error) throw new Error((res as any).error)
      const newEnd = (res as any).period_end as string
      setList(prev => prev.map(x => x.id === payModal.id ? {
        ...x,
        planner_suspended: false,
        sub_status: 'active' as const,
        current_period_end: newEnd,
      } : x))
      toast.success('Pago de $' + payAmount + ' registrado · vence ' + new Date(newEnd).toLocaleDateString('es-EC'))
      setPayModal(null)
      setPayNotes('')
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally {
      setBusyId(null)
    }
  }

  const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
    active:    { label: 'Al día',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    expiring:  { label: 'Por vencer', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    expired:   { label: 'Vencido',    cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    suspended: { label: 'Suspendido', cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
    never:     { label: 'Sin pago',   cls: 'bg-white/5 text-white/40 border-white/10' },
  }

  return (
    <div>
      {paymentStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Activos</span>
            </div>
            <p className="text-2xl font-black text-emerald-400">{paymentStats.activeCount}</p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Vencidos / Suspendidos</span>
            </div>
            <p className="text-2xl font-black text-red-400">{paymentStats.expiredCount}</p>
          </div>
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-violet-400" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Cobrado este mes</span>
            </div>
            <p className="text-2xl font-black text-violet-400">${paymentStats.monthRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-white/60" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Total docentes</span>
            </div>
            <p className="text-2xl font-black text-white/80">{paymentStats.totalTeachers}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Buscar docente, email o institución…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'active', 'expired', 'never'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={'px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all ' + (filter === f ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-white/40 hover:text-white/70 border border-transparent')}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : f === 'expired' ? 'Vencidos' : 'Sin pago'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] gap-3 px-5 py-3 border-b border-white/[0.07] text-[11px] font-bold uppercase tracking-widest text-white/30">
          <span>Docente</span>
          <span>Institución</span>
          <span>Estado</span>
          <span>Vence</span>
          <span className="text-right">Acciones</span>
        </div>
        <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
          {filtered.map(t => {
            const badge = STATUS_BADGES[t.computedStatus]
            return (
              <div key={t.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] gap-3 px-5 py-3 items-center hover:bg-white/[0.02]">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.full_name || '(Sin nombre)'}</p>
                  <p className="text-[11px] text-white/30 truncate">{t.email}</p>
                </div>
                <span className="text-xs text-white/60 truncate">{t.institution_name}</span>
                <span className={'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border w-fit ' + badge.cls}>
                  {badge.label}
                </span>
                <span className="text-xs text-white/50">
                  {t.current_period_end
                    ? fmt(t.current_period_end) + (t.daysLeft != null && t.daysLeft >= 0 ? ' (' + t.daysLeft + 'd)' : '')
                    : '—'}
                </span>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setPayModal(t); setPayAmount(t.monthly_amount || 20) }}
                    disabled={busyId === t.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    <DollarSign size={12} />
                    Pago
                  </button>
                  {t.planner_suspended ? (
                    <button
                      onClick={() => handleSuspend(t, false)}
                      disabled={busyId === t.id}
                      className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-40"
                      title="Reactivar"
                    >
                      <Unlock size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspend(t, true)}
                      disabled={busyId === t.id}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
                      title="Suspender"
                    >
                      <Lock size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-white/30 text-center py-12">Sin docentes con esos filtros.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-white/20 mt-3 text-right">{filtered.length} de {teacherSubs.length} docentes</p>

      {payModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <div className="bg-[#12121e] border border-white/10 rounded-3xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Registrar pago</h3>
            <p className="text-xs text-white/50 mb-5">{payModal.full_name} · {payModal.email}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Monto (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Método</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-violet-500/50"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="deposito">Depósito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Notas (opcional)</label>
                <textarea
                  rows={3}
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Ref. transferencia, fecha, etc."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              <div className="text-[11px] text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                Al registrar este pago, la suscripción se renueva por <span className="text-white font-bold">30 días</span> y se reactiva el acceso al planificador.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setPayModal(null)}
                disabled={busyId === payModal.id}
                className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={busyId === payModal.id || payAmount <= 0}
                className="px-5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-sm font-bold transition-all disabled:opacity-40"
              >
                {busyId === payModal.id ? 'Guardando…' : 'Registrar $' + payAmount.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
