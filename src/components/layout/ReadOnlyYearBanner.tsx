// src/components/layout/ReadOnlyYearBanner.tsx
'use client'

import { useAcademicYear } from '@/lib/context/AcademicYearContext'

export function ReadOnlyYearBanner() {
  const ctx = useAcademicYear()
  if (!ctx || !ctx.isReadOnly) return null

  const current = ctx.years.find(y => y.id === ctx.currentYearId)

  return (
    <div className="sticky top-14 lg:top-16 z-20 px-4 lg:px-8 py-2 bg-[rgba(251,191,36,0.1)] border-b border-[rgba(251,191,36,0.3)] text-[12px] text-amber flex items-center gap-3 flex-wrap">
      <span className="font-semibold">📅 Modo histórico:</span>
      <span>
        Estás viendo <strong>{ctx.viewingYear?.label}</strong>. No puedes crear ni editar contenido en años pasados.
      </span>
      {current && (
        <button
          onClick={() => ctx.setViewingYearId(ctx.currentYearId)}
          className="ml-auto text-[11px] font-semibold underline hover:no-underline"
        >
          Volver al año actual ({current.label}) →
        </button>
      )}
    </div>
  )
}
