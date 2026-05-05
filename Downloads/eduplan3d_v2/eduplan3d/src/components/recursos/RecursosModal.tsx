// src/components/recursos/RecursosModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Youtube, BookOpen, Lightbulb, ExternalLink, RefreshCw } from 'lucide-react'

interface ResourceData {
  youtube: Array<{ title: string; search_query: string; description: string }>
  academic: Array<{ title: string; source: string; link_suggestion: string }>
  interactive: { title: string; platform: string; description: string }
  pedagogical_tip: string
}

export function RecursosModal({ 
  subject, 
  onClose 
}: { 
  subject: { materia: string; curso: string; recentTopics: string | null }
  onClose: () => void 
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ResourceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recursos-didacticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.materia,
          grade: subject.curso,
          topics: subject.recentTopics
        })
      })
      if (!res.ok) throw new Error('Error al obtener recursos')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [subject])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-surface2 flex items-center justify-between bg-gradient-to-r from-violet/5 to-transparent">
          <div>
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <span className="text-2xl">🎓</span> Recursos: {subject.materia}
            </h2>
            <p className="text-sm text-ink3">{subject.curso}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-ink3 hover:text-ink"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 border-4 border-violet/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-violet border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-ink">Curando recursos educativos...</p>
                <p className="text-xs text-ink3">Analizando tus planificaciones para encontrar lo mejor</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-rose-500 font-medium">Hubo un problema: {error}</p>
              <button 
                onClick={fetchResources}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-violet text-white rounded-xl text-sm font-bold"
              >
                <RefreshCw size={16} /> Reintentar
              </button>
            </div>
          ) : data ? (
            <>
              {/* YouTube Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Youtube className="text-rose-500" size={20} /> Videos de YouTube
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.youtube.map((v, i) => (
                    <div key={i} className="bg-surface2/50 border border-surface2 rounded-2xl p-4 flex flex-col hover:border-violet/20 transition-colors">
                      <p className="font-bold text-sm text-ink mb-1 line-clamp-2">{v.title}</p>
                      <p className="text-[10px] text-ink3 mb-3">{v.description}</p>
                      <a 
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.search_query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto flex items-center justify-center gap-2 py-2 bg-white border border-surface2 rounded-xl text-[10px] font-bold text-ink hover:bg-violet hover:text-white hover:border-violet transition-all"
                      >
                        <Youtube size={12} /> Buscar Video
                      </a>
                    </div>
                  ))}
                </div>
              </section>

              {/* Academic Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <BookOpen className="text-violet2" size={20} /> Repositorios y Artículos
                </h3>
                <div className="space-y-3">
                  {data.academic.map((a, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface border border-surface2 rounded-2xl p-4 group hover:border-violet/20 transition-colors">
                      <div className="flex gap-3 items-center">
                        <div className="h-10 w-10 rounded-full bg-violet/5 flex items-center justify-center text-violet2 shrink-0">
                          <BookOpen size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-ink">{a.title}</p>
                          <p className="text-xs text-ink3 font-medium uppercase tracking-tight">{a.source}</p>
                        </div>
                      </div>
                      <a 
                        href={`https://www.google.com/search?q=${encodeURIComponent(a.title + ' ' + a.source)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-surface2 rounded-xl text-ink3 hover:bg-violet hover:text-white transition-all"
                        title="Buscar recurso"
                      >
                        <ExternalLink size={18} />
                      </a>
                    </div>
                  ))}
                </div>
              </section>

              {/* Interactive & Tip Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <RefreshCw className="text-teal" size={20} /> Recurso Interactivo
                  </h3>
                  <div className="bg-teal/5 border border-teal/10 rounded-2xl p-6">
                    <p className="text-xs font-bold text-teal uppercase mb-2">{data.interactive.platform}</p>
                    <p className="font-bold text-ink mb-2">{data.interactive.title}</p>
                    <p className="text-xs text-ink3 leading-relaxed">{data.interactive.description}</p>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Lightbulb className="text-amber" size={20} /> Tip Pedagógico
                  </h3>
                  <div className="bg-amber/5 border border-amber/10 rounded-2xl p-6 italic text-sm text-ink3 leading-relaxed">
                    "{data.pedagogical_tip}"
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface2 text-center">
          <p className="text-[10px] text-ink4 uppercase tracking-widest font-bold">
            EduPlan3D AI • Recursos dinámicos sugeridos por Claude 3.5 Sonnet
          </p>
        </div>
      </div>
    </div>
  )
}
