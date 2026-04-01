// src/app/dashboard/planificador/page.tsx
import type { Metadata } from 'next'
import { PlannerClient } from '@/components/planner/PlannerClient'

export const metadata: Metadata = { title: 'Planificador' }

export default function PlanificadorPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Planificador</h1>
        <p className="text-ink3 text-sm mt-1">Genera planificaciones curriculares con IA en segundos</p>
      </div>
      <PlannerClient />
    </div>
  )
}
