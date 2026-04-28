'use client'
// src/components/calendario/CalendarioClient.tsx
// UI del Calendario docente: vista semanal Lun-Dom + sidebar de planificaciones,
// con drag & drop usando @dnd-kit/core.

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  X,
  Trash2,
  FileText,
  Printer,
  Eye,
  ExternalLink,
} from 'lucide-react'
import {
  agendarPlanificacion,
  agendarSesionesMultiples,
  moverEntrada,
  desagendarEntrada,
  listarRango,
  actualizarEntrada,
  type AgendaEntryWithPlan,
} from '@/lib/actions/calendario'
import { MarkdownRenderer } from '@/components/planner/MarkdownRenderer'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
type Sesion = { numero: number; tema: string; duracion_min: number }
type Planificacion = {
  id: string
  title: string
  subject: string
  grade: string
  topic: string
  type: string
  grupo?: string | null
  content?: string | any | null
  metadata?: any
  created_at: string
}

function getSesiones(p: Planificacion | undefined | null): Sesion[] {
  const meta = p?.metadata || {}
  const arr = (meta as any)?.sesiones
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.filter((s: any) => s && typeof s.numero === 'number')
  }

  // Fallback: Parsear del contenido markdown
  let text = (p as any).content || (meta as any).content || ''
  if (typeof text !== 'string') {
    try { text = JSON.stringify(text) } catch { text = '' }
  }
  if (!text) return []

  const sesiones: Sesion[] = []
  // Regex extrema: cualquier cabecera (o ninguna) + Sesion + numero + cualquier separador
  const sesionRegex = /^(?:#{1,5}\s*)?Sesi[oó]n\s*(\d+)\s*[:\-–.]?\s*(.*)$/gim
  let m: RegExpExecArray | null
  while ((m = sesionRegex.exec(text)) !== null) {
    const numero = parseInt(m[1], 10)
    const tema = (m[2] || '').trim().split('\n')[0].replace(/[#*]/g, '').trim().slice(0, 100)
    if (numero > 0 && !sesiones.some(s => s.numero === numero)) {
      sesiones.push({
        numero,
        tema: tema || `Sesión ${numero}`,
        duracion_min: 45
      })
    }
  }
  return sesiones.sort((a,b) => a.numero - b.numero)
}

function extractSesionMarkdown(content: string | null | undefined, numero: number | null): string {
  if (!content) return ''
  let text = content
  if (typeof text !== 'string') {
    try { text = JSON.stringify(text, null, 2) } catch { text = '' }
  }
  if (numero == null) return text

  // Busca cualquier cabecera que empiece con "Sesión N"
  const startRegex = new RegExp(
    `^(?:#{1,5}\\s*)?Sesi[oó]n\\s*${numero}\\s*[:\\-–.]?.*$`,
    'im'
  )
  const startMatch = startRegex.exec(text)
  if (!startMatch || startMatch.index == null) return text
  
  const startIdx = startMatch.index
  const rest = text.slice(startIdx + startMatch[0].length)
  
  // Busca el inicio de la siguiente sesión o sección principal
  const nextRegex = /^(?:#{1,5}\s*)?(?:Sesi[oó]n\s*(\d+)|[A-Z0-9]{1,2}\.\s+|#{1,3}\s+)/im
  const nextMatch = nextRegex.exec(rest)
  const endIdx = nextMatch && nextMatch.index != null
    ? startIdx + startMatch[0].length + nextMatch.index
    : text.length
    
  return text.slice(startIdx, endIdx).trim()
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date): Date {
  const out = new Date(d)
  const dow = out.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  out.setDate(out.getDate() + diff)
  out.setHours(0, 0, 0, 0)
  return out
}

function fmtFechaCorta(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtFechaLarga(d: Date): string {
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Draggable: tarjeta de planificación en el sidebar
// ─────────────────────────────────────────────────────────────────────────────
function DraggablePlan({ plan }: { plan: Planificacion }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `plan:${plan.id}`,
    data: { type: 'plan', plan },
  })
  const sesiones = getSesiones(plan)
  
  const typeLabel = {
    clase: 'Clase',
    unidad: 'Unidad',
    rubrica: 'Rúbrica',
    adaptacion: 'Adaptación',
    diagnostica: 'Diagnóstico'
  }[plan.type] || plan.type

  const typeColor = {
    clase: 'text-violet bg-violet/10',
    unidad: 'text-amber-600 bg-amber-50',
    rubrica: 'text-rose-600 bg-rose-50',
    adaptacion: 'text-teal-600 bg-teal-50',
    diagnostica: 'text-teal-600 bg-teal-50'
  }[plan.type] || 'text-violet bg-violet/10'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        cursor-grab active:cursor-grabbing select-none
        bg-white border border-line rounded-lg p-3 mb-2
        hover:border-violet hover:shadow-sm transition
        ${isDragging ? 'opacity-40' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${typeColor}`}>
          {typeLabel}
        </span>
        {sesiones.length > 1 && (
          <span className="shrink-0 text-[10px] font-bold text-ink3">
            {sesiones.length} sesiones
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-ink line-clamp-2">{plan.title}</div>
      <div className="text-[10px] text-ink3 mt-1 uppercase tracking-wider font-medium">
        {plan.subject} · {plan.grade}
      </div>
      {plan.grupo && (
        <div className="text-xs text-violet mt-0.5">{plan.grupo}</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Draggable: entrada ya agendada (puede moverse a otro día)
// ─────────────────────────────────────────────────────────────────────────────
function DraggableEntry({
  entry,
  onDelete,
  onEdit,
  onView,
}: {
  entry: AgendaEntryWithPlan
  onDelete: (id: string) => void
  onEdit: (entry: AgendaEntryWithPlan) => void
  onView: (entry: AgendaEntryWithPlan) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    data: { type: 'entry', entry },
  })
  const colors = {
    clase: 'bg-violet/10 border-violet text-violet',
    unidad: 'bg-amber-50 border-amber-600 text-amber-600',
    rubrica: 'bg-rose-50 border-rose-600 text-rose-600',
    adaptacion: 'bg-teal-50 border-teal-600 text-teal-600',
    diagnostica: 'bg-teal-50 border-teal-600 text-teal-600'
  }[entry.planificacion?.type || 'clase'] || 'bg-violet/10 border-violet text-violet'

  const borderClass = colors.split(' ').find(c => c.startsWith('border-')) || 'border-violet'
  const bgClass = colors.split(' ').find(c => c.startsWith('bg-')) || 'bg-violet/10'
  const textClass = colors.split(' ').find(c => c.startsWith('text-')) || 'text-violet'

  return (
    <div
      ref={setNodeRef}
      className={`
        group ${bgClass} border-l-2 ${borderClass} rounded p-2 mb-1.5 transition-shadow hover:shadow-xs
        ${isDragging ? 'opacity-40' : ''}
      `}
    >
      <div className="flex items-start gap-1">
        <div
          {...listeners}
          {...attributes}
          onDoubleClick={() => onView(entry)}
          className="flex-1 cursor-grab active:cursor-grabbing min-w-0"
          title="Doble clic para ver detalle"
        >
          {entry.sesion_numero != null && (() => {
            const sesArr = (entry.planificacion?.metadata?.sesiones || []) as Sesion[]
            const total = sesArr.length || null
            return (
              <div className={`inline-block text-[9px] font-bold uppercase rounded px-1 py-0.5 mb-1 ${textClass} bg-white/60 border border-current/20`}>
                Sesión {entry.sesion_numero}{total ? `/${total}` : ''}
              </div>
            )
          })()}
          <div className="text-xs font-semibold text-ink line-clamp-2">
            {(() => {
              const sesArr = (entry.planificacion?.metadata?.sesiones || []) as Sesion[]
              const sesActual = entry.sesion_numero != null
                ? sesArr.find(s => s.numero === entry.sesion_numero)
                : null
              return sesActual?.tema || entry.planificacion?.title || 'Sin título'
            })()}
          </div>
          <div className="text-[10px] text-ink3 mt-0.5">
            {entry.planificacion?.subject}
            {entry.grupo ? ` · ${entry.grupo}` : ''}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onView(entry)}
            className="text-ink3 hover:text-violet p-0.5"
            title="Ver detalle de la sesión"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={() => onEdit(entry)}
            className="text-ink3 hover:text-violet p-0.5"
            title="Editar grupo / notas"
          >
            <FileText className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-ink3 hover:text-rose p-0.5"
            title="Quitar del calendario"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Droppable: celda de día
// ─────────────────────────────────────────────────────────────────────────────
function DayCell({
  fecha,
  nombre,
  entries,
  onDelete,
  onEdit,
  onView,
}: {
  fecha: string
  nombre: string
  entries: AgendaEntryWithPlan[]
  onDelete: (id: string) => void
  onEdit: (entry: AgendaEntryWithPlan) => void
  onView: (entry: AgendaEntryWithPlan) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day:${fecha}`,
    data: { type: 'day', fecha },
  })
  return (
    <div
      ref={setNodeRef}
      className={`
        border border-line rounded-lg p-2 min-h-[200px] bg-white transition
        ${isOver ? 'bg-violet/5 border-violet ring-2 ring-violet/30' : ''}
      `}
    >
      <div className="text-xs font-bold text-ink2 mb-2 pb-1 border-b border-line">
        {nombre}
      </div>
      <div>
        {entries.length === 0 ? (
          <div className="text-[10px] text-ink3 italic text-center py-4">
            Arrastra aquí
          </div>
        ) : (
          entries.map(e => (
            <DraggableEntry key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} onView={onView} />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client
// ─────────────────────────────────────────────────────────────────────────────
export function CalendarioClient({
  planificaciones,
  subjectDaysMap = {},
}: {
  planificaciones: Planificacion[]
  subjectDaysMap?: Record<string, number[]>
}) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [entries, setEntries] = useState<AgendaEntryWithPlan[]>([])
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState<string>('')
  const [filterGrupo, setFilterGrupo] = useState<string>('')
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [editEntry, setEditEntry] = useState<AgendaEntryWithPlan | null>(null)
  const [viewEntry, setViewEntry] = useState<AgendaEntryWithPlan | null>(null)
  // Modal para asignar las N sesiones de una planificación a días específicos.
  const [sesionesModal, setSesionesModal] = useState<{
    plan: Planificacion
    sesiones: Sesion[]
    fechaInicial: string  // día donde se soltó
  } | null>(null)
  const [_, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // 7 días de la semana actual
  const days = useMemo(() => {
    const arr: { fecha: string; nombre: string; date: Date }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      arr.push({
        fecha: ymd(d),
        nombre: `${DIAS[i]} ${fmtFechaCorta(d)}`,
        date: d,
      })
    }
    return arr
  }, [weekStart])

  const desde = days[0].fecha
  const hasta = days[6].fecha

  // Cargar entradas del rango
  const reload = async () => {
    const [valAsig, valGrado] = filterSubject.includes('|') 
      ? filterSubject.split('|') 
      : [filterSubject, null]
      
    const data = await listarRango({
      desde,
      hasta,
      grupo: filterGrupo || null,
      asignatura: valAsig || null,
      grado: valGrado || null
    })
    setEntries(data)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, filterSubject, filterGrupo])

  // Asignaturas y grados disponibles para filtros
  const filterOptions = useMemo(() => {
    const s = new Map<string, string>() // value -> label
    planificaciones.forEach(p => {
      if (p.subject && p.grade) {
        const value = `${p.subject}|${p.grade}`
        const label = `${p.subject} (${p.grade})`
        s.set(value, label)
      } else if (p.subject) {
        s.set(p.subject, p.subject)
      }
    })
    return Array.from(s.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [planificaciones])

  const grupos = useMemo(() => {
    const s = new Set<string>()
    planificaciones.forEach(p => p.grupo && s.add(p.grupo))
    entries.forEach(e => e.grupo && s.add(e.grupo))
    return Array.from(s).sort()
  }, [planificaciones, entries])

  // Filtrado del sidebar (solo búsqueda + asignatura).
  // El filtro "Grupo" NO aplica al sidebar — el grupo se asigna por entrada
  // del calendario, no por planificación. Aplica solo al calendario.
  const planesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    const [valAsig, valGrado] = filterSubject.includes('|') 
      ? filterSubject.split('|') 
      : [filterSubject, null]

    return planificaciones.filter(p => {
      if (valAsig && p.subject !== valAsig) return false
      if (valGrado && p.grade !== valGrado) return false
      
      if (q) {
        const hay =
          p.title.toLowerCase().includes(q) ||
          p.subject.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q)
        if (!hay) return false
      }
      return true
    })
  }, [planificaciones, search, filterSubject])

  // Agrupar entradas por fecha
  const entriesByDate = useMemo(() => {
    const m = new Map<string, AgendaEntryWithPlan[]>()
    entries.forEach(e => {
      const arr = m.get(e.fecha_inicio) || []
      arr.push(e)
      m.set(e.fecha_inicio, arr)
    })
    return m
  }, [entries])

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onDragStart = (e: DragStartEvent) => {
    setActiveDrag(e.active.data.current)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = e
    if (!over) return
    const overData: any = over.data.current
    const activeData: any = active.data.current
    if (overData?.type !== 'day') return
    const fecha = overData.fecha as string

    if (activeData?.type === 'plan') {
      const plan: Planificacion = activeData.plan
      const sesiones = getSesiones(plan)

      // Si tiene >1 sesiones, abrir modal para distribuir en días
      if (sesiones.length > 1) {
        setSesionesModal({ plan, sesiones, fechaInicial: fecha })
        return
      }

      // Sesión única (o plan viejo sin sesiones[]): comportamiento directo
      const tempId = `tmp-${Date.now()}`
      setEntries(prev => [
        ...prev,
        {
          id: tempId,
          user_id: '',
          planificacion_id: plan.id,
          fecha_inicio: fecha,
          fecha_fin: null,
          grupo: plan.grupo ?? null,
          notas: null,
          sesion_numero: sesiones.length === 1 ? sesiones[0].numero : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          planificacion: {
            id: plan.id,
            title: plan.title,
            subject: plan.subject,
            grade: plan.grade,
            topic: plan.topic,
            type: plan.type,
            grupo: plan.grupo,
            metadata: plan.metadata,
          },
        },
      ])
      const res = await agendarPlanificacion({
        planificacionId: plan.id,
        fechaInicio: fecha,
        grupo: plan.grupo ?? null,
        sesionNumero: sesiones.length === 1 ? sesiones[0].numero : null,
      })
      if (!res.ok) {
        alert('Error al agendar: ' + (res.error || 'desconocido'))
        setEntries(prev => prev.filter(e => e.id !== tempId))
      } else {
        startTransition(() => reload())
      }
      return
    }

    if (activeData?.type === 'entry') {
      const entry: AgendaEntryWithPlan = activeData.entry
      if (entry.fecha_inicio === fecha) return
      // Optimistic move
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, fecha_inicio: fecha } : e))
      const res = await moverEntrada({ entryId: entry.id, fechaInicio: fecha })
      if (!res.ok) {
        alert('Error al mover: ' + (res.error || 'desconocido'))
        startTransition(() => reload())
      }
      return
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm('¿Quitar esta planificación del calendario? (No se borra del historial)')) return
    setEntries(prev => prev.filter(e => e.id !== entryId))
    const res = await desagendarEntrada(entryId)
    if (!res.ok) {
      alert('Error: ' + res.error)
      startTransition(() => reload())
    }
  }

  const handleEditSave = async (grupo: string, notas: string) => {
    if (!editEntry) return
    const id = editEntry.id
    setEntries(prev => prev.map(e => e.id === id ? { ...e, grupo, notas } : e))
    setEditEntry(null)
    const res = await actualizarEntrada({ entryId: id, grupo: grupo || null, notas: notas || null })
    if (!res.ok) {
      alert('Error: ' + res.error)
      startTransition(() => reload())
    }
  }

  // ── Navegación de semanas ──────────────────────────────────────────────────
  const moveWeek = (delta: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
  }

  const goToday = () => setWeekStart(getMonday(new Date()))

  const exportPDF = () => {
    const params = new URLSearchParams({ desde, hasta })
    const [valAsig, valGrado] = filterSubject.includes('|') 
      ? filterSubject.split('|') 
      : [filterSubject, null]

    if (filterGrupo) params.set('grupo', filterGrupo)
    if (valAsig) params.set('asignatura', valAsig)
    if (valGrado) params.set('grado', valGrado)
    
    window.open(`/api/calendario/export-pdf?${params.toString()}`, '_blank')
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* ── Sidebar: planificaciones ─────────────────────────────────── */}
        <aside className="bg-bg2 border border-line rounded-xl p-3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
          <h3 className="text-sm font-bold text-ink mb-2">Mis planificaciones</h3>

          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-ink3" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-line rounded-md bg-white"
            />
          </div>

          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="w-full mb-2 px-2 py-1.5 text-xs border border-line rounded-md bg-white"
          >
            <option value="">Todas las asignaturas</option>
            {filterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="text-[10px] text-ink3 uppercase mb-1">
            {planesFiltrados.length} disponible{planesFiltrados.length !== 1 ? 's' : ''}
          </div>
          <div className="text-[10px] text-ink3 italic mb-3 leading-tight">
            El sidebar muestra todas tus planificaciones. El "grupo" se asigna al arrastrar al calendario.
          </div>

          {planesFiltrados.length === 0 ? (
            <div className="text-xs text-ink3 italic p-4 text-center">
              No hay planificaciones con esos filtros.
            </div>
          ) : (
            planesFiltrados.map(p => <DraggablePlan key={p.id} plan={p} />)
          )}
        </aside>

        {/* ── Vista semanal ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => moveWeek(-1)}
                className="p-1.5 rounded-md border border-line bg-white hover:bg-bg2"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-xs rounded-md border border-line bg-white hover:bg-bg2"
              >
                Hoy
              </button>
              <button
                onClick={() => moveWeek(1)}
                className="p-1.5 rounded-md border border-line bg-white hover:bg-bg2"
                title="Semana siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="ml-2 text-sm font-semibold text-ink flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-violet" />
                {fmtFechaLarga(days[0].date)} — {fmtFechaLarga(days[6].date)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {grupos.length > 0 && (
                <select
                  value={filterGrupo}
                  onChange={e => setFilterGrupo(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-line rounded-md bg-white"
                  title="Filtrar el calendario por grupo"
                >
                  <option value="">Todos los grupos</option>
                  {grupos.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
              <button
                onClick={exportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-violet text-white hover:bg-violet/90"
              >
                <Printer className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
            </div>
          </div>

          {/* ── Tabs por materia/curso ─────────────────────────────────── */}
          {filterOptions.length > 0 && (
            <div className="mb-3 flex items-center gap-1 overflow-x-auto pb-1 border-b border-line">
              <button
                onClick={() => setFilterSubject('')}
                className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-t-md border-b-2 transition ${
                  filterSubject === ''
                    ? 'border-violet text-violet bg-violet/5'
                    : 'border-transparent text-ink3 hover:text-ink hover:bg-bg2'
                }`}
              >
                Todas ({entries.length})
              </button>
              {filterOptions.map(opt => {
                const [s, g] = opt.value.split('|')
                const count = entries.filter(e => 
                  e.planificacion?.subject === s && (!g || e.planificacion?.grade === g)
                ).length
                const active = filterSubject === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFilterSubject(opt.value)}
                    className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-t-md border-b-2 transition ${
                      active
                        ? 'border-violet text-violet bg-violet/5'
                        : 'border-transparent text-ink3 hover:text-ink hover:bg-bg2'
                    }`}
                  >
                    {opt.label} {count > 0 && <span className="opacity-60">({count})</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2">
            {days.map(d => (
              <DayCell
                key={d.fecha}
                fecha={d.fecha}
                nombre={d.nombre}
                entries={entriesByDate.get(d.fecha) || []}
                onDelete={handleDelete}
                onEdit={setEditEntry}
                onView={setViewEntry}
              />
            ))}
          </div>
        </section>
      </div>

      <DragOverlay>
        {activeDrag?.type === 'plan' && (
          <div className="bg-white border-2 border-violet rounded-lg p-3 shadow-lg max-w-[260px]">
            <div className="text-sm font-semibold">{activeDrag.plan.title}</div>
            <div className="text-xs text-ink3 mt-1">{activeDrag.plan.subject}</div>
          </div>
        )}
        {activeDrag?.type === 'entry' && (
          <div className="bg-violet/20 border-2 border-violet rounded p-2 shadow-lg max-w-[200px]">
            <div className="text-xs font-semibold">
              {activeDrag.entry.planificacion?.title}
            </div>
          </div>
        )}
      </DragOverlay>

      {/* ── Modal: ver detalle de una sesión / planificación ─────────── */}
      {viewEntry && (
        <VerSesionModal entry={viewEntry} onClose={() => setViewEntry(null)} />
      )}

      {/* ── Modal: asignar N sesiones a días ──────────────────────────── */}
      {sesionesModal && (
        <AsignarSesionesModal
          plan={sesionesModal.plan}
          sesiones={sesionesModal.sesiones}
          fechaInicial={sesionesModal.fechaInicial}
          weekStart={weekStart}
          subjectDays={subjectDaysMap[sesionesModal.plan.subject] || []}
          onCancel={() => setSesionesModal(null)}
          onConfirm={async (asignaciones, grupo) => {
            const planId = sesionesModal.plan.id
            const planSnap = sesionesModal.plan
            setSesionesModal(null)
            // Optimistic: agregar N entradas temporales
            const tempEntries: AgendaEntryWithPlan[] = asignaciones.map((a, i) => ({
              id: `tmp-${Date.now()}-${i}`,
              user_id: '',
              planificacion_id: planId,
              fecha_inicio: a.fechaInicio,
              fecha_fin: null,
              grupo: grupo || null,
              notas: null,
              sesion_numero: a.sesionNumero,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              planificacion: {
                id: planSnap.id,
                title: planSnap.title,
                subject: planSnap.subject,
                grade: planSnap.grade,
                topic: planSnap.topic,
                type: planSnap.type,
                grupo: planSnap.grupo,
                metadata: planSnap.metadata,
              },
            }))
            setEntries(prev => [...prev, ...tempEntries])
            const res = await agendarSesionesMultiples({
              planificacionId: planId,
              asignaciones,
              grupo: grupo || null,
            })
            if (!res.ok) {
              alert('Error al agendar sesiones: ' + (res.error || ''))
              setEntries(prev => prev.filter(e => !tempEntries.some(t => t.id === e.id)))
            } else {
              startTransition(() => reload())
            }
          }}
        />
      )}

      {/* ── Modal editar entrada ──────────────────────────────────────── */}
      {editEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">Editar entrada</h3>
              <button onClick={() => setEditEntry(null)} className="text-ink3 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-ink2 mb-3">
              {editEntry.planificacion?.title}
            </div>
            <EditEntryForm entry={editEntry} onSave={handleEditSave} onCancel={() => setEditEntry(null)} />
          </div>
        </div>
      )}
    </DndContext>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function EditEntryForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: AgendaEntryWithPlan
  onSave: (grupo: string, notas: string) => void
  onCancel: () => void
}) {
  const [grupo, setGrupo] = useState(entry.grupo || '')
  const [notas, setNotas] = useState(entry.notas || '')
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-ink2 mb-1">
          Grupo / Curso (ej: 5to A — Colegio San José)
        </label>
        <input
          type="text"
          value={grupo}
          onChange={e => setGrupo(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-line rounded-md"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink2 mb-1">Notas</label>
        <textarea
          rows={3}
          value={notas}
          onChange={e => setNotas(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-line rounded-md"
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-line rounded-md hover:bg-bg2"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(grupo, notas)}
          className="px-3 py-1.5 text-xs bg-violet text-white rounded-md hover:bg-violet/90"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: asignar N sesiones a días específicos de la semana
// ─────────────────────────────────────────────────────────────────────────────
function AsignarSesionesModal({
  plan,
  sesiones,
  fechaInicial,
  weekStart,
  subjectDays,
  onCancel,
  onConfirm,
}: {
  plan: Planificacion
  sesiones: Sesion[]
  fechaInicial: string  // YYYY-MM-DD del día donde se soltó
  weekStart: Date
  subjectDays: number[]  // 1=Lun..7=Dom
  onCancel: () => void
  onConfirm: (
    asignaciones: Array<{ sesionNumero: number; fechaInicio: string }>,
    grupo: string,
  ) => void
}) {
  // Generar 7 días de la semana actual
  const days = useMemo(() => {
    const arr: { fecha: string; label: string; dow: number }[] = []
    const dnames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      arr.push({
        fecha: ymd(d),
        label: `${dnames[i]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        dow: i + 1,
      })
    }
    return arr
  }, [weekStart])

  // Pre-asignar sesiones a días sugeridos:
  // 1. Si subjectDays[] tiene exactamente N días, mapear directo en orden.
  // 2. Si subjectDays tiene más/menos, usar los primeros N o los disponibles.
  // 3. Si vacío, repartir desde fechaInicial → siguientes días hábiles.
  const initialAssignments = useMemo(() => {
    const result: Record<number, string> = {}
    if (subjectDays.length >= sesiones.length) {
      // Hay suficientes días configurados — usar los primeros N.
      const sorted = [...subjectDays].sort()
      sesiones.forEach((s, i) => {
        const dow = sorted[i]
        const day = days.find(d => d.dow === dow)
        if (day) result[s.numero] = day.fecha
      })
    } else if (subjectDays.length > 0) {
      // Algunos configurados — los primeros van a esos, el resto al día inicial
      const sorted = [...subjectDays].sort()
      sesiones.forEach((s, i) => {
        const dow = sorted[i] ?? 0
        const day = days.find(d => d.dow === dow) || days.find(d => d.fecha === fechaInicial) || days[0]
        result[s.numero] = day.fecha
      })
    } else {
      // Sin configuración — empezar en fechaInicial y avanzar día a día (saltando fines de semana si es posible)
      const startIdx = days.findIndex(d => d.fecha === fechaInicial)
      const base = startIdx >= 0 ? startIdx : 0
      sesiones.forEach((s, i) => {
        let idx = (base + i) % 7
        // Saltar Sáb/Dom si hay días hábiles disponibles
        if (sesiones.length <= 5 && (days[idx].dow === 6 || days[idx].dow === 7)) {
          idx = (idx + (8 - days[idx].dow)) % 7
        }
        result[s.numero] = days[idx].fecha
      })
    }
    return result
  }, [sesiones, subjectDays, days, fechaInicial])

  const [assignments, setAssignments] = useState<Record<number, string>>(initialAssignments)
  const [grupo, setGrupo] = useState<string>(plan.grupo || '')

  const allAssigned = sesiones.every(s => !!assignments[s.numero])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold">
            Distribuir {sesiones.length} sesiones
          </h3>
          <button onClick={onCancel} className="text-ink3 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-ink2 mb-1 font-semibold">{plan.title}</div>
        <div className="text-xs text-ink3 mb-4">
          {plan.subject} · {plan.grade}
          {subjectDays.length > 0 && (
            <span className="ml-2">
              · Días configurados: {subjectDays.map(d => ['L','M','X','J','V','S','D'][d-1]).join(' ')}
            </span>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-ink2 mb-1">
            Grupo / Curso (opcional)
          </label>
          <input
            type="text"
            value={grupo}
            onChange={e => setGrupo(e.target.value)}
            placeholder="Ej: 5to A — Colegio San José"
            className="w-full px-3 py-2 text-sm border border-line rounded-md"
          />
        </div>

        <div className="space-y-2 mb-4">
            {sesiones.map(s => {
              const typeColor = {
                clase: 'bg-violet',
                unidad: 'bg-amber-600',
                rubrica: 'bg-rose-600',
                adaptacion: 'bg-teal-600',
                diagnostica: 'bg-teal-600'
              }[plan.type] || 'bg-violet'
              
              return (
                <div
                  key={s.numero}
                  className="flex items-center gap-2 p-2 rounded-lg border border-line bg-bg2"
                >
                  <div className={`shrink-0 text-[10px] font-bold ${typeColor} text-white rounded px-2 py-0.5`}>
                    Sesión {s.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-ink line-clamp-1">{s.tema}</div>
                    <div className="text-[10px] text-ink3">{s.duracion_min} min</div>
                  </div>
                  <select
                    value={assignments[s.numero] || ''}
                    onChange={e =>
                      setAssignments(prev => ({ ...prev, [s.numero]: e.target.value }))
                    }
                    className="shrink-0 px-2 py-1 text-xs border border-line rounded-md bg-white"
                  >
                    <option value="">— día —</option>
                    {days.map(d => (
                      <option key={d.fecha} value={d.fecha}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-line">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs border border-line rounded-md hover:bg-bg2"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const asignaciones = sesiones
                .filter(s => assignments[s.numero])
                .map(s => ({ sesionNumero: s.numero, fechaInicio: assignments[s.numero] }))
              onConfirm(asignaciones, grupo.trim())
            }}
            disabled={!allAssigned}
            className="px-3 py-1.5 text-xs bg-violet text-white rounded-md hover:bg-violet/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Agendar {sesiones.length} sesiones
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: ver detalle de la sesión (markdown extraído de la planificación)
// ─────────────────────────────────────────────────────────────────────────────
function VerSesionModal({
  entry,
  onClose,
}: {
  entry: AgendaEntryWithPlan
  onClose: () => void
}) {
  const plan = entry.planificacion
  const sesArr = (plan?.metadata?.sesiones || []) as Sesion[]
  const total = sesArr.length || null
  const sesActual = entry.sesion_numero != null
    ? sesArr.find(s => s.numero === entry.sesion_numero)
    : null
  // Extraer solo la sección de esta sesión del markdown completo
  const markdown = extractSesionMarkdown(plan?.content || '', entry.sesion_numero)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-line">
          <div className="min-w-0 flex-1">
            {entry.sesion_numero != null && (
              <div className="inline-block text-[10px] font-bold uppercase bg-violet text-white rounded px-2 py-0.5 mb-1.5">
                Sesión {entry.sesion_numero}{total ? `/${total}` : ''}
              </div>
            )}
            <h3 className="font-display text-lg font-bold leading-tight">
              {sesActual?.tema || plan?.title || 'Sin título'}
            </h3>
            <div className="text-xs text-ink3 mt-1">
              {plan?.subject}
              {plan?.grade ? ` · ${plan.grade}` : ''}
              {sesActual?.duracion_min ? ` · ${sesActual.duracion_min} min` : ''}
              {entry.grupo ? ` · Grupo: ${entry.grupo}` : ''}
            </div>
            {entry.notas && (
              <div className="mt-2 text-xs text-ink2 italic bg-amber/10 p-2 rounded-md">
                Notas: {entry.notas}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {plan?.id && (
              <Link
                href={`/dashboard/historial/${plan.id}`}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-line hover:bg-bg2"
                title="Abrir planificación completa"
              >
                <ExternalLink className="w-3 h-3" />
                Ver completa
              </Link>
            )}
            <button onClick={onClose} className="text-ink3 hover:text-ink p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 flex-1">
          {markdown ? (
            <div className="prose prose-sm max-w-none">
              <MarkdownRenderer content={markdown} />
            </div>
          ) : (
            <div className="text-sm text-ink3 italic">
              No hay contenido disponible para esta sesión.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
