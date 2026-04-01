'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Documento {
  id: string
  titulo: string
  asignatura: string
  grado: string
  file_size: number
  storage_path: string
  created_at: string
}

export function BibliotecaClient() {
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const supabase = createClient()

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
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

    setUploading(true)
    const t = toast.loading('Subiendo documento...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No estás autenticado')

      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      
      const { error: uploadError } = await supabase.storage
        .from('biblioteca')
        .upload(fileName, file, { contentType: 'application/pdf' })
      
      if (uploadError) throw new Error('Error al subir PDF: (Asegúrate de haber creado el bucket "biblioteca" y sus políticas). ' + uploadError.message)

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
    if (!confirm('¿Seguro que deseas eliminar este documento?')) return
    const t = toast.loading('Eliminando...')
    try {
      await supabase.storage.from('biblioteca').remove([path])
      await (supabase as any).from('documentos').delete().eq('id', id)
      toast.success('Eliminado', { id: t })
      loadDocs()
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Mis Documentos</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 py-2 text-sm">
          {showForm ? 'Seleccionar luego' : '+ Subir Documento PDF'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="card p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase tracking-wide">Título / Nombre del Libro</label>
            <input name="titulo" required className="input-base" placeholder="Ej. Libro Ciencias Naturales Vol 1" />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase tracking-wide">Asignatura (Idéntica al Planificador)</label>
            <input name="asignatura" required className="input-base" placeholder="Ej. CC.NN" />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase tracking-wide">Grado / Curso</label>
            <input name="grado" required className="input-base" placeholder="Ej. 8VO" />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink3 mb-1 uppercase tracking-wide">Archivo DUA/Guía (PDF)</label>
            <input type="file" name="file" accept=".pdf" required className="input-base p-1.5" />
          </div>
          <div className="md:col-span-2 flex justify-end mt-4">
            <button disabled={uploading} type="submit" className="btn-primary px-6 py-2">
              {uploading ? 'Subiendo...' : 'Guardar en mi Biblioteca'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-ink3 text-center py-10">Cargando...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 border border-[rgba(120,100,255,0.14)] rounded-xl bg-[rgba(255,255,255,0.01)]">
          <p className="text-ink text-lg font-bold mb-2">No tienes documentos formativos</p>
          <p className="text-sm text-ink3 max-w-sm mx-auto">
            Sube el texto guía en formato PDF e ingresa la asignatura y el curso. Al generar planificaciones con IA de esa combinación exactas, la matriz se basará enteramente en ello.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docs.map(d => (
            <div key={d.id} className="card p-5 relative group overflow-hidden border border-[rgba(120,100,255,0.14)] hover:border-[rgba(124,109,250,0.4)] transition-all">
              <div className="flex justify-between items-start mb-3">
                <span className="bg-[rgba(124,109,250,0.15)] focus:outline-none text-violet2 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest">
                  {d.asignatura} • {d.grado}
                </span>
                <button 
                  onClick={() => handleDelete(d.id, d.storage_path)} 
                  className="text-rose text-xs opacity-0 group-hover:opacity-100 transition-opacity font-semibold cursor-pointer z-10 hover:text-red-400"
                >
                  Eliminar
                </button>
              </div>
              <h3 className="font-bold text-md text-ink mb-1 truncate" title={d.titulo}>{d.titulo}</h3>
              <p className="text-[11px] text-ink3 flex items-center justify-between mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
                <span>{(d.file_size / 1024 / 1024).toFixed(2)} MB</span>
                <span>{new Date(d.created_at).toLocaleDateString()}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
