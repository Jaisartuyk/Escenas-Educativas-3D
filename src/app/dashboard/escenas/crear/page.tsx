import type { Metadata } from 'next'
import { SceneEditorClient } from '@/components/scenes/SceneEditorClient'

export const metadata: Metadata = { title: 'Crear Escena 3D' }

export default function CrearEscenaPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Crear Modelo Interactivo</h1>
        <p className="text-ink3 text-sm mt-1">Sube un archivo .GLB y haz doble clic sobre el modelo para agregarle puntos didácticos.</p>
      </div>
      <SceneEditorClient />
    </div>
  )
}
