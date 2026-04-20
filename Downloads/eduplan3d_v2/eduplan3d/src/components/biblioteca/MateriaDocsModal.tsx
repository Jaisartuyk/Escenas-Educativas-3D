'use client'
// src/components/biblioteca/MateriaDocsModal.tsx
// Modal para subir/gestionar documentos de referencia de una materia

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { X, Upload, FileText, Trash2, Download, Eye } from 'lucide-react'
import { FilePreview } from '@/components/ui/FilePreview'

export interface PlannerSubject {
  id: string
  materia: string
  curso: string
  paralelo: string | null
  nivel: string | null
}

interface RefDoc {
  id: string
  titulo: string
  storage_path: string
  file_name: string | null
  file_type: string | null
  file_size: number
  created_at: string
}

const ACCEPTED = '.pdf,.doc,.docx'
const MAX_MB = 20

function isPdf(fileType: string | null, fileName: string | null) {
  const ext = (fileName?.split('.').pop() || '').toLowerCase()
  return fileType?.includes('pdf') || ext === 'pdf'
}

function fileIcon(fileType: string | null, fileName: string | null) {
  if (isPdf(fileType, fileName)) return '📕'
  const ext = (fileName?.split('.').pop() || '').toLowerCase()
  if (['doc', 'docx'].includes(ext)) return '📘'
  return '📎'
}

export function MateriaDocsModal({
  subject,
  colorClass,
  onClose,
  onCountChange,
}: {
  subject: PlannerSubject
  colorClass: { bg: string; border: string; text: string; solid: string }
  onClose: () => void
  onCountChange?: (n: number) => void
}) {
  const supabase = createClient()
  const [docs, setDocs] = useState<RefDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDocs() }, [subject.id])

  async function loadDocs() {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('planner_reference_docs')
      .select('*')
      .eq('planner_subject_id', subject.id)
      .order('created_at', { ascending: false })
    const list = data || []
    setDocs(list)
    setLoading(false)
    onCountChange?.(list.length)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return toast.error('Adjunta un archivo')
    if (!titulo.trim()) return toast.error('Pon un título al documento')

    const mb = selectedFile.size / 1024 / 1024
    if (mb > MAX_MB) return toast.error(`El archivo supera ${MAX_MB} MB`)

    setUploading(true)
    const t = toast.loading('Subiendo…')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const safe = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `planner_refs/${user.id}/${subject.id}/${Date.now()}_${safe}`

      const { error: upErr } = await supabase.storage
        .from('submissions')
        .upload(path, selectedFile, { contentType: selectedFile.type })
      if (upErr) throw new Error('Error al subir: ' + upErr.message)

      const { error: dbErr } = await (supabase as any)
        .from('planner_reference_docs')
        .insert({
          user_id:            user.id,
          planner_subject_id: subject.id,
          titulo:             titulo.trim(),
          storage_path:       path,
          file_name:          selectedFile.name,
          file_type:          selectedFile.type,
          file_size:          selectedFile.size,
        })
      if (dbErr) throw dbErr

      toast.success('Documento agregado ✓', { id: t })
      setSelectedFile(null)
      setTitulo('')
      loadDocs()
    } catch (err: any) {
      toast.error(err.message || 'Error', { id: t })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: RefDoc) {
    if (!confirm(`¿Eliminar "${doc.titulo}"?`)) return
    const t = toast.loading('Eliminando…')
    try {
      await supabase.storage.from('submissions').remove([doc.storage_path])
      await (supabase as any).from('planner_reference_docs').delete().eq('id', doc.id)
      toast.success('Eliminado', { id: t })
      if (previewId === doc.id) setPreviewId(null)
      loadDocs()
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setSelectedFile(f)
  }

  function getUrl(path: string) {
    return supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
  }

  const cursoLabel = [subject.curso, subject.paralelo].filter(Boolean).join(' ')

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-auto overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con color de la materia */}
        <div className={`relative px-6 py-5 ${colorClass.bg} border-b ${colorClass.border}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-ink3 hover:text-ink transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl ${colorClass.solid} flex items-center justify-center text-2xl text-white flex-shrink-0 shadow-md`}>
              📚
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <h2 className={`font-display text-xl font-bold tracking-tight ${colorClass.text}`}>
                {subject.materia}
              </h2>
              <p className="text-ink2 text-sm mt-0.5">
                {cursoLabel}{subject.nivel ? ` · ${subject.nivel}` : ''}
              </p>
              <p className="text-ink4 text-xs mt-1">
                Sube libros o PDFs que la IA usará como referencia para crear planificaciones.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Upload form */}
          <form onSubmit={handleUpload} className="space-y-3 mb-6">
            <div>
              <label className="block text-[11px] font-bold text-ink3 uppercase tracking-wider mb-1.5">
                Título del material *
              </label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ej: Libro del Ministerio — 8vo EGB"
                className="input-base"
              />
            </div>

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
              <div className="p-5 text-center">
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
                    <Upload className="w-7 h-7 mx-auto mb-1.5 text-ink3 opacity-50" />
                    <p className="text-sm font-semibold text-ink2">Arrastra el PDF o Word aquí</p>
                    <p className="text-xs text-ink4 mt-1">o haz clic para seleccionar · máx. {MAX_MB} MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile || !titulo.trim()}
              className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${colorClass.solid} hover:opacity-90`}
            >
              {uploading ? 'Subiendo…' : '+ Agregar material'}
            </button>
          </form>

          {/* Documents list */}
          <div>
            <h3 className="text-xs font-bold text-ink3 uppercase tracking-widest mb-3">
              Materiales guardados ({docs.length})
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet2" />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-8 text-ink4 text-sm">
                Aún no hay materiales. Sube el primero arriba ☝
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => {
                  const url = getUrl(doc.storage_path)
                  const pdfFile = isPdf(doc.file_type, doc.file_name)
                  return (
                    <div key={doc.id}>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg hover:bg-surface transition-colors">
                        <span className="text-2xl flex-shrink-0">{fileIcon(doc.file_type, doc.file_name)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{doc.titulo}</p>
                          <p className="text-[11px] text-ink4">
                            {doc.file_name} · {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                            {' · '}
                            {new Date(doc.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </p>
                        </div>
                        {pdfFile && (
                          <button
                            onClick={() => setPreviewId(previewId === doc.id ? null : doc.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              previewId === doc.id
                                ? `${colorClass.solid} text-white`
                                : 'text-ink3 hover:bg-[rgba(0,0,0,0.05)]'
                            }`}
                            title="Ver"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        <a
                          href={url}
                          download={doc.file_name || 'documento'}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg text-ink3 hover:bg-[rgba(0,0,0,0.05)] transition-colors"
                          title="Descargar"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-2 rounded-lg text-rose-400 hover:bg-rose-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {previewId === doc.id && pdfFile && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-[rgba(0,0,0,0.08)]">
                          <FilePreview url={url} compact />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
