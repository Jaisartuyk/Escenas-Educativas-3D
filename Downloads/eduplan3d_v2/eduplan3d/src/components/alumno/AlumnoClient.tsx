'use client'

import { useState } from 'react'
import {
  BookOpen, CalendarDays, BarChart2,
  CheckCircle2, Clock3, ThumbsUp, ThumbsDown,
  Upload, X, Check, Paperclip, AlertTriangle,
  Award, Trophy, Star
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type TabType = 'resumen' | 'tareas' | 'horario' | 'calificaciones' | 'asistencia' | 'comportamiento'

const CARD_COLORS = [
  '#7C6DFA', '#3B82F6', '#14B8A6',
  '#F59E0B', '#F43F5E', '#6366F1',
  '#10B981', '#F97316', '#EC4899', '#06B6D4',
]
const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes'] as const

function toISO(d: Date) { return d.toISOString().split('T')[0] }

export function AlumnoClient({
  profile, courses, subjects, assignments, grades, categories, attendance, behaviors, scheduleConfig, horariosData
}: any) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('resumen')

  // Justification Modal State
  const [showJustifyModal, setShowJustifyModal] = useState<any>(null)
  const [justifyText, setJustifyText] = useState('')
  const [justifyFile, setJustifyFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localAttendance, setLocalAttendance] = useState<any[]>(attendance || [])

  // ── Stats
  const missingAssignments = assignments.filter((a: any) => !grades.find((g: any) => g.assignment_id === a.id))
  const attendanceIssues = localAttendance.filter((a: any) => a.status === 'absent' || a.status === 'late')
  const merits = behaviors.filter((b: any) => b.type === 'positive')

  // ── Today's Classes 
  const now = new Date()
  const dayIndex = now.getDay()
  const todayName = dayIndex >= 1 && dayIndex <= 5 ? DIAS_SEMANA[dayIndex - 1] : null
  
  const todayClasses: any[] = []
  const myCourseNames = courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim())
  
  if (todayName) {
    Object.values(horariosData).forEach((slot: any) => {
      const cfg = slot.config || {}
      const perArr = cfg.horarios || []
      const rec = new Set<number>(cfg.recesos || [4])
      
      Object.entries(slot.horario || {}).forEach(([curso, dias]: [string, any]) => {
        if (myCourseNames.includes(curso)) {
          const materias = dias[todayName] || []
          materias.forEach((m: string, idx: number) => {
            if (m && !rec.has(idx)) {
              todayClasses.push({
                materia: m,
                curso,
                hora: perArr[idx] || `${idx + 1}°`,
                periodoIdx: idx
              })
            }
          })
        }
      })
    })
    todayClasses.sort((a, b) => a.periodoIdx - b.periodoIdx)
  }

  // ── Submit Justification
  async function handleJustifySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!justifyText.trim()) return toast.error('Ingresa un motivo')
    setIsSubmitting(true)

    try {
      let file_url = null
      if (justifyFile) {
        const fileExt = justifyFile.name.split('.').pop()
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('justifications')
          .upload(fileName, justifyFile)
          
        if (uploadError) throw new Error('Error al subir el archivo: ' + uploadError.message)
        
        const { data: { publicUrl } } = supabase.storage
          .from('justifications')
          .getPublicUrl(fileName)
        file_url = publicUrl
      }

      const res = await fetch('/api/alumno/attendance/justify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_id: showJustifyModal.id,
          text: justifyText,
          file_url
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      setLocalAttendance(prev => prev.map(a => 
        a.id === showJustifyModal.id ? { ...a, justification_status: 'pending', justification_text: justifyText, justification_file_url: file_url } : a
      ))
      
      toast.success('Justificación enviada')
      setShowJustifyModal(null)
      setJustifyText('')
      setJustifyFile(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in px-4 sm:px-0">
      
      {/* ── PREMIUM HEADER BANNER ── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 shadow-xl shadow-indigo-500/20 p-8 sm:p-12 mb-8">
        {/* Abstract decor */}
        <div className="absolute top-0 right-0 -m-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -m-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
          <div className="text-center sm:text-left">
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm mb-2">
              Hola, {profile.full_name?.split(' ')[0] || 'Estudiante'} 👋
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium">
              <Award size={16} className="text-yellow-300" />
              {courses.map((c: any) => `${c.name} ${c.parallel || ''}`.trim()).join(' / ')}
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-inner">
            <div className="text-center px-4 border-r border-white/10">
              <div className="text-3xl font-black text-white">{subjects.length}</div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Materias</div>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl font-black text-emerald-400">{merits.length}</div>
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Méritos</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODERN TABS ── */}
      <div className="sticky top-4 z-40 p-1.5 bg-surface/80 backdrop-blur-xl border border-surface2 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar flex gap-1">
        {[
          { id: 'resumen', icon: <BarChart2 size={18}/>, label: 'Resumen' },
          { id: 'tareas', icon: <BookOpen size={18}/>, label: 'Tareas' },
          { id: 'horario', icon: <CalendarDays size={18}/>, label: 'Horario' },
          { id: 'calificaciones', icon: <CheckCircle2 size={18}/>, label: 'Promedios' },
          { id: 'asistencia', icon: <Clock3 size={18}/>, label: 'Asistencia' },
          { id: 'comportamiento', icon: <Star size={18}/>, label: 'Docencia' },
        ].map(t => {
          const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 flex justify-center items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                isActive 
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 scale-[1.02]' 
                  : 'text-ink3 hover:bg-[rgba(0,0,0,0.04)] hover:text-ink'
              }`}>
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="animate-slide-up">
        {activeTab === 'resumen' && (
          <div className="space-y-8">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3">
              <span className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded-xl">📊</span> Visión General
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Materias Inscritas', value: subjects.length, color: 'from-blue-500 to-cyan-400', icon: '📚', shadow: 'shadow-blue-500/20' },
                { label: 'Tareas Pendientes', value: missingAssignments.length, color: 'from-amber-400 to-orange-500', icon: '📝', shadow: 'shadow-orange-500/20' },
                { label: 'Faltas y Atrasos', value: attendanceIssues.length, color: 'from-rose-500 to-red-600', icon: '⚠️', shadow: 'shadow-rose-500/20' },
                { label: 'Felicitaciones', value: merits.length, color: 'from-emerald-400 to-teal-500', icon: '🏆', shadow: 'shadow-emerald-500/20' },
              ].map((stat, i) => (
                <div key={i} className={`relative overflow-hidden bg-surface rounded-[1.5rem] border border-surface2 p-6 shadow-xl ${stat.shadow} hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500`} />
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="text-[11px] font-black text-ink4 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className={`text-4xl font-black bg-gradient-to-br ${stat.color} text-transparent bg-clip-text`}>{stat.value}</div>
                    </div>
                    <div className={`text-2xl p-3 bg-gradient-to-br ${stat.color} bg-opacity-10 rounded-2xl bg-clip-padding backdrop-filter backdrop-blur-sm shadow-sm`}>{stat.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface rounded-[2rem] border border-surface2 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold flex items-center gap-3">
                   📅 Clases de Hoy
                </h2>
                <span className="text-sm font-medium text-ink4 bg-surface2 px-4 py-1.5 rounded-full">{todayName || 'Fin de semana'}</span>
              </div>
              
              {todayClasses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {todayClasses.map((cl, i) => (
                    <div key={i} className="flex flex-col gap-3 p-5 rounded-2xl border border-surface2 bg-bg hover:border-violet-400/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-colors duration-300 group">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold shadow-sm group-hover:scale-110 transition-transform">
                        {cl.hora.split('-')[0]?.trim() || `P${cl.periodoIdx+1}`}
                      </div>
                      <div>
                        <div className="font-bold text-ink text-lg leading-tight mb-1">{cl.materia}</div>
                        <div className="text-xs font-semibold text-ink4 flex items-center gap-1">
                          <Clock3 size={12}/> {cl.hora}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-bg rounded-2xl border border-dashed border-surface2">
                  <div className="text-4xl mb-4">🎉</div>
                  <h3 className="font-bold text-ink">¡Día Libre!</h3>
                  <p className="text-sm text-ink3 mt-1">No tienes clases programadas para hoy, o es fin de semana.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tareas' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
              <span className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl"><BookOpen size={20}/></span> 
              Historial de Tareas
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {assignments.length > 0 ? assignments.map((a: any) => {
                const subject = subjects.find((s: any) => s.id === a.subject_id)
                const grade = grades.find((g: any) => g.assignment_id === a.id)
                const isPastDue = a.due_date && new Date(a.due_date).getTime() < new Date().getTime()
                
                return (
                  <div key={a.id} className="relative overflow-hidden flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-6 rounded-2xl border border-surface2 bg-bg hover:border-amber-400/50 transition-all duration-300 group hover:shadow-md">
                    {/* Subtle status indicator edge */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${grade ? 'bg-emerald-400' : isPastDue ? 'bg-rose-400' : 'bg-amber-400'}`} />
                    
                    <div className="pl-2">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="font-bold text-lg text-ink">{a.title}</div>
                        {grade ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-emerald-500/10 text-emerald-600 uppercase border border-emerald-500/20">Evaluada</span>
                        ) : isPastDue ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-rose-500/10 text-rose-600 uppercase border border-rose-500/20">Atrasada</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-600 uppercase border border-amber-500/20">Asignada</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">{subject?.name || 'Materia general'}</div>
                        {a.due_date && (
                          <div className={`text-xs font-semibold flex items-center gap-1.5 ${isPastDue && !grade ? 'text-rose-500' : 'text-ink4'}`}>
                            <CalendarDays size={14}/> Vence: {new Date(a.due_date).toLocaleDateString('es-ES')}
                          </div>
                        )}
                      </div>
                    </div>
                    {grade && (
                      <div className="sm:text-right bg-surface px-6 py-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="text-3xl font-black text-emerald-500">{grade.score}</div>
                        <div className="text-[10px] text-ink4 font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2 rounded-md mt-1">Nota Final</div>
                      </div>
                    )}
                  </div>
                )
              }) : (
                <div className="flex flex-col items-center justify-center py-20 bg-bg rounded-2xl border border-dashed border-surface2">
                  <BookOpen size={48} className="text-ink4/50 mb-4" />
                  <p className="text-ink3 font-medium">No hay tareas publicadas actualmente.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'asistencia' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
              <span className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl"><AlertTriangle size={20}/></span> 
              Control de Asistencia
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {attendanceIssues.length > 0 ? attendanceIssues.map((a: any) => {
                const subject = subjects.find((s: any) => s.id === a.subject_id)
                const isLate = a.status === 'late'
                
                return (
                  <div key={a.id} className="p-6 rounded-2xl border border-surface2 bg-bg hover:border-surface3 transition-all flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${isLate ? 'text-amber-600 bg-amber-100 border border-amber-200' : 'text-rose-600 bg-rose-100 border border-rose-200'}`}>
                          {isLate ? '⏳ Atraso' : '❌ Falta Injustificada'}
                        </div>
                        <div className="font-bold text-ink">{subject?.name || 'Clase'}</div>
                      </div>
                      <div className="text-sm font-medium text-ink4 flex items-center gap-2">
                        <CalendarDays size={14}/> {new Date(a.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                      </div>
                      
                      {a.justification_status && (
                        <div className="mt-4 p-4 rounded-xl bg-surface border border-surface2 relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${a.justification_status === 'pending' ? 'bg-amber-400' : a.justification_status === 'approved' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <div className="flex items-center gap-2 mb-2 ml-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-ink4">Estado del Trámite:</span>
                            {a.justification_status === 'pending' && <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">En revisión administrativa</span>}
                            {a.justification_status === 'approved' && <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">Falta Justificada ✅</span>}
                            {a.justification_status === 'rejected' && <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Rechazada ❌</span>}
                          </div>
                          <div className="text-sm text-ink3 italic ml-2 bg-bg p-3 rounded-lg border border-surface2">
                            "{a.justification_text}"
                          </div>
                          {a.justification_file_url && (
                            <a href={a.justification_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg mt-3 ml-2 transition-colors">
                              <Paperclip size={14}/> Ver Evidencia Adjunta
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!a.justification_status && (
                      <button onClick={() => setShowJustifyModal(a)} className="btn-secondary whitespace-nowrap bg-white hover:bg-surface2 shadow-sm border-surface2 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-ink">
                        <Upload size={16}/> Enviar Justificativo
                      </button>
                    )}
                  </div>
                )
              }) : (
                <div className="flex flex-col items-center justify-center py-20 bg-bg rounded-2xl border border-dashed border-emerald-300">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="font-display font-bold text-xl text-ink">¡Asistencia Perfecta!</h3>
                  <p className="text-ink3 font-medium mt-1">No tienes faltas ni atrasos reportados.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Justification Modal */}
        {showJustifyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-fade-in">
            <div className="bg-surface rounded-3xl border border-surface2 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transform transition-all">
              <div className="relative h-24 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 flex flex-col justify-end">
                <button onClick={() => { setShowJustifyModal(null); setJustifyText(''); setJustifyFile(null) }} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-1.5 transition-colors"><X size={20}/></button>
                <h3 className="font-display text-2xl font-bold text-white drop-shadow-sm">Justificar Inasistencia</h3>
              </div>
              
              <form onSubmit={handleJustifySubmit} className="p-6 md:p-8 space-y-6">
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200">
                  <p className="text-sm text-orange-800 dark:text-orange-200 font-medium leading-relaxed">
                    Estás a punto de enviar una justificación para el día <b>{new Date(showJustifyModal.date).toLocaleDateString('es-ES')}</b> en la materia de <b>{subjects.find((s:any)=>s.id===showJustifyModal.subject_id)?.name}</b>. Este proceso genera una alerta a inspección.
                  </p>
                </div>
                
                <div>
                  <label className="block text-[11px] font-black text-ink4 uppercase tracking-widest mb-2 ml-1">Motivo Detallado <span className="text-rose-500">*</span></label>
                  <textarea 
                    required autoFocus
                    value={justifyText} onChange={e => setJustifyText(e.target.value)}
                    className="input-base w-full h-32 resize-none rounded-2xl bg-bg border-surface2 focus:border-violet-500 focus:ring-violet-500/20 shadow-inner"
                    placeholder="Escribe el motivo médico o personal con el mayor nivel de detalle posible..."
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-black text-ink4 uppercase tracking-widest mb-2 ml-1">Evidencia Documental (Certificado)</label>
                  <div className="flex items-center gap-3">
                    <label className="btn-secondary bg-white hover:bg-surface2 px-4 py-2.5 rounded-xl border border-surface2 cursor-pointer flex items-center gap-2 font-bold shadow-sm transition-all text-sm">
                      <Paperclip size={16} className="text-violet-500"/> {justifyFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}
                      <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setJustifyFile(e.target.files?.[0] || null)} />
                    </label>
                    <div className="flex-1 min-w-0">
                      {justifyFile ? (
                        <div className="text-sm font-semibold text-emerald-600 flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg truncate border border-emerald-100">
                          <Check size={14} className="flex-shrink-0"/> {justifyFile.name}
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-ink4 italic truncate">Ningún archivo...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowJustifyModal(null)} className="btn-secondary hover:bg-surface2 px-5 py-2.5 rounded-xl font-bold">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="btn-primary shadow-glow shadow-violet-500/30 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all">
                    {isSubmitting ? 'Procesando trámite...' : <><Upload size={18}/> Enviar Formalmente</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MORE TABS */}
        {activeTab === 'comportamiento' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
             <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
                <span className="p-2 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-xl"><Trophy size={20}/></span> 
                Desempeño y Observaciones
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {behaviors.length > 0 ? behaviors.map((b: any) => {
                  const isPositive = b.type === 'positive'
                  const isNegative = b.type === 'negative'
                  return (
                    <div key={b.id} className="flex gap-5 p-5 rounded-2xl border border-surface2 bg-bg hover:shadow-md transition-all">
                      <div className={`mt-1 flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner ${isPositive?'bg-emerald-100 text-emerald-600 border border-emerald-200':isNegative?'bg-rose-100 text-rose-600 border border-rose-200':'bg-amber-100 text-amber-600 border border-amber-200'}`}>
                        {isPositive ? <ThumbsUp size={24}/> : isNegative ? <ThumbsDown size={24}/> : <AlertTriangle size={24}/>}
                      </div>
                      <div>
                        <div className="font-bold text-lg leading-tight mb-1">{subjects.find((s:any)=>s.id===b.subject_id)?.name || 'General'}</div>
                        <div className="text-sm font-medium text-ink3">{b.description}</div>
                        <div className="text-[10px] font-black uppercase text-ink4 tracking-widest mt-3 flex items-center gap-1.5"><Clock3 size={12}/> {new Date(b.date).toLocaleDateString('es-ES')}</div>
                      </div>
                    </div>
                  )
               }) : (
                 <div className="col-span-full flex flex-col items-center justify-center py-16 bg-bg rounded-2xl border border-dashed border-surface2">
                   <Star size={40} className="text-ink4/40 mb-3" />
                   <p className="text-ink3 font-medium">Aún no hay registros de comportamiento.</p>
                 </div>
               )}
             </div>
          </div>
        )}
        
        {activeTab === 'horario' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CalendarDays size={32} />
            </div>
            <h3 className="text-2xl font-display font-bold text-ink mb-2">Horario Institucional</h3>
            <p className="text-ink3 font-medium max-w-sm mx-auto">Tu representación gráfica de horarios estará disponible aquí como una vista semanal interactiva próximamente.</p>
          </div>
        )}
        
        {activeTab === 'calificaciones' && (
          <div className="bg-surface rounded-[2rem] border border-surface2 p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold flex items-center gap-3 mb-6">
              <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl"><Award size={20}/></span> 
              Libreta de Calificaciones
            </h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {subjects.map((sub:any) => {
                 const myAsgs = assignments.filter((a:any)=>a.subject_id === sub.id)
                 const myGrades = grades.filter((g:any)=>myAsgs.some((a:any)=>a.id===g.assignment_id))
                 const avg = myGrades.length > 0 ? (myGrades.reduce((acc:any, g:any)=>acc+g.score,0)/myGrades.length).toFixed(2) : null
                 
                 return (
                   <div key={sub.id} className="relative overflow-hidden flex flex-col justify-between p-6 rounded-2xl border border-surface2 bg-bg hover:border-blue-400/40 hover:-translate-y-1 transition-all group shadow-sm">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                     <div className="relative z-10 mb-6">
                       <div className="font-bold text-lg text-ink leading-tight">{sub.name}</div>
                       <div className="text-xs font-semibold text-ink4 mt-1 bg-surface2 inline-block px-2 py-0.5 rounded-md">{sub.teacher?.full_name || 'Sin docente'}</div>
                     </div>
                     <div className="relative z-10 flex items-end justify-between border-t border-surface2 pt-4">
                       <div className="text-[10px] font-black uppercase text-ink4 tracking-widest">Promedio Actual</div>
                       {avg ? (
                          <div className={`text-3xl font-black ${Number(avg) >= 7 ? 'text-emerald-500 drop-shadow-sm' : 'text-rose-500 drop-shadow-sm'}`}>{avg}</div>
                       ) : <span className="text-sm font-medium text-ink4 italic border border-dashed border-surface2 px-2 py-1 rounded-lg">No calculado</span>}
                     </div>
                   </div>
                 )
               })}
             </div>
          </div>
        )}

      </div>
    </div>
  )
}
