'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface CustomScene {
  id: string
  titulo: string
  asignatura: string
  created_at: string
}

export function CustomScenesList() {
  const [scenes, setScenes] = useState<CustomScene[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await (supabase as any).from('escenas_custom').select('*').order('created_at', { ascending: false })
    if (data) setScenes(data)
    setLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-ink3">Sube modelos .GLB para añadirles puntos de información interactiva.</p>
        <Link href="/dashboard/escenas/crear" className="btn-primary px-4 py-2 text-sm">
          + Crear Modelo Interactivo
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-ink3 py-10">Cargando...</p>
      ) : scenes.length === 0 ? (
        <div className="text-center py-16 border border-[rgba(120,100,255,0.14)] rounded-xl bg-[rgba(255,255,255,0.01)]">
          <p className="text-ink font-bold mb-2">No tienes modelos subidos</p>
          <p className="text-sm text-ink3">Descarga un modelo 3D (.glb o .gltf) y añádele etiquetas para tu clase.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenes.map(s => (
            <Link key={s.id} href={`/dashboard/escenas/${s.id}`} className="card p-5 group hover:border-[rgba(124,109,250,0.4)] transition-colors block cursor-pointer">
              <span className="bg-[rgba(124,109,250,0.15)] text-violet2 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest mb-3 inline-block">
                {s.asignatura}
              </span>
              <h3 className="font-bold text-md text-ink mb-1 truncate">{s.titulo}</h3>
              <p className="text-[11px] text-ink3 mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
