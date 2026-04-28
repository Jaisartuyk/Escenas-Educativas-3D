'use client'
// src/components/biblioteca/AdminPlanificacionesClient.tsx
// Vista admin: planificaciones de todos los docentes, agrupadas por docente con colores

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sanitizePlanHtml } from '@/lib/sanitize/plan-html'
import { 
  Search, ArrowLeft, User, 
  FileText, LayoutGrid, ChevronRight, BookOpen
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Teacher {
  id: string
  full_name: string
  email: string
}

interface PlanManual {
  id: string
  user_id: string
  title: string
  subject_name: string
  course_name: string
  status: 'borrador' | 'publicada'
  type: string
  unit_number: number | null
  updated_at: string
  content_html: string | null
}

interface Props {
  manuales: PlanManual[]
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
export function AdminPlanificacionesClient({ manuales, teachers }: Props) {
  const supabase = createClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [filterCurso, setFilterCurso] = useState('')
  const [manualPreview, setManualPreview] = useState<PlanManual | null>(null)

  // Assign stable color per teacher
  const teacherColor = useMemo(() => {
    const map: Record<string, typeof PALETTE[0]> = {}
    teachers.forEach((t, i) => { map[t.id] = PALETTE[i % PALETTE.length] })
    return map
  }, [teachers])

  // Get selected teacher object
  const selectedTeacher = useMemo(() => 
    teachers.find(t => t.id === selectedTeacherId), [teachers, selectedTeacherId])

  // Manuales filtrados por docente seleccionado (si aplica) y por término búsqueda
  const filteredManuales = useMemo(() => {
    let list = manuales
    if (selectedTeacherId) list = list.filter(m => m.user_id === selectedTeacherId)
    // Filter by Curso if selected
    if (filterCurso) list = list.filter(m => m.course_name === filterCurso)
    
    if (searchTerm) {
      const t = searchTerm.toLowerCase()
      list = list.filter(m =>
        m.title.toLowerCase().includes(t) ||
        m.subject_name.toLowerCase().includes(t) ||
        m.course_name.toLowerCase().includes(t)
      )
    }
    return list
  }, [manuales, selectedTeacherId, filterCurso, searchTerm])

  const manualesByTeacher = useMemo(() => {
    const m: Record<string, number> = {}
    manuales.forEach(p => { m[p.user_id] = (m[p.user_id] || 0) + 1 })
    return m
  }, [manuales])

  const allCursosForSelected = useMemo(() => 
    Array.from(new Set(manuales.filter(m => m.user_id === selectedTeacherId).map(p => p.course_name))).sort(), 
  [manuales, selectedTeacherId])

  function getUrl(path: string) {
    return supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
  }

  const color = selectedTeacherId ? teacherColor[selectedTeacherId] : PALETTE[0]
  const sanitizedPreviewHtml = useMemo(
    () => sanitizePlanHtml(manualPreview?.content_html) || null,
    [manualPreview?.content_html]
  )

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
                <p className="text-xs text-ink3">{filteredManuales.length} planificaciones encontradas</p>
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
            const manualCount = manualesByTeacher[t.id] || 0
            const count = manualCount
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
          {filteredManuales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-[2rem] border border-dashed border-surface2">
              <FileText size={48} className="text-ink4 opacity-20 mb-4" />
              <p className="text-ink3 font-medium">No hay planificaciones digitales creadas.</p>
            </div>
          ) : (
            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredManuales.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setManualPreview(m)}
                    className="text-left p-4 rounded-2xl bg-white border border-line hover:border-violet hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-violet/10 text-violet flex items-center justify-center group-hover:bg-violet/20 transition-colors">
                        <FileText size={18} />
                      </div>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-violet/5 text-ink3">
                         {TIPO_EMOJI[m.type] || '📑'} {TIPO_LABEL[m.type] || 'Doc'}
                      </span>
                    </div>
                    
                    <h4 className="font-bold text-sm text-ink line-clamp-2 leading-tight mb-2 group-hover:text-violet transition-colors">
                      {m.title}
                    </h4>
                    
                    <p className="text-xs text-ink3 mb-3">
                      {m.subject_name} · {m.course_name}
                    </p>
                    
                    <div className="pt-3 border-t border-line flex items-center justify-between">
                      <span className="text-[10px] text-ink4">
                        Actualizado: {new Date(m.updated_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-bold text-violet opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver detalle →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: previsualización de planificación manual ─────────────── */}
      {manualPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-line">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold leading-tight">
                  {manualPreview.title}
                </h3>
                <p className="text-xs text-ink3 mt-0.5">
                  {manualPreview.subject_name} · {manualPreview.course_name}
                </p>
              </div>
              <button
                onClick={() => setManualPreview(null)}
                className="p-1 text-ink3 hover:text-ink ml-3"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              {sanitizedPreviewHtml ? (
                <div
                  className="plan-readonly-preview"
                  dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }}
                />
              ) : (
                <p className="text-sm text-ink3 italic text-center py-10">
                  El docente aún no ha agregado contenido a esta planificación.
                </p>
              )}
            </div>
          </div>
          <style jsx global>{`
            .plan-readonly-preview h1,
            .plan-readonly-preview h2,
            .plan-readonly-preview h3 { color: #4c1d95; font-weight: 700; margin: 1em 0 .4em; }
            .plan-readonly-preview h1 { font-size: 22px; }
            .plan-readonly-preview h2 { font-size: 18px; }
            .plan-readonly-preview h3 { font-size: 15px; }
            .plan-readonly-preview p { margin: .5em 0; }
            .plan-readonly-preview table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
            .plan-readonly-preview td, .plan-readonly-preview th { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
            .plan-readonly-preview th { background: #f3f4f6; font-weight: 700; text-align: left; }
            .plan-readonly-preview ul, .plan-readonly-preview ol { padding-left: 1.4em; margin: .5em 0; }
            .plan-readonly-preview strong { color: #4c1d95; }
          `}</style>
        </div>
      )}
    </div>
  )
}
