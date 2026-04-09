'use client'

// src/components/onboarding/OnboardingModal.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createInstitution, joinInstitution } from '@/lib/actions/institution'
import toast from 'react-hot-toast'
import { Logo } from '@/components/ui/Logo'

type OnboardingMode = 'select' | 'create' | 'join'

export function OnboardingModal({ profileName }: { profileName: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<OnboardingMode>('select')
  const [loading, setLoading] = useState(false)
  
  // Inputs
  const [institutionName, setInstitutionName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!institutionName.trim()) return toast.error('Escribe el nombre de la escuela')
    
    setLoading(true)
    const result = await createInstitution(institutionName)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success('¡Institución creada! Cargando...')
      window.location.href = '/dashboard'
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return toast.error('Escribe el código de invitación')
    
    setLoading(true)
    const result = await joinInstitution(joinCode)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success('¡Unido! Cargando...')
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blend-soft-light" style={{ backgroundColor: '#090812' }}>
      
      {/* Decorative futuristic glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(124,109,250,0.15)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        
        <div className="flex justify-center mb-8">
          <Logo size="md" />
        </div>

        <div className="bg-surface border border-[rgba(124,109,250,0.2)] rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-2 text-center">
            ¡Hola, {profileName.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-ink3 text-center mb-8">
            Para empezar a usar EduPlan 3D, necesitas conectarte a una Unidad Educativa.
          </p>

          {mode === 'select' && (
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => setMode('create')}
                className="w-full card-hover flex flex-col items-center justify-center p-6 bg-[rgba(124,109,250,0.05)] border border-[rgba(124,109,250,0.2)] rounded-xl transition-colors hover:border-[rgba(124,109,250,0.5)] group"
              >
                <div className="w-12 h-12 rounded-full bg-[rgba(124,109,250,0.15)] text-violet2 flex items-center justify-center text-xl mb-3 transition-transform group-hover:scale-110">
                  🏫
                </div>
                <h3 className="font-bold text-ink text-base">Soy el Administrador / Creador</h3>
                <p className="text-xs text-ink3 font-medium mt-1">Registrar mi colegio por primera vez</p>
              </button>

              <button 
                onClick={() => setMode('join')}
                className="w-full card-hover flex flex-col items-center justify-center p-6 bg-[rgba(38,215,180,0.05)] border border-[rgba(38,215,180,0.2)] rounded-xl transition-colors hover:border-[rgba(38,215,180,0.5)] group"
              >
                <div className="w-12 h-12 rounded-full bg-[rgba(38,215,180,0.15)] text-teal flex items-center justify-center text-xl mb-3 transition-transform group-hover:scale-110">
                  🔑
                </div>
                <h3 className="font-bold text-ink text-base">Soy un Docente / Alumno</h3>
                <p className="text-xs text-ink3 font-medium mt-1">Tengo un código de invitación</p>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="animate-fade-in flex flex-col gap-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-2">Nombre de la Institución</label>
                <input 
                  autoFocus
                  placeholder='Ej. "Unidad Educativa 24 de Julio"' 
                  value={institutionName}
                  onChange={e => setInstitutionName(e.target.value)}
                  className="input-base text-base py-3 px-4 w-full"
                  required
                />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm">
                  {loading ? 'Creando infraestructura...' : 'Crear mi escuela'}
                </button>
                <button type="button" onClick={() => setMode('select')} disabled={loading} className="text-xs font-semibold text-ink3 hover:text-ink py-2 transition-colors">
                  ← Volver
                </button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="animate-fade-in flex flex-col gap-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-2">Código de Invitación</label>
                <input 
                  autoFocus
                  placeholder="Ej. EDU-XB4D1" 
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  className="input-base text-base py-3 px-4 w-full text-center tracking-widest font-mono"
                  required
                />
                <p className="text-[11px] text-ink3 text-center mt-2">El administrador te debió dar este código.</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button type="submit" disabled={loading} className="bg-teal hover:bg-[#1fb395] text-[#04342C] font-bold rounded-xl w-full py-3.5 text-sm transition-colors cursor-pointer">
                  {loading ? 'Verificando código...' : 'Unirme a la plataforma'}
                </button>
                <button type="button" onClick={() => setMode('select')} disabled={loading} className="text-xs font-semibold text-ink3 hover:text-ink py-2 transition-colors">
                  ← Volver
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
