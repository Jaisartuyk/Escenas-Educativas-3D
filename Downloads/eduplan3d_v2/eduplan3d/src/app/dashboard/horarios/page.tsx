// src/app/dashboard/horarios/page.tsx
import type { Metadata } from 'next'
import { HorariosClient } from '@/components/horarios/HorariosClient'

export const metadata: Metadata = { title: 'Horarios' }

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default function HorariosPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Generador de Horarios</h1>
        <p className="text-ink3 text-sm mt-1">
          Crea y edita horarios automáticamente — sin choques de docentes
        </p>
      </div>
      <HorariosClient />
    </div>
  )
}
