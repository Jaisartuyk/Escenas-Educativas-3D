// src/components/layout/ConfiguracionClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { updateProfile } from '@/lib/actions/auth'
import type { Profile } from '@/types/supabase'

const PLANS = [
  {
    id: 'free', name: 'Starter', price: '$0/mes',
    features: ['10 planificaciones/mes', '3 escenas 3D', 'Exportar texto'],
    color: 'border-[rgba(120,100,255,0.14)]',
  },
  {
    id: 'pro', name: 'Pro', price: '$9/mes',
    features: ['Planificaciones ilimitadas', 'Todas las escenas 3D', 'Exportar Word/PDF', 'Soporte prioritario'],
    color: 'border-violet',
  },
  {
    id: 'institucion', name: 'Institución', price: '$49/mes',
    features: ['Todo de Pro', 'Hasta 20 docentes', 'Panel de administración', 'SLA garantizado'],
    color: 'border-teal',
  },
]

// Planes específicos para docente externo (planner_solo)
const PLANNER_PLANS = [
  {
    id: 'planner_solo', name: 'Gratis', price: '$0/mes',
    features: ['5 planificaciones/mes', 'Plan diario y semanal', 'Historial de 30 días', 'Exportar texto'],
    color: 'border-[rgba(120,100,255,0.14)]',
  },
  {
    id: 'planner_pro', name: 'Pro', price: '$4.99/mes',
    features: ['Planificaciones ilimitadas', 'Todos los tipos (PCA, PUD, diario)', 'Biblioteca de PDFs', 'Historial completo', 'Exportar Word/PDF', 'Soporte prioritario'],
    color: 'border-violet',
  },
]

interface Props {
  profile: Profile | null
  standalone?: boolean
}

export function ConfiguracionClient({ profile, standalone = false }: Props) {
  const [activeTab, setActiveTab] = useState<'perfil' | 'plan' | 'seguridad'>('perfil')
  const router = useRouter()

  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = await updateProfile(new FormData(e.currentTarget))
    if (result?.error)   toast.error(result.error)
    if (result?.success) { toast.success(result.success); router.refresh() }
  }

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6">
      {/* Nav */}
      <nav className="card p-2 h-fit">
        {([['perfil','👤','Mi perfil'],['plan','⚡','Suscripción'],['seguridad','🔒','Seguridad']] as const).map(([tab, icon, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all ${
              activeTab === tab ? 'bg-surface2 text-ink' : 'text-ink3 hover:text-ink2 hover:bg-[rgba(0,0,0,0.03)]'
            }`}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      {/* Panel */}
      <div className="card p-7">
        {/* ── PERFIL ── */}
        {activeTab === 'perfil' && (
          <form onSubmit={handleProfileSave} className="space-y-5 max-w-lg">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight mb-0.5">Mi perfil</h2>
              <p className="text-ink3 text-sm">
                {standalone ? 'Información personal de tu cuenta' : 'Información personal y de tu institución'}
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre completo</label>
              <input name="full_name" defaultValue={profile?.full_name ?? ''} className="input-base" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Correo electrónico</label>
              <input value={profile?.email ?? ''} disabled className="input-base opacity-50 cursor-not-allowed" />
              <p className="text-[11px] text-ink3 mt-1">El correo no puede cambiarse desde aquí</p>
            </div>
            {!standalone && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Institución educativa</label>
                <input name="institution" defaultValue={profile?.institution ?? ''} placeholder="Unidad Educativa..." className="input-base" />
              </div>
            )}
            <button type="submit" className="btn-primary px-6 py-2.5">Guardar cambios</button>
          </form>
        )}

        {/* ── PLAN ── */}
        {activeTab === 'plan' && (
          <div>
            <div className="mb-6">
              <h2 className="font-display text-lg font-bold tracking-tight mb-0.5">
                {standalone ? 'Plan del Planificador' : 'Suscripción'}
              </h2>
              <p className="text-ink3 text-sm">
                {standalone ? 'Cambia entre Gratis y Pro cuando quieras' : 'Gestiona tu plan actual'}
              </p>
            </div>
            <div className={`grid grid-cols-1 ${standalone ? 'sm:grid-cols-2 max-w-xl' : 'sm:grid-cols-3'} gap-4`}>
              {(standalone ? PLANNER_PLANS : PLANS).map(p => (
                <div key={p.id} className={`card p-5 border-2 ${p.color} ${profile?.plan === p.id ? '' : 'opacity-70'} relative`}>
                  {profile?.plan === p.id && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet to-violet2 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                      Plan actual
                    </div>
                  )}
                  <h3 className="font-display font-bold text-base mb-0.5">{p.name}</h3>
                  <p className="text-violet2 font-bold text-lg mb-4">{p.price}</p>
                  <ul className="space-y-1.5 mb-5">
                    {p.features.map(f => (
                      <li key={f} className="text-xs text-ink2 flex items-center gap-1.5">
                        <span className="text-teal font-bold">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  {profile?.plan !== p.id && (
                    <button
                      onClick={() => toast('Integración de pagos próximamente 🚀')}
                      className="btn-primary w-full text-sm py-2"
                    >
                      Cambiar a {p.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEGURIDAD ── */}
        {activeTab === 'seguridad' && (
          <div className="max-w-lg">
            <div className="mb-6">
              <h2 className="font-display text-lg font-bold tracking-tight mb-0.5">Seguridad</h2>
              <p className="text-ink3 text-sm">Cambia tu contraseña o gestiona el acceso</p>
            </div>
            <div className="card p-5 mb-4">
              <p className="text-sm font-semibold mb-1">Cambiar contraseña</p>
              <p className="text-xs text-ink3 mb-4">Te enviaremos un enlace de restablecimiento a tu correo</p>
              <button
                onClick={() => toast('Enlace de restablecimiento enviado a tu correo')}
                className="btn-secondary text-sm px-5 py-2"
              >
                Enviar enlace de restablecimiento
              </button>
            </div>
            <div className="card p-5 border-rose/30">
              <p className="text-sm font-semibold text-rose mb-1">Zona peligrosa</p>
              <p className="text-xs text-ink3 mb-4">Una vez eliminada tu cuenta, no hay vuelta atrás</p>
              <button
                onClick={() => toast.error('Contacta a soporte para eliminar tu cuenta')}
                className="text-sm px-5 py-2 rounded-xl border border-rose/30 text-rose hover:bg-rose/10 transition-colors"
              >
                Eliminar mi cuenta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
