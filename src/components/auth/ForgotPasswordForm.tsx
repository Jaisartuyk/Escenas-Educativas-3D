// src/components/auth/ForgotPasswordForm.tsx
'use client'

import { useState } from 'react'
import { resetPassword } from '@/lib/actions/auth'

export function ForgotPasswordForm() {
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await resetPassword(new FormData(e.currentTarget))
    if (result?.error)   { setError(result.error) }
    if (result?.success) { setSuccess(result.success) }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-[rgba(240,98,146,0.1)] border border-[rgba(240,98,146,0.3)] text-[#f48fb1] text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-[rgba(38,215,180,0.1)] border border-[rgba(38,215,180,0.3)] text-teal text-sm">{success}</div>
      )}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Correo electrónico</label>
        <input name="email" type="email" required placeholder="tu@correo.com" className="input-base" />
      </div>
      <button type="submit" disabled={loading || !!success} className="btn-primary w-full py-3.5">
        {loading ? 'Enviando...' : 'Enviar enlace de recuperación →'}
      </button>
    </form>
  )
}
