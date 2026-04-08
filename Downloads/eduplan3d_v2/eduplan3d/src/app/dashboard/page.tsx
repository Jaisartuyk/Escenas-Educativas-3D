// src/app/dashboard/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard' }

const TYPE_LABELS: Record<string, string> = { clase: 'Clase', unidad: 'Unidad', rubrica: 'Rúbrica' }
const TYPE_CLASSES: Record<string, string> = {
  clase:   'badge-violet',
  unidad:  'badge-amber',
  rubrica: 'badge-rose',
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  try {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

  const { data: planificaciones } = await (supabase as any)
    .from('planificaciones')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: totalPlans } = await (supabase as any)
    .from('planificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: thisMonth } = await (supabase as any)
    .from('planificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Docente'
  const isHorariosOnly = user?.email === 'israferaldascarlett15@gmail.com'

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-ink3 text-sm mt-1">
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      {/* Upgrade banner (solo plan free) */}
      {profile?.plan === 'free' && (
        <div className="mb-6 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[rgba(124,109,250,0.12)] to-[rgba(240,98,146,0.10)] border border-[rgba(124,109,250,0.25)]">
          <span className="text-2xl">⚡</span>
          <div className="flex-1">
            <strong className="text-sm font-semibold block mb-0.5">Estás en el plan Starter</strong>
            <span className="text-xs text-ink2">Tienes {Math.max(0, 10 - (thisMonth ?? 0))} planificaciones restantes este mes</span>
          </div>
          <Link href="/dashboard/configuracion?tab=plan" className="btn-primary text-sm px-5 py-2 whitespace-nowrap">
            Mejorar a Pro →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total planificaciones', value: totalPlans ?? 0,  color: 'text-violet2' },
          { label: 'Este mes',              value: thisMonth ?? 0,   color: 'text-teal'   },
          { label: 'Escenas 3D vistas',     value: 12,               color: 'text-rose'   },
          { label: 'Horas ahorradas',       value: `${((totalPlans ?? 0) * 1.5).toFixed(0)}h`, color: 'text-amber' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-[11px] font-semibold text-ink3 uppercase tracking-[.5px] mb-2">{s.label}</p>
            <p className={`font-display text-[32px] font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* Recent planificaciones */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold tracking-tight">Planificaciones recientes</h2>
            <Link href="/dashboard/historial" className="text-xs text-violet2 font-medium hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {!planificaciones?.length ? (
              <div className="card p-10 text-center text-ink3">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-medium text-sm mb-1">Aún no tienes planificaciones</p>
                <p className="text-xs">Ve al Planificador para generar tu primera</p>
              </div>
            ) : planificaciones.map((p: any) => (
              <Link key={p.id} href={`/dashboard/historial/${p.id}`}
                className="card-hover p-4 flex items-center gap-4 cursor-pointer">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                  p.type === 'clase' ? 'bg-[rgba(124,109,250,0.15)]' :
                  p.type === 'unidad' ? 'bg-[rgba(255,179,71,0.15)]' : 'bg-[rgba(240,98,146,0.15)]'
                }`}>
                  {p.type === 'clase' ? '📋' : p.type === 'unidad' ? '📚' : '🎯'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  <p className="text-xs text-ink3 mt-0.5">
                    {p.subject} · {p.grade} · {format(new Date(p.created_at), "d MMM", { locale: es })}
                  </p>
                </div>
                <span className={`${TYPE_CLASSES[p.type]} flex-shrink-0`}>
                  {TYPE_LABELS[p.type]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight mb-4">Acciones rápidas</h2>
          <div className="flex flex-col gap-3">
            {[
              { icon: '📋', title: 'Nueva planificación de clase', sub: 'Lista en ~30 segundos', href: '/dashboard/planificador?type=clase',   bg: 'bg-[rgba(124,109,250,0.15)]' },
              { icon: '📚', title: 'Nueva unidad didáctica',       sub: 'Completa y estructurada', href: '/dashboard/planificador?type=unidad',  bg: 'bg-[rgba(255,179,71,0.15)]' },
              { icon: '📅', title: 'Generar horario',              sub: 'Sin choques de docentes', href: '/dashboard/horarios',                  bg: 'bg-[rgba(38,215,180,0.15)]'  },
              { icon: '🔬', title: 'Explorar escenas 3D',          sub: '6 modelos interactivos',  href: '/dashboard/escenas',                  bg: 'bg-[rgba(240,98,146,0.15)]'  },
            ].filter(a => isHorariosOnly ? a.href.includes('horarios') : true).map(a => (
              <Link key={a.title} href={a.href}
                className="card-hover p-4 flex items-center gap-4 group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${a.bg}`}>
                  {a.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-ink3 mt-0.5">{a.sub}</p>
                </div>
                <span className="text-ink3 group-hover:text-violet2 transition-colors text-lg">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
  } catch (err: any) {
    return (
      <div className="p-8 text-rose bg-surface font-mono overflow-auto text-sm">
        <h2 className="font-bold text-xl mb-4">SSR PAGE EXCEPTION CAUGHT:</h2>
        <p><strong>Message:</strong> {err.message}</p>
        <pre className="mt-4">{err.stack}</pre>
        <p className="mt-4 break-all">{JSON.stringify(err)}</p>
      </div>
    )
  }
}
