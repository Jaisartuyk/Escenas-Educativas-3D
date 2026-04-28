'use client'
// src/components/biblioteca/MisMateriasPlanner.tsx
// Vista principal del docente externo (planner_solo) en /dashboard/biblioteca
// - CRUD de materias + cursos (planner_subjects)
// - Tarjetas de colores, una por materia
// - Click en tarjeta → modal con upload de documentos de referencia

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Trash2, X, FileText, Sparkles } from 'lucide-react'
import { MateriaDocsModal, type PlannerSubject } from './MateriaDocsModal'

// ── Paleta de colores determinista por materia ────────────────────────────────
const PALETTE: Array<{ bg: string; border: string; text: string; solid: string; chip: string }> = [
  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30', text: 'text-violet-700', solid: 'bg-violet-500',  chip: 'bg-violet-500/15 text-violet-700' },
  { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',   text: 'text-teal-700',   solid: 'bg-teal-500',    chip: 'bg-teal-500/15 text-teal-700' },
  { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  text: 'text-amber-700',  solid: 'bg-amber-500',   chip: 'bg-amber-500/15 text-amber-700' },
  { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',   text: 'text-rose-700',   solid: 'bg-rose-500',    chip: 'bg-rose-500/15 text-rose-700' },
  { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   text: 'text-blue-700',   solid: 'bg-blue-500',    chip: 'bg-blue-500/15 text-blue-700' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',text: 'text-emerald-700',solid: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-700' },
  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30', text: 'text-orange-700', solid: 'bg-orange-500',  chip: 'bg-orange-500/15 text-orange-700' },
  { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',   text: 'text-pink-700',   solid: 'bg-pink-500',    chip: 'bg-pink-500/15 text-pink-700' },
  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30', text: 'text-indigo-700', solid: 'bg-indigo-500',  chip: 'bg-indigo-500/15 text-indigo-700' },
  { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',   text: 'text-cyan-700',   solid: 'bg-cyan-500',    chip: 'bg-cyan-500/15 text-cyan-700' },
]

// Hash estable: id uuid → posición de paleta
function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

const NIVEL_OPTIONS = ['Preescolar', 'EGB', 'BGU', 'Bachillerato Técnico', 'Otro']

export function MisMateriasPlanner() {
  const router = useRouter()
  const supabase = createClient()
  const [subjects, setSubjects] = useState<PlannerSubject[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [materia, setMateria] = useState('')
  const [curso, setCurso] = useState('')
  const [paralelo, setParalelo] = useState('')
  const [nivel, setNivel] = useState('EGB')

  // Modal state
  const [openSubject, setOpenSubject] = useState<PlannerSubject | null>(null)

  // Doc counts per subject
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    loadSubjects()
  }, [])

  async function loadSubjects() {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('planner_subjects')
      .select('*')
      .order('created_at', { ascending: false })
    const list = (data || []) as PlannerSubject[]
    setSubjects(list)

    // Conteo de documentos por materia (en paralelo)
    if (list.length > 0) {
      const { data: docs } = await (supabase as any)
        .from('planner_reference_docs')
        .select('planner_subject_id')
      const counts: Record<string, number> = {}
      ;(docs || []).forEach((d: any) => {
        counts[d.planner_subject_id] = (counts[d.planner_subject_id] || 0) + 1
      })
      setDocCounts(counts)
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!materia.trim()) return toast.error('Escribe la materia')
    if (!curso.trim())   return toast.error('Escribe el curso')

    setSaving(true)
    const t = toast.loading('Creando materia…')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { error } = await (supabase as any).from('planner_subjects').insert({
        user_id:  user.id,
        materia:  materia.trim(),
        curso:    curso.trim(),
        paralelo: paralelo.trim() || null,
        nivel:    nivel || null,
      })
      if (error) throw error

      toast.success('Materia creada ✓', { id: t })
      setMateria(''); setCurso(''); setParalelo(''); setNivel('EGB')
      setShowForm(false)
      loadSubjects()
    } catch (err: any) {
      toast.error(err.message || 'Error', { id: t })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: PlannerSubject) {
    if (!confirm(`¿Eliminar "${s.materia} — ${s.curso}"?\n\nTambién se eliminarán todos sus documentos de referencia.`)) return
    const t = toast.loading('Eliminando…')
    try {
      // Obtener paths de storage y borrarlos primero
      const { data: refs } = await (supabase as any)
        .from('planner_reference_docs')
        .select('storage_path')
        .eq('planner_subject_id', s.id)
      const paths = (refs || []).map((r: any) => r.storage_path)
      if (paths.length > 0) {
        await supabase.storage.from('submissions').remove(paths)
      }
      // ON DELETE CASCADE borra los refs en DB automáticamente
      const { error } = await (supabase as any).from('planner_subjects').delete().eq('id', s.id)
      if (error) throw error
      toast.success('Eliminada', { id: t })
      loadSubjects()
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  const totalDocs = useMemo(
    () => Object.values(docCounts).reduce((a, b) => a + b, 0),
    [docCounts]
  )

  return (
    <div className="space-y-6">
      {/* ── Banner Inicio de Año ─────────────────────────────────────── */}
      {subjects.length > 0 && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden animate-fade-in mb-8">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h2 className="font-display text-xl md:text-2xl font-bold mb-2 flex items-center gap-2">
              <Sparkles className="animate-pulse" /> Inicio de Año Lectivo
            </h2>
            <p className="text-white/80 text-sm md:text-base mb-5 leading-relaxed">
              Prepara tu **Semana de Adaptación** y **Pruebas Diagnósticas** automáticamente. 
              La IA generará repasos basados en el año anterior para cada una de tus materias.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard/planificador?mode=adaptacion')}
                className="bg-white text-violet-600 hover:bg-violet-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
              >
                Configurar Semana de Adaptación
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Stats + botón crear ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet2/15 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-violet2" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{subjects.length}</p>
              <p className="text-[10px] text-ink4 uppercase tracking-widest font-semibold">Materias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-teal" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">{totalDocs}</p>
              <p className="text-[10px] text-ink4 uppercase tracking-widest font-semibold">Materiales</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowForm(f => !f)}
          className={`btn-primary px-5 py-2.5 text-sm flex items-center gap-2 ${showForm ? 'bg-surface border border-[rgba(0,0,0,0.1)] text-ink shadow-none' : ''}`}
        >
          {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nueva materia</>}
        </button>
      </div>

      {/* ── Form crear materia ───────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="card p-6 border-2 border-dashed border-[rgba(124,109,250,0.3)] bg-[rgba(124,109,250,0.02)] animate-fade-in"
        >
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet2" />
            Nueva materia
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Materia *
              </label>
              <input
                type="text"
                required
                value={materia}
                onChange={e => setMateria(e.target.value)}
                placeholder="Ej: Matemáticas"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Curso / Grado *
              </label>
              <input
                type="text"
                required
                value={curso}
                onChange={e => setCurso(e.target.value)}
                placeholder="Ej: 8vo"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Paralelo <span className="text-ink4 normal-case font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={paralelo}
                onChange={e => setParalelo(e.target.value)}
                placeholder='Ej: "A"'
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Nivel educativo
              </label>
              <select
                value={nivel}
                onChange={e => setNivel(e.target.value)}
                className="input-base"
              >
                {NIVEL_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-5 pt-4 border-t border-[rgba(0,0,0,0.06)]">
            <button
              type="submit"
              disabled={saving || !materia.trim() || !curso.trim()}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Creando…' : <><Plus className="w-4 h-4" /> Crear materia</>}
            </button>
          </div>
        </form>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet2" />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!loading && subjects.length === 0 && (
        <div className="text-center py-16 border border-[rgba(120,100,255,0.14)] rounded-2xl bg-[rgba(0,0,0,0.01)]">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-ink text-lg font-bold mb-2">Comienza creando tu primera materia</p>
          <p className="text-sm text-ink3 max-w-md mx-auto mb-5">
            Agrega las materias y cursos que dictas. Por cada una podrás subir los libros
            y PDFs que usarás como referencia — la IA los tomará en cuenta al generar tus planificaciones.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Crear primera materia
          </button>
        </div>
      )}

      {/* ── Grid de tarjetas ────────────────────────────────────────── */}
      {!loading && subjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(s => {
            const c = colorFor(s.id)
            const count = docCounts[s.id] || 0
            const cursoLabel = [s.curso, s.paralelo].filter(Boolean).join(' ')
            return (
              <div
                key={s.id}
                onClick={() => setOpenSubject(s)}
                className={`group relative p-5 rounded-2xl border-2 ${c.border} ${c.bg} cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all overflow-hidden`}
              >
                {/* Decorative corner */}
                <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${c.solid} opacity-10`} />

                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(s) }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${c.solid} flex items-center justify-center text-2xl text-white shadow-md mb-3`}>
                  📖
                </div>

                {/* Content */}
                <h3 className={`font-display font-bold text-lg leading-tight ${c.text} mb-1 pr-6`}>
                  {s.materia}
                </h3>
                <p className="text-sm text-ink2 font-medium mb-3">{cursoLabel}</p>

                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap">
                  {s.nivel && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.chip}`}>
                      {s.nivel}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 text-ink3 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {count} material{count !== 1 ? 'es' : ''}
                  </span>
                </div>

                {/* Click hint */}
                <div className={`mt-4 pt-3 border-t ${c.border} text-xs ${c.text} font-semibold flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity`}>
                  Ver materiales →
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de documentos ─────────────────────────────────────── */}
      {openSubject && (
        <MateriaDocsModal
          subject={openSubject}
          colorClass={colorFor(openSubject.id)}
          onClose={() => { setOpenSubject(null); loadSubjects() }}
          onCountChange={(n) => setDocCounts(prev => ({ ...prev, [openSubject.id]: n }))}
        />
      )}
    </div>
  )
}
