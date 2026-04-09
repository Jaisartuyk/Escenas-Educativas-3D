'use client'
// src/components/horarios/steps/StepDocentes.tsx

import { useState } from 'react'
import type { Docente } from '@/types/horarios'
import { TODAS_MATERIAS } from '@/types/horarios'

interface Props {
  docentes: Docente[]
  jornadaInstitucional: string
  nivelInstitucional?: string
  directoryMetadata: any
  onChange: (d: Docente[]) => void
  onBack: () => void
  onNext: () => void
}

const TITULOS = ['Lcdo.','Lcda.','Ing.','Prof.','Msc.','Dr.','Dra.']

export function StepDocentes({ docentes, jornadaInstitucional, nivelInstitucional, directoryMetadata, onChange, onBack, onNext }: Props) {
  const [showForm,  setShowForm]  = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nombre,    setNombre]    = useState('')
  const [titulo,    setTitulo]    = useState('Lcdo.')
  const [jornada,   setJornada]   = useState<'MATUTINA'|'VESPERTINA'|'AMBAS'>('AMBAS')
  const [nivel,     setNivel]     = useState<'Escuela'|'Colegio'|'AMBOS'>('AMBOS')
  const [mats,      setMats]      = useState<string[]>([])

  function toggleMat(m: string) {
    setMats(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function save() {
    if (!nombre.trim()) return
    if (editingId) {
      onChange(docentes.map(d => d.id === editingId ? { ...d, titulo, nombre: nombre.trim(), materias: mats, jornada, nivel } : d))
    } else {
      onChange([...docentes, { id: Date.now().toString(), titulo, nombre: nombre.trim(), materias: mats, jornada, nivel }])
    }
    cancel()
  }

  function cancel() {
    setNombre(''); setTitulo('Lcdo.'); setJornada('AMBAS'); setNivel('AMBOS'); setMats([]); setShowForm(false); setEditingId(null)
  }

  function edit(d: Docente) {
    setEditingId(d.id)
    setNombre(d.nombre)
    setTitulo(d.titulo)
    setMats(d.materias)
    setJornada(d.jornada || 'AMBAS')
    setNivel(d.nivel || 'AMBOS')
    setShowForm(true)
  }

  function remove(id: string) { onChange(docentes.filter(d => d.id !== id)) }

  function initials(nombre: string) {
    return nombre.split(/[\s,]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  const docentesFiltrados = docentes.filter(d => 
    (!d.jornada || d.jornada === 'AMBAS' || d.jornada === jornadaInstitucional) &&
    (!d.nivel || d.nivel === 'AMBOS' || d.nivel === nivelInstitucional)
  )

  return (
    <div>
      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold tracking-tight">Docentes registrados</h2>
          <button onClick={() => showForm ? cancel() : setShowForm(true)} className="btn-secondary text-sm px-4 py-2">
            {showForm ? 'Cancelar' : '+ Agregar docente'}
          </button>
        </div>

        {/* Formulario agregar */}
        {showForm && (
          <div className="mb-5 p-4 border border-[rgba(120,100,255,0.2)] rounded-xl bg-[rgba(124,109,250,0.04)]">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nombre (Apellido, Nombre)</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Giler Tapia, Oswaldo" className="input-base" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Título</label>
                  <select value={titulo} onChange={e => setTitulo(e.target.value)} className="input-base">
                    {TITULOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Nivel</label>
                  <select value={nivel} onChange={e => setNivel(e.target.value as any)} className="input-base">
                    <option value="AMBOS">Ambos</option>
                    <option value="Escuela">Escuela</option>
                    <option value="Colegio">Colegio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-1.5">Jornada</label>
                  <select value={jornada} onChange={e => setJornada(e.target.value as any)} className="input-base">
                    <option value="AMBAS">Ambas</option>
                    <option value="MATUTINA">Matutina</option>
                    <option value="VESPERTINA">Vespertina</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[11px] font-bold uppercase tracking-[.5px] text-ink3 mb-2">Materias que imparte</label>
              <div className="flex flex-wrap gap-1.5 p-3 border border-[rgba(120,100,255,0.14)] rounded-xl">
                {TODAS_MATERIAS.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleMat(m)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      mats.includes(m)
                        ? 'bg-[rgba(124,109,250,0.15)] border-[rgba(124,109,250,0.4)] text-violet2'
                        : 'border-[rgba(120,100,255,0.14)] text-ink3 hover:text-ink2'
                    }`}
                  >{m}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="btn-primary text-sm px-5 py-2">
                {editingId ? 'Actualizar docente' : 'Guardar docente'}
              </button>
              <button onClick={cancel} className="btn-secondary text-sm px-4 py-2">Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista docentes */}
        {!docentesFiltrados.length ? (
          <p className="text-center text-ink3 text-sm py-8">No hay docentes registrados para la jornada {jornadaInstitucional.toLowerCase()}.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {docentesFiltrados.map(d => {
              const meta = directoryMetadata[d.id] || {}
              return (
              <div key={d.id} className="flex items-center gap-3 p-3 border border-[rgba(120,100,255,0.14)] rounded-xl">
                {meta.avatar_url ? (
                  <img src={meta.avatar_url} className="w-9 h-9 rounded-full object-cover border border-violet2 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[rgba(124,109,250,0.15)] text-violet2 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {initials(d.nombre)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{d.titulo} {d.nombre}</p>
                    <span className="px-1.5 py-0.5 rounded uppercase text-[9px] font-bold bg-[rgba(124,109,250,0.1)] text-violet2">{d.jornada || 'AMBAS'}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[rgba(38,215,180,0.1)] text-teal">{d.nivel || 'AMBOS'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {d.materias.map(m => (
                      <span key={m} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(0,0,0,0.05)] border border-[rgba(120,100,255,0.14)] text-ink3">
                        {m}
                      </span>
                    ))}
                    {!d.materias.length && <span className="text-[11px] text-ink3">Sin materias asignadas</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => edit(d)} className="text-[11px] text-violet2 hover:text-violet px-2 border-r border-[rgba(120,100,255,0.14)] font-medium transition-colors">Editar</button>
                  <button onClick={() => remove(d.id)} className="text-[11px] text-rose hover:text-red-400 px-2 font-medium transition-colors">Eliminar</button>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary px-6 py-2.5">← Atrás</button>
        <button onClick={onNext} className="btn-primary px-8 py-2.5">Continuar →</button>
      </div>
    </div>
  )
}
