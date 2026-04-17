'use client'
// src/components/biblioteca/AdminPlanificacionesClient.tsx
// Vista admin: planificaciones de todos los docentes, agrupadas por docente con colores

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, Filter, Download, Eye, BookOpen, 
  Calendar, ChevronRight, ArrowLeft, User, 
  FileText, ExternalLink, MoreVertical, LayoutGrid
} from 'lucide-react'
import { FilePreview } from '@/components/ui/FilePreview'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlanDoc {
  id: string
  user_id: string
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

interface Teacher {
  id: string
  full_name: string
  email: string
}

interface Props {
  planificaciones: PlanDoc[]
  teachers: Teacher[]
}

// ─── Color palette per teacher ────────────────────────────────────────────────
const PALETTE = [
  { header: 'bg-violet-500',  light: 'bg-violet-50 border-violet-100',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700',  ring: 'ring-violet-500/20'  },
  { header: 'bg-teal-500',    light: 'bg-teal-50 border-teal-100',      text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700',      ring: 'ring-teal-500/20'    },
  { header: 'bg-blue-500',    light: 'bg-blue-50 border-blue-100',      text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',      ring: 'ring-blue-500/20'    },
  { header: 'bg-amber-500',   light: 'bg-amber-50 border-amber-100',    text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',    avatar: 'bg-amber-500'   },
  { header: 'bg-rose-500',    light: 'bg-rose-50 border-rose-100',      text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',      ring: 'ring-rose-500/20'    },
  { header: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-100',text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700',ring: 'ring-emerald-500/20' },
  { header: 'bg-orange-500',  light: 'bg-orange-50 border-orange-100',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  ring: 'ring-orange-500/20'  },
  { header: 'bg-pink-500',    light: 'bg-pink-50 border-pink-100',      text: 'text-pink-700',    badge: 'bg-pink-100 text-pink-700',      ring: 'ring-pink-500/20'    },
  { header: 'bg-indigo-500',  light: 'bg-indigo-50 border-indigo-100',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700',  ring: 'ring-indigo-500/20'  },
  { header: 'bg-cyan-500',    light: 'bg-cyan-50 border-cyan-100',      text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700',      ring: 'ring-cyan-500/20'    },
]

const TIPO_LABEL: Record<string, string> = {
  anual: 'Anual', trimestral: 'Trimestral', unidad: 'Unidad', semanal: 'Semanal', diaria: 'Diaria',
}
const TIPO_EMOJI: Record<string, string> = {
  anual: '📅', trimestral: '📆', unidad: '📖', semanal: '🗓️', diaria: '📝',
}

function fileExt(fileName: string | null) {
  return (fileName?.split('.').pop() || 'doc').toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AdminPlanificacionesClient({ planificaciones, teachers }: Props) {
  const supabase = createClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [filterCurso, setFilterCurso] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Assign stable color per teacher
  const teacherColor = useMemo(() => {
    const map: Record<string, typeof PALETTE[0]> = {}
    teachers.forEach((t, i) => { map[t.id] = PALETTE[i % PALETTE.length] })
    return map
  }, [teachers])

  // Count plans per teacher
  const teacherPlanCounts = useMemo(() => {
    const map: Record<string, number> = {}
    planificaciones.forEach(p => { map[p.user_id] = (map[p.user_id] || 0) + 1 })
    return map
  }, [planificaciones])

  // Get selected teacher object
  const selectedTeacher = useMemo(() => 
    teachers.find(t => t.id === selectedTeacherId), [teachers, selectedTeacherId])

  // Filtered plans for the selected teacher (or all)
  const filteredPlans = useMemo(() => {
    let list = planificaciones
    if (selectedTeacherId) list = list.filter(p => p.user_id === selectedTeacherId)
    if (filterCurso) list = list.filter(p => p.curso === filterCurso)
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      list = list.filter(p => 
        p.titulo.toLowerCase().includes(q) || 
        p.asignatura.toLowerCase().includes(q)
      )
    }
    return list
  }, [planificaciones, selectedTeacherId, filterCurso, searchTerm])

  // Group plans by Course -> Subject
  const groupedPlans = useMemo(() => {
    const map: Record<string, Record<string, PlanDoc[]>> = {}
    filteredPlans.forEach(p => {
      if (!map[p.curso]) map[p.curso] = {}
      if (!map[p.curso][p.asignatura]) map[p.curso][p.asignatura] = []
      map[p.curso][p.asignatura].push(p)
    })
    return map
  }, [filteredPlans])

  const allCursosForSelected = useMemo(() => 
    Array.from(new Set(filteredPlans.map(p => p.curso))).sort(), [filteredPlans])

  function getUrl(path: string) {
    return supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
  }

  const color = selectedTeacherId ? teacherColor[selectedTeacherId] : PALETTE[0]

  return (
    <div className="space-y-6">
      
      {/* ── Header / Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {selectedTeacherId ? (
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setSelectedTeacherId(null); setFilterCurso(''); }}
              className="p-2 hover:bg-surface2 rounded-xl transition-colors text-ink2"
              title="Volver a lista de docentes"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${color.header} flex items-center justify-center text-white font-bold`}>
                {selectedTeacher?.full_name.charAt(0)}
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">{selectedTeacher?.full_name}</h2>
                <p className="text-xs text-ink3">{filteredPlans.length} planificaciones encontradas</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 text-violet-600 rounded-xl">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Directorio de Docentes</h2>
              <p className="text-xs text-ink3">Selecciona un docente para ver su material</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por título..."
              className="input-base pl-9 text-sm w-full sm:w-64"
            />
          </div>
          {selectedTeacherId && (
            <select 
              value={filterCurso} 
              onChange={e => setFilterCurso(e.target.value)}
              className="input-base text-sm min-w-[140px]"
            >
              <option value="">Todos los cursos</option>
              {allCursosForSelected.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── TEACHER GRID VIEW ── */}
      {!selectedTeacherId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teachers.map(t => {
            const tColor = teacherColor[t.id]
            const count = teacherPlanCounts[t.id] || 0
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeacherId(t.id)}
                className={`group flex flex-col p-5 rounded-[2rem] border transition-all hover:shadow-xl hover:-translate-y-1 text-left relative overflow-hidden ${tColor.light}`}
              >
                {/* Decorative background circle */}
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 group-hover:scale-110 transition-transform ${tColor.header}`} />
                
                <div className="flex items-center gap-4 mb-4 relative z-10">
                  <div className={`w-12 h-12 rounded-2xl ${tColor.header} flex items-center justify-center text-white text-xl font-bold shadow-lg ring-4 ${tColor.ring}`}>
                    {t.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink truncate group-hover:text-ink leading-tight">{t.full_name}</h3>
                    <p className="text-[10px] text-ink3 truncate font-medium">{t.email}</p>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between relative z-10">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-ink4 tracking-wider">Planificaciones</p>
                    <p className={`text-xl font-black ${tColor.text}`}>{count}</p>
                  </div>
                  <div className={`p-2 rounded-xl ${tColor.badge} group-hover:scale-110 transition-transform`}>
                    <ChevronRight size={18} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── TEACHER DETAIL VIEW (Grouped Plans) ── */}
      {selectedTeacherId && (
        <div className="space-y-8 pb-10">
          {Object.keys(groupedPlans).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-[2rem] border border-dashed border-surface2">
              <FileText size={48} className="text-ink4 opacity-20 mb-4" />
              <p className="text-ink3 font-medium">No hay planificaciones que coincidan con los filtros.</p>
            </div>
          ) : (
            Object.entries(groupedPlans).sort(([a], [b]) => a.localeCompare(b)).map(([curso, subjectsMap]) => (
              <div key={curso} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-6 rounded-full ${color.header}`} />
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    {curso}
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface2 text-ink3">
                      {Object.values(subjectsMap).flat().length} items
                    </span>
                  </h3>
                </div>

                <div className="space-y-6">
                  {Object.entries(subjectsMap).sort(([a], [b]) => a.localeCompare(b)).map(([materia, docs]) => (
                    <div key={materia} className="ml-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-ink4 mb-3 flex items-center gap-2">
                         <BookOpen size={12} /> {materia}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {docs.map(doc => {
                          const url = getUrl(doc.storage_path)
                          const isPreview = previewId === doc.id
                          const isPdfFile = doc.file_name?.toLowerCase().endsWith('.pdf') || doc.file_type === 'application/pdf'
                          
                          return (
                            <div key={doc.id} className="bg-surface rounded-2xl border border-surface2 p-4 shadow-sm hover:shadow-md transition-shadow group relative">
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${color.badge}`}>
                                  {TIPO_EMOJI[doc.tipo]} {TIPO_LABEL[doc.tipo]}
                                </span>
                                <div className="text-[10px] font-bold text-ink4">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              
                              <h5 className="text-sm font-bold text-ink mb-1 line-clamp-2" title={doc.titulo}>
                                {doc.titulo}
                              </h5>
                              
                              {doc.trimestre && (
                                <p className="text-[10px] text-ink3 mb-3">
                                  Trimestre {doc.trimestre} {doc.semana ? `· Semana ${doc.semana}` : ''}
                                </p>
                              )}

                              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-surface2">
                                {isPdfFile ? (
                                  <button 
                                    onClick={() => setPreviewId(isPreview ? null : doc.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                                      isPreview 
                                        ? `${color.header} text-white` 
                                        : 'bg-surface2 text-ink2 hover:bg-surface3'
                                    }`}
                                  >
                                    <Eye size={14} /> {isPreview ? 'Cerrar' : 'Ver'}
                                  </button>
                                ) : (
                                  <div className="flex-1 opacity-50 cursor-not-allowed flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-surface2 text-ink3">
                                    <MoreVertical size={14} /> No previsualizable
                                  </div>
                                )}
                                <a 
                                  href={url} 
                                  download={doc.file_name || 'planificacion'}
                                  className="p-2 rounded-xl bg-surface2 text-ink2 hover:text-violet2 hover:bg-violet-50 transition-colors"
                                  title="Descargar"
                                >
                                  <Download size={16} />
                                </a>
                              </div>

                              {isPreview && isPdfFile && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                  <FilePreview url={url} compact />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
