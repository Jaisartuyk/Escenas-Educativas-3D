import type { Metadata } from 'next'
import { BibliotecaClient } from '@/components/biblioteca/BibliotecaClient'

export const metadata: Metadata = { title: 'Mi Biblioteca' }

export default function BibliotecaPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Mi Biblioteca</h1>
        <p className="text-ink3 text-sm mt-1">
          Sube tus libros y documentos curriculares. La Inteligencia Artificial los leerá e inyectará en tus planificaciones.
        </p>
      </div>
      <BibliotecaClient />
    </div>
  )
}
