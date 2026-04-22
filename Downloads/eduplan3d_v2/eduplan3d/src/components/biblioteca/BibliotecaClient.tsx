// src/components/biblioteca/BibliotecaClient.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Upload, FileText, Trash2, BookOpen, Search, Filter, ExternalLink } from 'lucide-react'
import { FilePreview } from '@/components/ui/FilePreview'

interface Documento {
  id: string
  titulo: string
  asignatura: string
  grado: string
  file_size: number
  storage_path: string
  created_at: string
}

interface SubjectOption {
  id: string
  name: string
  course_id: string
  course: { id: string; name: string; parallel: string; level: string } | null
}

export function BibliotecaClient({ subjects, role }: { subjects: SubjectOption[], role?: string }) {
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterSubject, setFilterSubject] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Build unique subject names and grade labels from real data
  const subjectNames = useMemo(() => {
    const names = Array.from(new Set(subjects.map((s: any) => s.name))) as string[]
    return names.sort()
  }, [subjects])

  const gradeLabels = useMemo(() => {
    const labels = Array.from(new Set(
      subjects.map((s: any) => {
        const c = s.course
        return c ? `${c.name} ${c.parallel || ''}`.trim() : ''
      }).filter(Boolean)
    )) as string[]
    return labels.sort()
  }, [subjects])

  const supabase = createClient()

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('documentos')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setDocs(data)
    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const file = form.get('file') as File
    const titulo = form.get('titulo') as string
    const asignatura = form.get('asignatura') as string
    const grado = form.get('grado') as string

    if (!file || !file.name.endsWith('.pdf')) {
      return toast.error('Solo se permiten archivos PDF')
    }
    if (!asignatura) return toast.error('Selecciona una asignatura')
    if (!grado) return toast.error('Selecciona un curso/grado')

    setUploading(true)
    const t = toast.loading('Subiendo documento...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estas autenticado')

      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(fileName, file, { contentType: 'application/pdf' })

      if (uploadError) throw new Error('Error al subir PDF: ' + uploadError.message)

      const { error: dbError } = await (supabase as any).from('documentos').insert({
        user_id: user.id,
        titulo,
        asignatura,
        grado,
        storage_path: fileName,
        file_size: file.size
      })

      if (dbError) throw dbError

      toast.success('Documento guardado', { id: t })
      setShowForm(false)
      loadDocs()
    } catch (err: any) {
      toast.error(err.message, { id: t })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string, path: string) {
    if (!confirm('Seguro que deseas eliminar este documento?')) return
    const t = toast.loading('Eliminando...')
    try {
      await supabase.storage.from('submissions').remove([path])
      await (supabase as any).from('documentos').delete().eq('id', id)
      toast.success('Eliminado', { id: t })
      loadDocs()
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  // Filter docs
  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      if (filterSubject && d.asignatura !== filterSubject) return false
      if (searchTerm && !d.titulo.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [docs, filterSubject, searchTerm])

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar documento..."
              className="input-base pl-9 text-sm"
            />
          </div>
          {/* Filter by subject */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="input-base pl-9 pr-8 text-sm min-w-[140px] appearance-none"
            >
              <option value="">Todas las materias</option>
              {subjectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {role !== 'supervisor' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap"
          >
            {showForm ? (
              <>Cancelar</>
            ) : (
              <><Upload className="w-4 h-4" /> Subir Documento PDF</>
            )}
          </button>
        )}
      </div>

      {/* ── Upload Form ─────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleUpload}
          className="card p-6 mb-8 border-2 border-dashed border-[rgba(124,109,250,0.3)] bg-[rgba(124,109,250,0.03)]"
        >
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-violet2" />
            Nuevo Documento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink3 mb-1.5 uppercase tracking-wide">
                Titulo / Nombre del Libro
              </label>
              <input
                name="titulo"
                required
                className="input-base"
                placeholder="Ej. Libro Ciencias Naturales Vol 1"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink3 mb-1.5 uppercase tracking-wide">
                Asignatura
              </label>
              <select name="asignatura" required className="input-base">
                <option value="">Seleccionar asignatura</option>
                {subjectNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <p className="text-[10px] text-ink3 mt-1">
                Debe coincidir exactamente con la asignatura del Planificador
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink3 mb-1.5 uppercase tracking-wide">
                Curso / Grado
              </label>
              <select name="grado" required className="input-base">
                <option value="">Seleccionar curso</option>
                {gradeLabels.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <p className="text-[10px] text-ink3 mt-1">
                Debe coincidir exactamente con el curso del Planificador
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink3 mb-1.5 uppercase tracking-wide">
                Archivo PDF
              </label>
              <input
                type="file"
                name="file"
                accept=".pdf"
                required
                className="input-base p-1.5 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[rgba(124,109,250,0.15)] file:text-violet2 hover:file:bg-[rgba(124,109,250,0.25)]"
              />
            </div>
          </div>

          <div className="flex justify-end mt-5 pt-4 border-t border-[rgba(0,0,0,0.06)]">
            <button
              disabled={uploading}
              type="submit"
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {uploading ? (
                <><span className="animate-spin">⟳</span> Subiendo...</>
              ) : (
                <><BookOpen className="w-4 h-4" /> Guardar en mi Biblioteca</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Info banner ─────────────────────────────────────────── */}
      {!showForm && docs.length > 0 && (
        <div className="rounded-lg p-3 mb-6 text-xs flex items-start gap-2"
             style={{ background: 'rgba(124,109,250,0.08)', color: 'rgba(124,109,250,0.9)' }}>
          <BookOpen className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Los documentos se inyectan automaticamente en las planificaciones cuando la <b>asignatura</b> y el <b>curso</b> coinciden exactamente con los del Planificador.
          </span>
        </div>
      )}

      {/* ── Documents Grid ──────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet2" />
        </div>
      ) : filteredDocs.length === 0 && docs.length === 0 ? (
        <div className="text-center py-16 border border-[rgba(120,100,255,0.14)] rounded-xl bg-[rgba(0,0,0,0.01)]">
          <FileText className="w-12 h-12 mx-auto mb-3 text-ink3 opacity-40" />
          <p className="text-ink text-lg font-bold mb-2">No tienes documentos</p>
          <p className="text-sm text-ink3 max-w-sm mx-auto">
            Sube el texto guia en formato PDF e selecciona la asignatura y el curso.
            Al generar planificaciones con IA de esa combinacion, la matriz se basara en tu material.
          </p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto mb-2 text-ink3 opacity-40" />
          <p className="text-ink3 text-sm">No se encontraron documentos con esos filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map(d => (
            <div
              key={d.id}
              className="card p-5 relative group overflow-hidden border border-[rgba(120,100,255,0.14)] hover:border-[rgba(124,109,250,0.4)] transition-all hover:shadow-lg"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="bg-[rgba(124,109,250,0.15)] text-violet2 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest">
                  {d.asignatura}
                </span>
                {role !== 'supervisor' && (
                  <button
                    onClick={() => handleDelete(d.id, d.storage_path)}
                    className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 p-1 rounded hover:bg-rose-50"
                    title="Eliminar documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <h3 className="font-bold text-md text-ink mb-1 truncate" title={d.titulo}>
                {d.titulo}
              </h3>

              <span className="text-[11px] text-ink3 bg-[rgba(0,0,0,0.04)] px-2 py-0.5 rounded-full">
                {d.grado}
              </span>

              <div className="mt-4 pt-3 border-t border-[rgba(0,0,0,0.06)] space-y-3">
                <FilePreview url={supabase.storage.from('submissions').getPublicUrl(d.storage_path).data.publicUrl} compact />
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ink3 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {(d.file_size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <span className="text-[11px] text-ink3">
                    {new Date(d.created_at).toLocaleDateString('es-EC')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats footer ────────────────────────────────────────── */}
      {docs.length > 0 && (
        <div className="mt-6 text-center text-xs text-ink3">
          {docs.length} documento{docs.length !== 1 ? 's' : ''} en tu biblioteca
          {filterSubject && ` · Mostrando: ${filterSubject}`}
        </div>
      )}
    </div>
  )
}
