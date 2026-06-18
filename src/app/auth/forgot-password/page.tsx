// src/app/auth/forgot-password/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="card p-10 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Recupera tu contraseña</h1>
        <p className="text-ink3 text-sm mb-8">
          Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        <ForgotPasswordForm />

        <p className="text-center text-sm text-ink3 mt-6">
          <Link href="/auth/login" className="text-violet2 font-semibold hover:underline">
            ← Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
