'use client'
// src/components/biblioteca/PlanificacionesDocsClient.tsx
// Sección para que los docentes suban sus planificaciones manuales
// Completamente independiente del planificador IA (servicio de pago)

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Upload, FileText, Trash2, Search, Filter,
  ChevronDown, FolderOpen, Calendar, BookOpen,
  X, Plus, Download, Eye
} from 'lucide-react'
import { FilePreview } from '@/components/ui/FilePreview'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SubjectOption {
  id: string
  name: string
  course_id: string
  course: { id: string; name: string; parallel: string; level: string } | null
}

interface PlanDoc {
  id: string
  titulo: string
  tipo: string
  trimestre: number | null
  semana: number | null
  asignatura: string
  curso: string
  storage_path: string
  file_size: number
  file_name: string | null
  file_type: string | null
  created_at: string
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  anual:       { label: 'Anual',       color: 'text-teal-600',   bg: 'bg-teal-500/10 border-teal-500/20',    icon: '📅' },
  trimestral:  { label: 'Trimestral',  color: 'text-blue-600',   bg: 'bg-blue-500/10 border-blue-500/20',    icon: '📆' },
  unidad:      { label: 'Unidad',      color: 'text-violet-600', bg: 'bg-violet-500/10 border-violet-500/20',icon: '📖' },
  semanal:     { label: 'Semanal',     color: 'text-amber-600',  bg: 'bg-amber-500/10 border-amber-500/20',  icon: '🗓️' },
  diaria:      { label: 'Diaria',      color: 'text-rose-600',   bg: 'bg-rose-500/10 border-rose-500/20',    icon: '📝' },
}

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
const MAX_MB = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileIcon(fileType: string | null, fileName: string | null): string {
  const ext = (fileName?.split('.').pop() || '').toLowerCase()
  if (fileType?.includes('pdf') || ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['ppt', 'pptx'].includes(ext)) return '📊'
  return '📎'
}

function isPdf(fileType: string | null, fileName: string | null) {
  const ext = (fileName?.split('.').pop() || '').toLowerCase()
  return fileType?.includes('pdf') || ext === 'pdf'
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PlanificacionesDocsClient({ subjects }: { subjects: SubjectOption[] }) {
  const supabase = createClient()

  const [docs, setDocs] = useState<PlanDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Filters
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [filterAsignatura, setFilterAsignatura] = useState('')
  const [filterTrimestre, setFilterTrimestre] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [formTipo, setFormTipo] = useState('diaria')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview
  const [previewDoc, setPreviewDoc] = useState<PlanDoc | null>(null)

  // Derived subject options
  const subjectNames = useMemo(() =>
    Array.from(new Set(subjects.map(s => s.name))).sort() as string[],
    [subjects]
  )

  const selectedSubjectInfo = useMemo(() =>
    subjects.find(s => s.id === formSubjectId),
    [subjects, formSubjectId]
  )

  useEffect(() => { loadDocs() }, [])

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadDocs() {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('planificacion_docs')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setDocs(data)
    setLoading(false)
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    const titulo = (form.get('titulo') as string).trim()
    const tipo   = form.get('tipo') as string
    const trimestre = form.get('trimestre') ? Number(form.get('trimestre')) : null
    const semana    = form.get('semana')    ? Number(form.get('semana'))    : null

    if (!selectedSubjectInfo) return toast.error('Selecciona una materia')
    if (!selectedFile)        return toast.error('Adjunta un archivo')

    const fileMB = selectedFile.size / 1024 / 1024
    if (fileMB > MAX_MB) return toast.error(`El archivo supera los ${MAX_MB} MB permitidos`)

    const asignatura = selectedSubjectInfo.name
    const curso = selectedSubjectInfo.course
      ? `${selectedSubjectInfo.course.name} ${selectedSubjectInfo.course.parallel || ''}`.trim()
      : ''

    setUploading(true)
    const t = toast.loading('Subiendo planificación...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estás autenticado')

      const ext   = selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf'
      const safe  = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path  = `planificacion_docs/${user.id}/${Date.now()}_${safe}`

      const { error: uploadError } = await supabase.storage
        .from('biblioteca')
        .upload(path, selectedFile, { contentType: selectedFile.type })

      if (uploadError) throw new Error('Error al subir: ' + uploadError.message)

      const { error: dbErr } = await (supabase as any).from('planificacion_docs').insert({
        user_id:      user.id,
        subject_id:   selectedSubjectInfo.id,
        titulo,
        tipo,
        trimestre,
        semana,
        asignatura,
        curso,
        storage_path: path,
        file_size:    selectedFile.size,
        file_name:    selectedFile.name,
        file_type:    selectedFile.type,
      })

      if (dbErr) throw dbErr

      toast.success('Planificación guardada ✓', { id: t })
      setShowForm(false)
      setSelectedFile(null)
      setFormSubjectId('')
      setFormTipo('diaria')
      loadDocs()
    } catch (err: any) {
      toast.error(err.message || 'Error desconocido', { id: t })
    } finally {
      setUploading(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(doc: PlanDoc) {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return
    const t = toast.loading('Eliminando...')
    try {
      await supabase.storage.from('biblioteca').remove([doc.storage_path])
      await (supabase as any).from('planificacion_docs').delete().eq('id', doc.id)
      toast.success('Eliminado', { id: t })
      if (previewDoc?.id === doc.id) setPreviewDoc(null)
      loadDocs()
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (filterTipo !== 'todos' && d.tipo !== filterTipo) return false
      if (filterAsignatura && d.asignatura !== filterAsignatura) return false
      if (filterTrimestre && String(d.trimestre) !== filterTrimestre) return false
      if (searchTerm && !d.titulo.toLowerCase().includes(searchTerm.toLowerCase())
          && !d.asignatura.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [docs, filterTipo, filterAsignatura, filterTrimestre, searchTerm])

  // ── Group by tipo for organized display ──────────────────────────────────
  const grouped = useMemo(() => {
    const order = ['anual', 'trimestral', 'unidad', 'semanal', 'diaria']
    const map: Record<string, PlanDoc[]> = {}
    filtered.forEach(d => {
      if (!map[d.tipo]) map[d.tipo] = []
      map[d.tipo].push(d)
    })
    return order.filter(t => map[t]?.length > 0).map(t => ({ tipo: t, items: map[t] }))
  }, [filtered])

  // ── Get public URL ────────────────────────────────────────────────────────
  function getUrl(path: string) {
    return supabase.storage.from('biblioteca').getPublicUrl(path).data.publicUrl
  }

  return (
    <div className="space-y-6">
      {/* ── Header bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar planificación..."
              className="input-base pl-9 text-sm"
            />
          </div>

          {/* Subject filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink3" />
            <select
              value={filterAsignatura}
              onChange={e => setFilterAsignatura(e.target.value)}
              className="input-base pl-8 pr-7 text-sm min-w-[140px] appearance-none"
            >
              <option value="">Todas las materias</option>
              {subjectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Trimestre filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink3" />
            <select
              value={filterTrimestre}
              onChange={e => setFilterTrimestre(e.target.value)}
              className="input-base pl-8 pr-7 text-sm appearance-none"
            >
              <option value="">Todos los trimestres</option>
              <option value="1">Trimestre 1</option>
              <option value="2">Trimestre 2</option>
              <option value="3">Trimestre 3</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => { setShowForm(f => !f); setSelectedFile(null) }}
          className={`btn-primary px-5 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${showForm ? 'bg-surface border border-[rgba(0,0,0,0.1)] text-ink shadow-none' : ''}`}
        >
          {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Subir Planificación</>}
        </button>
      </div>

      {/* ── Type filter pills ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterTipo('todos')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
            filterTipo === 'todos'
              ? 'bg-ink text-white border-ink'
              : 'bg-bg text-ink3 border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.2)]'
          }`}
        >
          Todos ({docs.length})
        </button>
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => {
          const count = docs.filter(d => d.tipo === key).length
          if (count === 0 && filterTipo !== key) return null
          return (
            <button
              key={key}
              onClick={() => setFilterTipo(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                filterTipo === key
                  ? `${cfg.bg} ${cfg.color} border-current`
                  : 'bg-bg text-ink3 border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.2)]'
              }`}
            >
              {cfg.icon} {cfg.label} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* ── Upload Form ────────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleUpload}
          className="card p-6 border-2 border-dashed border-[rgba(124,109,250,0.3)] bg-[rgba(124,109,250,0.02)] animate-fade-in"
        >
          <h3 className="font-bold text-base mb-5 flex items-center gap-2">
            <Upload className="w-5 h-5 text-violet2" />
            Nueva Planificación
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Título */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Título de la planificación *
              </label>
              <input
                name="titulo"
                required
                className="input-base"
                placeholder="Ej: Plan Anual de Matemáticas — 8vo EGB"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Tipo de planificación *
              </label>
              <select
                name="tipo"
                required
                value={formTipo}
                onChange={e => setFormTipo(e.target.value)}
                className="input-base"
              >
                <option value="anual">📅 Plan Curricular Anual (PCA)</option>
                <option value="trimestral">📆 Plan Curricular Trimestral</option>
                <option value="unidad">📖 Plan de Unidad Didáctica (PUD)</option>
                <option value="semanal">🗓️ Plan Semanal</option>
                <option value="diaria">📝 Plan Diario / de Clase</option>
              </select>
            </div>

            {/* Materia */}
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Materia y Curso *
              </label>
              <select
                name="subject_id"
                required
                value={formSubjectId}
                onChange={e => setFormSubjectId(e.target.value)}
                className="input-base"
              >
                <option value="">— Seleccionar materia —</option>
                {subjects.map(s => {
                  const courseLabel = s.course
                    ? `${s.course.name} ${s.course.parallel || ''}`.trim()
                    : ''
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}{courseLabel ? ` — ${courseLabel}` : ''}
                    </option>
                  )
                })}
              </select>
              {selectedSubjectInfo?.course && (
                <p className="text-[10px] text-teal mt-1 flex items-center gap-1">
                  ✓ {selectedSubjectInfo.course.name} {selectedSubjectInfo.course.parallel || ''}
                </p>
              )}
            </div>

            {/* Trimestre — solo si aplica */}
            {['trimestral', 'unidad', 'semanal', 'diaria'].includes(formTipo) && (
              <div>
                <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                  Trimestre
                </label>
                <select name="trimestre" className="input-base">
                  <option value="">— Sin especificar —</option>
                  <option value="1">Trimestre 1</option>
                  <option value="2">Trimestre 2</option>
                  <option value="3">Trimestre 3</option>
                </select>
              </div>
            )}

            {/* Semana — solo si aplica */}
            {['semanal', 'diaria'].includes(formTipo) && (
              <div>
                <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                  Semana
                </label>
                <select name="semana" className="input-base">
                  <option value="">— Sin especificar —</option>
                  {Array.from({ length: 18 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Semana {i + 1}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* File drop zone */}
          <div>
            <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
              Archivo (PDF, Word, Excel, PowerPoint — máx. {MAX_MB} MB) *
            </label>
            <div
              className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver
                  ? 'border-violet2 bg-[rgba(124,109,250,0.08)]'
                  : selectedFile
                  ? 'border-teal/40 bg-teal/5'
                  : 'border-[rgba(0,0,0,0.12)] hover:border-violet2/40 hover:bg-[rgba(124,109,250,0.03)]'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="p-6 text-center">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">{fileIcon(selectedFile.type, selectedFile.name)}</span>
                    <div className="text-left">
                      <p className="text-sm font-bold text-ink truncate max-w-[260px]">{selectedFile.name}</p>
                      <p className="text-xs text-ink3">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={ev => { ev.stopPropagation(); setSelectedFile(null) }}
                      className="ml-2 p-1 rounded-full hover:bg-rose-100 text-rose-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-ink3 opacity-50" />
                    <p className="text-sm font-semibold text-ink2">Arrastra tu archivo aquí</p>
                    <p className="text-xs text-ink4 mt-1">o haz clic para seleccionar</p>
                    <p className="text-[10px] text-ink4 mt-2">PDF · DOCX · XLSX · PPTX</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="flex justify-end mt-5 pt-4 border-t border-[rgba(0,0,0,0.06)]">
            <button
              type="submit"
              disabled={uploading || !selectedFile || !formSubjectId}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Subiendo...</>
              ) : (
                <><FolderOpen className="w-4 h-4" /> Guardar Planificación</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Empty State ─────────────────────────────────────────────── */}
      {!loading && docs.length === 0 && (
        <div className="text-center py-20 border border-[rgba(120,100,255,0.14)] rounded-2xl bg-[rgba(0,0,0,0.01)]">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-ink text-lg font-bold mb-2">Sin planificaciones aún</p>
          <p className="text-sm text-ink3 max-w-sm mx-auto">
            Sube tus Planes Anuales, PUDs, planes semanales y clases diarias.
            Quedan organizados por materia, curso y trimestre.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary mt-5 px-6 py-2.5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Subir primera planificación
          </button>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet2" />
        </div>
      )}

      {/* ── No results ─────────────────────────────────────────────── */}
      {!loading && docs.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto mb-2 text-ink3 opacity-30" />
          <p className="text-ink3 text-sm">No se encontraron planificaciones con esos filtros</p>
        </div>
      )}

      {/* ── Documents grouped by tipo ──────────────────────────────── */}
      {!loading && grouped.map(({ tipo, items }) => {
        const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.diaria
        return (
          <div key={tipo}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${cfg.bg} ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="text-xs text-ink4">{items.length} planificación{items.length !== 1 ? 'es' : ''}</span>
              <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {items.map(doc => {
                const url = getUrl(doc.storage_path)
                const isPdfFile = isPdf(doc.file_type, doc.file_name)
                const docCfg = TIPO_CONFIG[doc.tipo] || TIPO_CONFIG.diaria

                return (
                  <div
                    key={doc.id}
                    className="card p-4 group relative overflow-hidden border border-[rgba(120,100,255,0.12)] hover:border-[rgba(124,109,250,0.35)] transition-all hover:shadow-lg"
                  >
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(doc)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Top badges */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap pr-6">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${docCfg.bg} ${docCfg.color}`}>
                        {docCfg.icon} {docCfg.label}
                      </span>
                      {doc.trimestre && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-ink/5 text-ink3">
                          T{doc.trimestre}{doc.semana ? ` · S${doc.semana}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-sm text-ink mb-2 line-clamp-2 leading-snug" title={doc.titulo}>
                      {doc.titulo}
                    </h3>

                    {/* Subject + Course */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[rgba(124,109,250,0.1)] text-violet2">
                        {doc.asignatura}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.05)] text-ink3">
                        {doc.curso}
                      </span>
                    </div>

                    {/* File info */}
                    <div className="flex items-center justify-between text-[10px] text-ink4 mb-3">
                      <span className="flex items-center gap-1">
                        {fileIcon(doc.file_type, doc.file_name)}
                        {doc.file_name ? doc.file_name.split('.').pop()?.toUpperCase() : 'DOC'}
                        {doc.file_size > 0 && ` · ${(doc.file_size / 1024 / 1024).toFixed(1)} MB`}
                      </span>
                      <span>{new Date(doc.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-[rgba(0,0,0,0.05)]">
                      {isPdfFile ? (
                        <button
                          onClick={() => setPreviewDoc(previewDoc?.id === doc.id ? null : doc)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors border ${
                            previewDoc?.id === doc.id
                              ? 'bg-violet2 text-white border-violet2'
                              : 'bg-[rgba(124,109,250,0.08)] text-violet2 border-violet2/20 hover:bg-[rgba(124,109,250,0.15)]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {previewDoc?.id === doc.id ? 'Cerrar' : 'Ver'}
                        </button>
                      ) : (
                        <span className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-ink4 bg-bg border border-[rgba(0,0,0,0.06)]">
                          {fileIcon(doc.file_type, doc.file_name)}
                          {doc.file_name?.split('.').pop()?.toUpperCase()}
                        </span>
                      )}
                      <a
                        href={url}
                        download={doc.file_name || 'planificacion'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-bg border border-[rgba(0,0,0,0.08)] text-ink3 hover:text-ink hover:border-[rgba(0,0,0,0.2)] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                      </a>
                    </div>

                    {/* Inline PDF preview */}
                    {previewDoc?.id === doc.id && isPdfFile && (
                      <div className="mt-3 rounded-xl overflow-hidden border border-violet2/20">
                        <FilePreview url={url} compact />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* ── Stats footer ────────────────────────────────────────────── */}
      {docs.length > 0 && (
        <div className="text-center text-xs text-ink4 pt-2">
          {docs.length} planificación{docs.length !== 1 ? 'es' : ''} guardadas
          {(filterTipo !== 'todos' || filterAsignatura || filterTrimestre || searchTerm) &&
            ` · Mostrando ${filtered.length}`
          }
        </div>
      )}
    </div>
  )
}
