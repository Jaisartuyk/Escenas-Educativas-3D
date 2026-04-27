'use client'
// src/components/biblioteca/BibliotecaTabsClient.tsx
// Antes tenía dos tabs: "Mis Planificaciones" | "Textos y Recursos".
// Ahora "Mis Planificaciones" se mueve al nuevo apartado /dashboard/planificaciones,
// así que aquí solo queda la Biblioteca de textos y recursos para la IA.

import { BibliotecaClient } from './BibliotecaClient'

interface SubjectOption {
  id: string
  name: string
  course_id: string
  course: { id: string; name: string; parallel: string; level: string } | null
}

export function BibliotecaTabsClient({
  subjects,
  standalone = false,
  role,
}: {
  subjects: SubjectOption[]
  standalone?: boolean
  role?: string
}) {
  return (
    <div>
      <BibliotecaClient subjects={subjects} role={role} />
    </div>
  )
}
