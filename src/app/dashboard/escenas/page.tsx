// src/app/dashboard/escenas/page.tsx
import type { Metadata } from 'next'
import { ScenesWrapper } from '@/components/scenes/ScenesWrapper'

export const metadata: Metadata = { title: 'Escenas 3D' }

export default function ScenesPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Escenas Educativas 3D</h1>
        <p className="text-ink3 text-sm mt-1">Explora modelos en 3D y usa la IA para generar explicaciones didácticas.</p>
      </div>
      <ScenesWrapper />
    </div>
  )
}
