// src/app/auth/register/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="card p-10 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Crea tu cuenta gratis</h1>
        <p className="text-ink3 text-sm mb-8">Empieza a generar planificaciones en minutos</p>

        <RegisterForm />

        <p className="text-center text-sm text-ink3 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-violet2 font-semibold hover:underline">
            Inicia sesión
          </Link>
        </p>

        <p className="text-center text-[11px] text-ink3 mt-4 leading-relaxed">
          Al registrarte aceptas nuestros{' '}
          <Link href="/legal/terminos" className="text-violet2 hover:underline">Términos de servicio</Link>
          {' '}y{' '}
          <Link href="/legal/privacidad" className="text-violet2 hover:underline">Política de privacidad</Link>
        </p>
      </div>
    </div>
  )
}
