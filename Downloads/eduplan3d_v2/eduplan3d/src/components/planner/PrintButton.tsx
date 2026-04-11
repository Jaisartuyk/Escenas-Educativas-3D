// src/components/planner/PrintButton.tsx
'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
    >
      <Printer size={14} /> Imprimir
    </button>
  )
}
