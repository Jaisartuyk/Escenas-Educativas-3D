'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sanitizePlanHtml } from '@/lib/sanitize/plan-html'
import { saveSupervisorNotes } from '@/lib/actions/planificaciones-manuales'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  LayoutGrid,
  Search,
  MessageSquare,
} from 'lucide-react'

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
  supervisor_notes: string | null
}

interface RecursoDoc {
  id: string
  user_id: string
  title: string
  subject_name: string
  course_name: string
  storage_path: string
  created_at: string
  file_name: string | null
  file_size: number | null
}

interface Props {
  manuales: PlanManual[]
  recursos: RecursoDoc[]
  teachers: Teacher[]
  institutionName?: string
  logoUrl?: string | null
}

const PALETTE = [
  { header: 'bg-violet-500', light: 'bg-violet-50 border-violet-100', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', ring: 'ring-violet-500/20' },
  { header: 'bg-teal-500', light: 'bg-teal-50 border-teal-100', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700', ring: 'ring-teal-500/20' },
  { header: 'bg-blue-500', light: 'bg-blue-50 border-blue-100', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', ring: 'ring-blue-500/20' },
  { header: 'bg-amber-500', light: 'bg-amber-50 border-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', ring: 'ring-amber-500/20' },
  { header: 'bg-rose-500', light: 'bg-rose-50 border-rose-100', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', ring: 'ring-rose-500/20' },
  { header: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-500/20' },
  { header: 'bg-orange-500', light: 'bg-orange-50 border-orange-100', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-500/20' },
  { header: 'bg-pink-500', light: 'bg-pink-50 border-pink-100', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700', ring: 'ring-pink-500/20' },
  { header: 'bg-indigo-500', light: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-500/20' },
  { header: 'bg-cyan-500', light: 'bg-cyan-50 border-cyan-100', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700', ring: 'ring-cyan-500/20' },
]

const TIPO_LABEL: Record<string, string> = {
  anual: 'Anual',
  trimestral: 'Trimestral',
  unidad: 'Unidad',
  semanal: 'Semanal',
  diaria: 'Diaria',
}

const TIPO_EMOJI: Record<string, string> = {
  anual: 'PCA',
  trimestral: 'TRI',
  unidad: 'UND',
  semanal: 'SEM',
  diaria: 'DIA',
}

function fileExt(fileName: string | null) {
  return (fileName?.split('.').pop() || 'DOC').toUpperCase()
}

export function AdminPlanificacionesClient({ manuales, recursos, teachers, institutionName, logoUrl }: Props) {
  const supabase = createClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [filterCurso, setFilterCurso] = useState('')
  const [manualPreview, setManualPreview] = useState<PlanManual | null>(null)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const isLetamendi = (institutionName || '').toUpperCase().includes('LETAMENDI')

  const teacherColor = useMemo(() => {
    const map: Record<string, typeof PALETTE[number]> = {}
    teachers.forEach((teacher, index) => {
      map[teacher.id] = PALETTE[index % PALETTE.length]
    })
    return map
  }, [teachers])

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === selectedTeacherId),
    [teachers, selectedTeacherId]
  )

  const filteredManuales = useMemo(() => {
    let list = manuales
    if (selectedTeacherId) list = list.filter((item) => item.user_id === selectedTeacherId)
    if (filterCurso) list = list.filter((item) => item.course_name === filterCurso)

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter((item) =>
        item.title.toLowerCase().includes(term) ||
        item.subject_name.toLowerCase().includes(term) ||
        item.course_name.toLowerCase().includes(term)
      )
    }

    return list
  }, [manuales, selectedTeacherId, filterCurso, searchTerm])

  const filteredRecursos = useMemo(() => {
    let list = recursos
    if (selectedTeacherId) list = list.filter((item) => item.user_id === selectedTeacherId)
    if (filterCurso) list = list.filter((item) => item.course_name === filterCurso)

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter((item) =>
        item.title.toLowerCase().includes(term) ||
        item.subject_name.toLowerCase().includes(term) ||
        item.course_name.toLowerCase().includes(term) ||
        (item.file_name || '').toLowerCase().includes(term)
      )
    }

    return list
  }, [recursos, selectedTeacherId, filterCurso, searchTerm])

  const manualesByTeacher = useMemo(() => {
    const counts: Record<string, number> = {}
    manuales.forEach((item) => { counts[item.user_id] = (counts[item.user_id] || 0) + 1 })
    return counts
  }, [manuales])

  const recursosByTeacher = useMemo(() => {
    const counts: Record<string, number> = {}
    recursos.forEach((item) => { counts[item.user_id] = (counts[item.user_id] || 0) + 1 })
    return counts
  }, [recursos])

  const draftsByTeacher = useMemo(() => {
    const counts: Record<string, number> = {}
    manuales.forEach((item) => {
      if (item.status === 'borrador') counts[item.user_id] = (counts[item.user_id] || 0) + 1
    })
    return counts
  }, [manuales])

  const allCursosForSelected = useMemo(() => {
    const names = new Set<string>()
    manuales.filter((item) => item.user_id === selectedTeacherId).forEach((item) => names.add(item.course_name))
    recursos.filter((item) => item.user_id === selectedTeacherId).forEach((item) => names.add(item.course_name))
    return Array.from(names).sort()
  }, [manuales, recursos, selectedTeacherId])

  const sanitizedPreviewHtml = useMemo(
    () => sanitizePlanHtml(manualPreview?.content_html) || null,
    [manualPreview?.content_html]
  )

  function getUrl(path: string) {
    return supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
  }

  const color = selectedTeacherId ? teacherColor[selectedTeacherId] : PALETTE[0]

  function openPreview(item: PlanManual) {
    setManualPreview(item)
    setNotesText(item.supervisor_notes || '')
  }

  async function handleSaveNotes() {
    if (!manualPreview) return
    setSavingNotes(true)
    const r = await saveSupervisorNotes({ id: manualPreview.id, notes: notesText })
    setSavingNotes(false)
    if (r.ok) {
      setManualPreview({ ...manualPreview, supervisor_notes: notesText.trim() || null })
      toast.success('Retroalimentación guardada')
    } else {
      toast.error('Error al guardar: ' + r.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {selectedTeacherId ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSelectedTeacherId(null); setFilterCurso('') }}
              className="rounded-xl p-2 text-ink2 transition-colors hover:bg-surface2"
              title="Volver a lista de docentes"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color.header} text-white font-bold`}>
                {selectedTeacher?.full_name.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">{selectedTeacher?.full_name}</h2>
                <p className="text-xs text-ink3">
                  {filteredManuales.length} planificaciones y {filteredRecursos.length} recursos
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-2 text-violet-600">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Directorio de Docentes</h2>
              <p className="text-xs text-ink3">Selecciona un docente para ver su avance y recursos</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink3" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título..."
              className="input-base w-full pl-9 text-sm sm:w-64"
            />
          </div>
          {selectedTeacherId && (
            <select
              value={filterCurso}
              onChange={(e) => setFilterCurso(e.target.value)}
              className="input-base min-w-[140px] text-sm"
            >
              <option value="">Todos los cursos</option>
              {allCursosForSelected.map((course) => <option key={course} value={course}>{course}</option>)}
            </select>
          )}
        </div>
      </div>

      {!selectedTeacherId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teachers.map((teacher) => {
            const palette = teacherColor[teacher.id]
            const planCount = manualesByTeacher[teacher.id] || 0
            const draftCount = draftsByTeacher[teacher.id] || 0
            const resourceCount = recursosByTeacher[teacher.id] || 0

            return (
              <button
                key={teacher.id}
                onClick={() => setSelectedTeacherId(teacher.id)}
                className={`group relative flex flex-col overflow-hidden rounded-[2rem] border p-5 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${palette.light}`}
              >
                <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 transition-transform group-hover:scale-110 ${palette.header}`} />

                <div className="relative z-10 mb-4 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${palette.header} text-xl font-bold text-white shadow-lg ring-4 ${palette.ring}`}>
                    {teacher.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold leading-tight text-ink">{teacher.full_name}</h3>
                    <p className="truncate text-[10px] font-medium text-ink3">{teacher.email}</p>
                  </div>
                </div>

                <div className="relative z-10 mt-auto flex items-end justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink4">Planificaciones</p>
                    <p className={`text-xl font-black ${palette.text}`}>{planCount}</p>
                    <p className="text-[11px] text-ink3">
                      {draftCount} borradores · {resourceCount} recursos
                    </p>
                  </div>
                  <div className={`rounded-xl p-2 transition-transform group-hover:scale-110 ${palette.badge}`}>
                    <ChevronRight size={18} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedTeacherId && (
        <div className="space-y-8 pb-10">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink4">Planificaciones</p>
              <p className="mt-2 text-2xl font-black text-ink">{filteredManuales.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Borradores</p>
              <p className="mt-2 text-2xl font-black text-amber-700">
                {filteredManuales.filter((item) => item.status === 'borrador').length}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Recursos</p>
              <p className="mt-2 text-2xl font-black text-blue-700">{filteredRecursos.length}</p>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              <h3 className="font-bold text-ink">Planificaciones</h3>
            </div>

            {filteredManuales.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-surface2 bg-surface py-16 text-center">
                <FileText size={40} className="mx-auto mb-4 text-ink4 opacity-20" />
                <p className="font-medium text-ink3">No hay planificaciones digitales para este filtro.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredManuales.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openPreview(item)}
                    className="group rounded-2xl border border-line bg-white p-4 text-left transition-all hover:border-violet hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 text-violet transition-colors group-hover:bg-violet/20">
                        <FileText size={18} />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-lg bg-violet/5 px-2 py-0.5 text-[9px] font-black uppercase text-ink3">
                          {TIPO_EMOJI[item.type] || 'DOC'} {TIPO_LABEL[item.type] || 'Doc'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          item.status === 'publicada'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>

                    <h4 className="mb-2 line-clamp-2 text-sm font-bold leading-tight text-ink transition-colors group-hover:text-violet">
                      {item.title}
                    </h4>

                    <p className="mb-3 text-xs text-ink3">
                      {item.subject_name} · {item.course_name}
                    </p>

                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <span className="text-[10px] text-ink4" suppressHydrationWarning>
                        Actualizado: {new Date(item.updated_at).toLocaleDateString('es-EC')}
                      </span>
                      <span className="text-[10px] font-bold text-violet opacity-0 transition-opacity group-hover:opacity-100">
                        Ver detalle →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <h3 className="font-bold text-ink">Recursos</h3>
            </div>

            {filteredRecursos.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-surface2 bg-surface py-16 text-center">
                <BookOpen size={40} className="mx-auto mb-4 text-ink4 opacity-20" />
                <p className="font-medium text-ink3">No hay recursos cargados para este docente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRecursos.map((item) => (
                  <a
                    key={item.id}
                    href={getUrl(item.storage_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-line bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <BookOpen size={18} />
                      </div>
                      <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">
                        {fileExt(item.file_name)}
                      </span>
                    </div>

                    <h4 className="mb-2 line-clamp-2 text-sm font-bold leading-tight text-ink transition-colors group-hover:text-blue-700">
                      {item.title}
                    </h4>

                    <p className="mb-3 text-xs text-ink3">
                      {item.subject_name} · {item.course_name}
                    </p>

                    <div className="flex items-center justify-between border-t border-line pt-3">
                      <span className="text-[10px] text-ink4" suppressHydrationWarning>
                        Subido: {new Date(item.created_at).toLocaleDateString('es-EC')}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 opacity-0 transition-opacity group-hover:opacity-100">
                        Abrir <ExternalLink size={12} />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {manualPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-line p-5">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-bold leading-tight">{manualPreview.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    manualPreview.status === 'publicada'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {manualPreview.status}
                  </span>
                </div>
                <p className="text-xs text-ink3">
                  {manualPreview.subject_name} · {manualPreview.course_name}
                </p>
              </div>
              <button
                onClick={() => setManualPreview(null)}
                className="ml-3 p-1 text-ink3 hover:text-ink"
              >
                ✕
              </button>
            </div>
            {isLetamendi && manualPreview.type === 'anual' && (
              <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
                )}
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold uppercase text-gray-800">{institutionName}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Planificación Curricular Anual</p>
                </div>
                {logoUrl && (
                  <img src={logoUrl} alt="" className="h-14 w-auto object-contain opacity-0" aria-hidden />
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              {sanitizedPreviewHtml ? (
                <div
                  className="plan-readonly-preview"
                  dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }}
                />
              ) : (
                <p className="py-10 text-center text-sm italic text-ink3">
                  El docente aún no ha agregado contenido a esta planificación.
                </p>
              )}

              <div className="mt-6 border-t border-line pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquare size={15} className="text-blue-600" />
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Retroalimentación al docente</p>
                </div>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Escribe aquí tus comentarios o sugerencias para el docente sobre esta planificación…"
                  rows={4}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-ink outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <div className="mt-2 flex items-center justify-end gap-3">
                  {manualPreview.supervisor_notes && !notesText && (
                    <p className="text-xs text-ink3 italic">El campo está vacío — guardar eliminará la retroalimentación actual.</p>
                  )}
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingNotes ? 'Guardando…' : 'Guardar retroalimentación'}
                  </button>
                </div>
              </div>
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
            .plan-readonly-preview .letamendi-plan-table td,
            .plan-readonly-preview .letamendi-plan-table th { border: 1px solid #111; }
            .plan-readonly-preview .letamendi-plan-table .section-title td { background: #1a237e; color: white; font-weight: 700; font-size: 13px; }
            .plan-readonly-preview .letamendi-plan-table td.comp-c  { background: #00ACC1 !important; color: white; text-align: center; font-weight: bold; }
            .plan-readonly-preview .letamendi-plan-table td.comp-cm { background: #1565C0 !important; color: white; text-align: center; font-weight: bold; }
            .plan-readonly-preview .letamendi-plan-table td.comp-cd { background: #E64A19 !important; color: white; text-align: center; font-weight: bold; }
            .plan-readonly-preview .letamendi-plan-table td.comp-cs { background: #F9A825 !important; color: white; text-align: center; font-weight: bold; }
            .plan-readonly-preview .letamendi-plan-table td.comp-c p,
            .plan-readonly-preview .letamendi-plan-table td.comp-cm p,
            .plan-readonly-preview .letamendi-plan-table td.comp-cd p,
            .plan-readonly-preview .letamendi-plan-table td.comp-cs p { color: white !important; }
          `}</style>
        </div>
      )}
    </div>
  )
}
