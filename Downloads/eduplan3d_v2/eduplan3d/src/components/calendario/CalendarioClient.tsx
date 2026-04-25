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
} from 'lucide-react'
import {
  agendarPlanificacion,
  moverEntrada,
  desagendarEntrada,
  listarRango,
  actualizarEntrada,
  type AgendaEntryWithPlan,
} from '@/lib/actions/calendario'

// ─────────────────────────────────────────────────────────────────────────────
type Planificacion = {
  id: string
  title: string
  subject: string
  grade: string
  topic: string
  type: string
  grupo?: string | null
  created_at: string
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
      <div className="text-sm font-semibold text-ink line-clamp-2">{plan.title}</div>
      <div className="text-xs text-ink3 mt-1">
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
}: {
  entry: AgendaEntryWithPlan
  onDelete: (id: string) => void
  onEdit: (entry: AgendaEntryWithPlan) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    data: { type: 'entry', entry },
  })
  return (
    <div
      ref={setNodeRef}
      className={`
        group bg-violet/10 border-l-2 border-violet rounded p-2 mb-1.5
        ${isDragging ? 'opacity-40' : ''}
      `}
    >
      <div className="flex items-start gap-1">
        <div
          {...listeners}
          {...attributes}
          className="flex-1 cursor-grab active:cursor-grabbing min-w-0"
        >
          <div className="text-xs font-semibold text-ink line-clamp-2">
            {entry.planificacion?.title || 'Sin título'}
          </div>
          <div className="text-[10px] text-ink3 mt-0.5">
            {entry.planificacion?.subject}
            {entry.grupo ? ` · ${entry.grupo}` : ''}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onEdit(entry)}
            className="text-ink3 hover:text-violet p-0.5"
            title="Editar"
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
}: {
  fecha: string
  nombre: string
  entries: AgendaEntryWithPlan[]
  onDelete: (id: string) => void
  onEdit: (entry: AgendaEntryWithPlan) => void
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
            <DraggableEntry key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client
// ─────────────────────────────────────────────────────────────────────────────
export function CalendarioClient({ planificaciones }: { planificaciones: Planificacion[] }) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [entries, setEntries] = useState<AgendaEntryWithPlan[]>([])
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState<string>('')
  const [filterGrupo, setFilterGrupo] = useState<string>('')
  const [activeDrag, setActiveDrag] = useState<any>(null)
  const [editEntry, setEditEntry] = useState<AgendaEntryWithPlan | null>(null)
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
    const data = await listarRango({
      desde,
      hasta,
      grupo: filterGrupo || null,
      asignatura: filterSubject || null,
    })
    setEntries(data)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, filterSubject, filterGrupo])

  // Asignaturas y grupos disponibles para filtros
  const subjects = useMemo(() => {
    const s = new Set<string>()
    planificaciones.forEach(p => p.subject && s.add(p.subject))
    return Array.from(s).sort()
  }, [planificaciones])

  const grupos = useMemo(() => {
    const s = new Set<string>()
    planificaciones.forEach(p => p.grupo && s.add(p.grupo))
    entries.forEach(e => e.grupo && s.add(e.grupo))
    return Array.from(s).sort()
  }, [planificaciones, entries])

  // Filtrado del sidebar (solo planificaciones)
  const planesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return planificaciones.filter(p => {
      if (filterSubject && p.subject !== filterSubject) return false
      if (filterGrupo && p.grupo !== filterGrupo) return false
      if (q) {
        const hay =
          p.title.toLowerCase().includes(q) ||
          p.subject.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q)
        if (!hay) return false
      }
      return true
    })
  }, [planificaciones, search, filterSubject, filterGrupo])

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
      // Optimistic: agregar entrada temporal
      const plan: Planificacion = activeData.plan
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
          },
        },
      ])
      const res = await agendarPlanificacion({
        planificacionId: plan.id,
        fechaInicio: fecha,
        grupo: plan.grupo ?? null,
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
    if (filterGrupo) params.set('grupo', filterGrupo)
    if (filterSubject) params.set('asignatura', filterSubject)
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
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {grupos.length > 0 && (
            <select
              value={filterGrupo}
              onChange={e => setFilterGrupo(e.target.value)}
              className="w-full mb-3 px-2 py-1.5 text-xs border border-line rounded-md bg-white"
            >
              <option value="">Todos los grupos</option>
              {grupos.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}

          <div className="text-[10px] text-ink3 uppercase mb-1">
            {planesFiltrados.length} disponible{planesFiltrados.length !== 1 ? 's' : ''}
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
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-violet text-white hover:bg-violet/90"
            >
              <Printer className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2">
            {days.map(d => (
              <DayCell
                key={d.fecha}
                fecha={d.fecha}
                nombre={d.nombre}
                entries={entriesByDate.get(d.fecha) || []}
                onDelete={handleDelete}
                onEdit={setEditEntry}
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
