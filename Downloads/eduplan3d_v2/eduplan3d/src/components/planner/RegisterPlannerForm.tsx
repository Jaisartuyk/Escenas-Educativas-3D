'use client'
// src/components/planner/RegisterPlannerForm.tsx

import { useState } from 'react'
import { createPlannerSoloUser } from '@/lib/actions/planner-solo'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export function RegisterPlannerForm() {
  const [form, setForm]         = useState({ full_name: '', email: '', password: '' })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) return setError('Ingresa tu nombre completo')
    if (!form.email.trim())     return setError('Ingresa tu correo')
    if (form.password.length < 6) return setError('La contraseña debe tener mínimo 6 caracteres')

    setLoading(true)
    setError('')

    const res = await createPlannerSoloUser({
      full_name: form.full_name.trim(),
      email:     form.email.trim().toLowerCase(),
      password:  form.password,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mx-auto text-3xl">🎉</div>
        <h2 className="font-bold text-xl text-ink">¡Cuenta creada exitosamente!</h2>
        <p className="text-ink3 text-sm">Ya puedes iniciar sesión y empezar a planificar con IA.</p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-violet2 text-white font-bold text-sm hover:bg-violet transition-colors mt-2"
        >
          Iniciar sesión →
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-ink3 uppercase tracking-wider mb-1.5">
          Nombre completo
        </label>
        <input
          type="text"
          required
          value={form.full_name}
          onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          placeholder="Ej. María González"
          className="input-base"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-ink3 uppercase tracking-wider mb-1.5">
          Correo electrónico
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="tu@correo.com"
          className="input-base"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-ink3 uppercase tracking-wider mb-1.5">
          Contraseña
        </label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            required
            minLength={6}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Mínimo 6 caracteres"
            className="input-base pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPass(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink4 hover:text-ink3"
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-violet2 text-white font-bold text-sm hover:bg-violet transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...</> : 'Crear cuenta gratis'}
      </button>

      <p className="text-center text-xs text-ink4 leading-relaxed">
        Al registrarte aceptas nuestros{' '}
        <Link href="/legal/terminos" className="text-violet2 hover:underline">Términos</Link>
        {' '}y{' '}
        <Link href="/legal/privacidad" className="text-violet2 hover:underline">Privacidad</Link>.
        No se requiere tarjeta de crédito.
      </p>
    </form>
  )
}
