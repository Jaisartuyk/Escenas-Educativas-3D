// src/components/planner/PrintButton.tsx
'use client'

import { Printer } from 'lucide-react'

interface PrintButtonProps {
  orientation?: 'portrait' | 'landscape'
}

export function PrintButton({ orientation = 'portrait' }: PrintButtonProps) {
  const handlePrint = () => {
    if (orientation !== 'landscape') {
      window.print()
      return
    }

    const style = document.createElement('style')
    style.setAttribute('data-codex-print-orientation', 'landscape')
    style.textContent = '@page { size: landscape; margin: 12mm; }'
    document.head.appendChild(style)

    const cleanup = () => {
      style.remove()
      window.removeEventListener('afterprint', cleanup)
    }

    window.addEventListener('afterprint', cleanup)
    window.print()

    window.setTimeout(() => {
      cleanup()
    }, 1500)
  }

  return (
    <button
      onClick={handlePrint}
      className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
    >
      <Printer size={14} /> Imprimir
    </button>
  )
}
