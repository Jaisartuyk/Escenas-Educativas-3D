import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterPlannerForm } from '@/components/planner/RegisterPlannerForm'

export const metadata: Metadata = {
  title: 'Crear cuenta — ClassNova Planificador',
  description: 'Crea tu cuenta gratis y empieza a generar planificaciones con IA en segundos.',
}

export default function RegistroPlanificadorPage() {
  return (
    <div className="min-h-screen bg-[#0d0d14] text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <Link href="/planificador" className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <span className="font-bold text-lg tracking-tight">
            ClassNova <span className="text-violet-400">Planificador</span>
          </span>
        </Link>
        <Link
          href="/auth/login"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Ya tengo cuenta →
        </Link>
      </nav>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
              🧠
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Crea tu cuenta gratis</h1>
            <p className="text-white/50 text-sm">
              5 planificaciones al mes sin tarjeta de crédito.
            </p>
          </div>

          {/* Form card — light background so the form's CSS vars render correctly */}
          <div className="bg-white rounded-2xl p-7 shadow-2xl">
            <RegisterPlannerForm />
          </div>

          {/* Login link */}
          <p className="text-center text-white/30 text-xs mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-violet-400 hover:underline">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-white/20 text-xs">
        © {new Date().getFullYear()} ClassNova ·
        <Link href="/legal/terminos" className="hover:text-white/40 transition-colors ml-1 mr-1">Términos</Link>·
        <Link href="/legal/privacidad" className="hover:text-white/40 transition-colors ml-1">Privacidad</Link>
      </footer>
    </div>
  )
}
