// src/components/auth/RegisterForm.tsx
'use client'

import { useState } from 'react'
import { signUp } from '@/lib/actions/auth'

export function RegisterForm() {
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const fd       = new FormData(e.currentTarget)
    const password = fd.get('password') as string
    const confirm  = fd.get('confirm')  as string

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      setLoading(false)
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      setLoading(false)
      return
    }

    const result = await signUp(fd)
    if (result?.error)   { setError(result.error); setLoading(false) }
    if (result?.success) { setSuccess(result.success); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-[rgba(240,98,146,0.1)] border border-[rgba(240,98,146,0.3)] text-[#f48fb1] text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-[rgba(38,215,180,0.1)] border border-[rgba(38,215,180,0.3)] text-teal text-sm">
          {success}
        </div>
      )}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre completo</label>
        <input name="full_name" type="text" required placeholder="Ana Torres" className="input-base" />
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Correo electrónico</label>
        <input name="email" type="email" required placeholder="tu@correo.com" className="input-base" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Contraseña</label>
          <input name="password" type="password" required placeholder="min. 8 caracteres" className="input-base" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Confirmar</label>
          <input name="confirm" type="password" required placeholder="••••••••" className="input-base" />
        </div>
      </div>
      <button type="submit" disabled={loading || !!success} className="btn-primary w-full py-3.5 mt-2">
        {loading ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
      </button>
    </form>
  )
}
