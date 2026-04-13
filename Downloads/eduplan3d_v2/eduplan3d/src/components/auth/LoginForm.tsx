// src/components/auth/LoginForm.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from '@/lib/actions/auth'

export function LoginForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn(new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-[rgba(240,98,146,0.1)] border border-[rgba(240,98,146,0.3)] text-[#f48fb1] text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Cédula o correo electrónico</label>
        <input name="email" type="text" required placeholder="0912345678 o tu@correo.com" className="input-base" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3">Contraseña</label>
          <Link href="/auth/forgot-password" className="text-xs text-violet2 hover:underline">¿La olvidaste?</Link>
        </div>
        <input name="password" type="password" required placeholder="••••••••" className="input-base" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2">
        {loading ? 'Ingresando...' : 'Iniciar sesión →'}
      </button>
    </form>
  )
}
