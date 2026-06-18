// src/app/auth/login/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="card p-10 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Bienvenido de nuevo</h1>
        <p className="text-ink3 text-sm mb-8">Ingresa a tu cuenta para continuar</p>

        <LoginForm />

        <p className="text-center text-sm text-ink3 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-violet2 font-semibold hover:underline">
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}
