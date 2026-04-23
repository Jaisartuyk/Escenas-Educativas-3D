// src/lib/context/AcademicYearContext.tsx
'use client'

import { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react'
import type { AcademicYear } from '@/types/academic-year'
import { VIEWING_YEAR_COOKIE, VIEWING_YEAR_COOKIE_MAX_AGE } from '@/types/academic-year'

interface AcademicYearContextValue {
  years:          AcademicYear[]
  currentYearId:  string | null          // el "oficial" de la institución (is_current = true)
  viewingYearId:  string | null          // el que el usuario está mirando ahora
  viewingYear:    AcademicYear | null
  isReadOnly:     boolean                // true si viewing ≠ current
  setViewingYearId: (id: string | null) => void
  refresh:        () => Promise<void>
}

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null)

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

interface ProviderProps {
  children:             ReactNode
  initialYears:         AcademicYear[]
  initialCurrentId:     string | null
  initialViewingId:     string | null   // viene del cookie leído server-side (o null)
}

export function AcademicYearProvider({
  children,
  initialYears,
  initialCurrentId,
  initialViewingId,
}: ProviderProps) {
  const [years, setYears] = useState<AcademicYear[]>(initialYears)
  const [currentYearId] = useState<string | null>(initialCurrentId)

  // Resolver viewing: si cookie apunta a un año que no existe, caer a current
  const resolvedInitial = useMemo(() => {
    if (initialViewingId && initialYears.some(y => y.id === initialViewingId)) {
      return initialViewingId
    }
    return initialCurrentId
  }, [initialViewingId, initialCurrentId, initialYears])

  const [viewingYearId, setViewingYearIdState] = useState<string | null>(resolvedInitial)

  const setViewingYearId = useCallback((id: string | null) => {
    if (id === currentYearId) {
      // Volver al actual: limpiamos cookie
      clearCookie(VIEWING_YEAR_COOKIE)
    } else if (id) {
      setCookie(VIEWING_YEAR_COOKIE, id, VIEWING_YEAR_COOKIE_MAX_AGE)
    } else {
      clearCookie(VIEWING_YEAR_COOKIE)
    }
    setViewingYearIdState(id)
    // Recargar para que SSR use el nuevo año
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [currentYearId])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/academic-years', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setYears(data.years || [])
    } catch {
      /* noop */
    }
  }, [])

  const viewingYear = useMemo(
    () => years.find(y => y.id === viewingYearId) || null,
    [years, viewingYearId]
  )
  const isReadOnly = !!viewingYearId && viewingYearId !== currentYearId

  // Si el currentYearId cambia desde el servidor y el usuario no había elegido nada,
  // nos aseguramos de quedar en current.
  useEffect(() => {
    if (!viewingYearId && currentYearId) {
      setViewingYearIdState(currentYearId)
    }
  }, [currentYearId, viewingYearId])

  const value: AcademicYearContextValue = {
    years,
    currentYearId,
    viewingYearId,
    viewingYear,
    isReadOnly,
    setViewingYearId,
    refresh,
  }

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  )
}

/**
 * Hook para consumir el contexto. Devuelve null si no hay provider
 * (ej: planner_solo sin institución). Los consumidores deben manejar el caso.
 */
export function useAcademicYear(): AcademicYearContextValue | null {
  return useContext(AcademicYearContext)
}
