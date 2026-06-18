// src/components/planner/HistorialClient.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Planificacion } from '@/types/supabase'

const TYPE_LABELS: Record<string, string> = {
  clase: 'Clase',
  unidad: 'Unidad',
  rubrica: 'Rubrica',
  adaptacion: 'Adaptacion',
  diagnostica: 'Diagnostico',
}

const TYPE_CLASSES: Record<string, string> = {
  clase: 'badge-violet',
  unidad: 'badge-amber',
  rubrica: 'badge-rose',
  adaptacion: 'badge-teal',
  diagnostica: 'badge-teal',
}

const TYPE_ICONS: Record<string, string> = {
  clase: '📋',
  unidad: '📚',
  rubrica: '🎯',
  adaptacion: '🌱',
  diagnostica: '🔍',
}

interface Props { initialData: Planificacion[] }

export function HistorialClient({ initialData }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'clase' | 'unidad' | 'rubrica'>('all')

  const filtered = initialData.filter((p) => {
    const matchSearch = [p.title, p.subject, p.topic, p.grade]
      .some((f) => f?.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === 'all' || p.type === filter
    return matchSearch && matchFilter
  })

  return (
    <>
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por titulo, materia, tema..."
          className="input-base flex-1"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="input-base w-44"
        >
          <option value="all">Todos los tipos</option>
          <option value="clase">Clase</option>
          <option value="unidad">Unidad</option>
          <option value="rubrica">Rubrica</option>
          <option value="adaptacion">Adaptacion</option>
        </select>
      </div>

      {!filtered.length ? (
        <div className="card p-16 text-center text-ink3">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium text-sm mb-1">
            {initialData.length ? 'No hay resultados para tu busqueda' : 'Aun no tienes planificaciones'}
          </p>
          <p className="text-xs">
            {initialData.length
              ? 'Intenta con otros terminos'
              : <Link href="/dashboard/planificador" className="text-violet2 hover:underline">Crea tu primera planificacion →</Link>}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((p) => {
            const isTrimesterBase = ((p as any).metadata?.generationScope === 'trimestre')
              && (((p as any).tipo_documento ?? 'regular') === 'regular')

            return (
              <div key={p.id} className="card-hover p-5">
                <Link href={`/dashboard/historial/${p.id}`} className="block">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{TYPE_ICONS[p.type]}</span>
                      <p className="text-sm font-semibold leading-snug">{p.title}</p>
                    </div>
                    <span className={`${TYPE_CLASSES[p.type]} flex-shrink-0`}>{TYPE_LABELS[p.type] || p.type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink3 mb-3">
                    <span>{p.subject}</span>
                    <span>·</span>
                    <span>{p.grade}</span>
                    <span>·</span>
                    <span>{p.duration}</span>
                  </div>
                  <p className="text-xs text-ink3 line-clamp-2 leading-relaxed">
                    {(typeof p.content === 'string' ? p.content : JSON.stringify(p.content)).slice(0, 120)}...
                  </p>
                  <p className="text-[10px] text-ink3 mt-3">
                    {format(new Date(p.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </Link>

                {isTrimesterBase && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/historial/${p.id}#adaptaciones`}
                      className="px-3 py-2 rounded-lg text-[11px] font-semibold text-white"
                      style={{ backgroundColor: '#7C6DFA' }}
                    >
                      Crear NEE
                    </Link>
                    <Link
                      href={`/dashboard/historial/${p.id}#adaptaciones`}
                      className="px-3 py-2 rounded-lg text-[11px] font-semibold text-white"
                      style={{ backgroundColor: '#0f766e' }}
                    >
                      Crear DIAC
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
