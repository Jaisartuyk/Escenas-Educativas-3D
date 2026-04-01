// src/components/planner/DeletePlanButton.tsx
'use client'

import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export function DeletePlanButton({ id }: { id: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('¿Seguro que deseas eliminar esta planificación?')) return
    const res = await fetch(`/api/planificaciones/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Planificación eliminada')
      router.push('/dashboard/historial')
      router.refresh()
    } else {
      toast.error('Error al eliminar')
    }
  }

  return (
    <button onClick={handleDelete} className="btn-secondary text-sm px-4 py-2 text-rose border-rose/30 hover:bg-rose/10">
      Eliminar
    </button>
  )
}
