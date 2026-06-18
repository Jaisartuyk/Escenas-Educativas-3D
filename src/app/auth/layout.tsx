// src/app/auth/layout.tsx
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Glows de fondo */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,109,250,0.12)_0%,transparent_65%)] -top-48 -left-24 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(240,98,146,0.08)_0%,transparent_65%)] -bottom-24 -right-12 pointer-events-none" />

      <div className="mb-8">
        <Link href="/"><Logo /></Link>
      </div>

      {children}

      {/* Volver */}
      <Link href="/" className="mt-8 text-sm text-ink3 hover:text-ink transition-colors flex items-center gap-1">
        ← Volver al login
      </Link>
    </div>
  )
}
