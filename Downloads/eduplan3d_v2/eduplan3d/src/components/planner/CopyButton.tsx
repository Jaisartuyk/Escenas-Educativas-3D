// src/components/planner/CopyButton.tsx
'use client'

import toast from 'react-hot-toast'

export function CopyButton({ text }: { text: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <button onClick={handleCopy} className="btn-secondary text-xs px-3 py-1.5">
      Copiar
    </button>
  )
}
