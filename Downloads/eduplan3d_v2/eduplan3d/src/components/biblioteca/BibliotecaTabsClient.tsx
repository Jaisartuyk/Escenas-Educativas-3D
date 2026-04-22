'use client'
// src/components/biblioteca/BibliotecaTabsClient.tsx
// Wrapper con tabs: Biblioteca de Textos | Mis Planificaciones

import { useState } from 'react'
import { BookOpen, FolderOpen } from 'lucide-react'
import { BibliotecaClient } from './BibliotecaClient'
import { PlanificacionesDocsClient } from './PlanificacionesDocsClient'

interface SubjectOption {
  id: string
  name: string
  course_id: string
  course: { id: string; name: string; parallel: string; level: string } | null
}

type TabKey = 'biblioteca' | 'planificaciones'

export function BibliotecaTabsClient({
  subjects,
  standalone = false,
  role,
}: {
  subjects: SubjectOption[]
  standalone?: boolean
  role?: string
}) {
  const [tab, setTab] = useState<TabKey>('planificaciones')

  // Docente externo (planner_solo) → solo ve "Mis Planificaciones", sin tabs
  if (standalone) {
    return (
      <div>
        <PlanificacionesDocsClient subjects={subjects} standalone />
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; icon: any; desc: string }[] = [
    {
      key: 'planificaciones',
      label: 'Mis Planificaciones',
      icon: FolderOpen,
      desc: 'Sube y organiza tus planes anuales, PUDs, planes semanales y diarios',
    },
    {
      key: 'biblioteca',
      label: 'Textos y Recursos',
      icon: BookOpen,
      desc: 'Libros y documentos PDF que la IA usa como referencia en el planificador',
    },
  ]

  return (
    <div>
      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-[rgba(0,0,0,0.06)] mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-violet2 text-white shadow-md shadow-violet/20'
                : 'text-ink3 hover:text-ink hover:bg-[rgba(0,0,0,0.03)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab description ──────────────────────────────────────────── */}
      <p className="text-xs text-ink4 mb-5 -mt-3">
        {tabs.find(t => t.key === tab)?.desc}
      </p>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {tab === 'biblioteca' && <BibliotecaClient subjects={subjects} role={role} />}
      {tab === 'planificaciones' && <PlanificacionesDocsClient subjects={subjects} />}
    </div>
  )
}
