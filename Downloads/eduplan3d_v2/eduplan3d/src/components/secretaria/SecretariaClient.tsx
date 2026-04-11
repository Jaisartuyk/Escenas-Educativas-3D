'use client'

import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus, Check, Clock, AlertTriangle, X, Search,
  DollarSign, Users, TrendingUp, CalendarDays,
  ChevronDown, Filter, Trash2, CreditCard,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
function getPaymentStatus(p: any): 'pagado' | 'atrasado' | 'proximo' | 'pendiente' {
  if (p.status === 'pagado') return 'pagado'
  if (!p.due_date) return 'pendiente'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(p.due_date + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'atrasado'
  if (diffDays <= 5) return 'proximo'
  return 'pendiente'
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)
}

const STATUS_CONFIG = {
  pagado:    { label: 'PAGADO',    icon: Check,          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: '#10b981' },
  proximo:   { label: 'POR VENCER', icon: Clock,          bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   dot: '#f59e0b' },
  atrasado:  { label: 'ATRASADO',  icon: AlertTriangle,  bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200',    dot: '#ef4444' },
  pendiente: { label: 'PENDIENTE', icon: CalendarDays,   bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',   dot: '#94a3b8' },
}

// ─── Componente principal ────────────────────────────────────────────────────
export function SecretariaClient({ institutionId, students, courses, enrollments, initialPayments }: any) {
  const [payments, setPayments]       = useState<any[]>(initialPayments || [])
  const [showForm, setShowForm]       = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterShift, setFilterShift]   = useState<string>('todos')
  const [filterCourse, setFilterCourse] = useState<string>('todos')
  const [searchTerm, setSearchTerm]   = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form state
  const [selectedStudent, setSelectedStudent] = useState('')
  const [newAmount, setNewAmount]     = useState('')
  const [newDesc, setNewDesc]         = useState('')
  const [newDueDate, setNewDueDate]   = useState('')
  const [saving, setSaving]           = useState(false)

  // ── Mappings: student → courses, course → shift ─────────────────────────
  const coursesById = useMemo(() => {
    const map: Record<string, any> = {}
    ;(courses || []).forEach((c: any) => { map[c.id] = c })
    return map
  }, [courses])

  // student_id → [course_id, ...]
  const studentCourses = useMemo(() => {
    const map: Record<string, string[]> = {}
    ;(enrollments || []).forEach((e: any) => {
      if (!map[e.student_id]) map[e.student_id] = []
      map[e.student_id].push(e.course_id)
    })
    return map
  }, [enrollments])

  // Available shifts from courses
  const availableShifts: string[] = useMemo(() =>
    Array.from(new Set((courses || []).map((c: any) => c.shift as string).filter(Boolean))),
    [courses]
  )

  // Courses filtered by selected shift
  const filteredCourses = useMemo(() => {
    if (filterShift === 'todos') return courses || []
    return (courses || []).filter((c: any) => c.shift === filterShift)
  }, [courses, filterShift])

  // Set of student IDs that match shift+course filters
  const allowedStudentIds = useMemo(() => {
    if (filterShift === 'todos' && filterCourse === 'todos') return null // no filter
    const allowedCourseIds = new Set(
      filterCourse !== 'todos'
        ? [filterCourse]
        : filteredCourses.map((c: any) => c.id)
    )
    const ids = new Set<string>()
    ;(enrollments || []).forEach((e: any) => {
      if (allowedCourseIds.has(e.course_id)) ids.add(e.student_id)
    })
    return ids
  }, [filterShift, filterCourse, filteredCourses, enrollments])

  // Reset course filter when shift changes
  const handleShiftChange = (shift: string) => {
    setFilterShift(shift)
    setFilterCourse('todos')
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  const enrichedPayments = useMemo(() =>
    payments.map((p: any) => ({ ...p, computedStatus: getPaymentStatus(p) })),
    [payments]
  )

  const filtered = useMemo(() => {
    let list = enrichedPayments
    // Filter by shift / course
    if (allowedStudentIds !== null) {
      list = list.filter((p: any) => allowedStudentIds.has(p.student_id))
    }
    if (filterStatus !== 'todos') {
      list = list.filter((p: any) => p.computedStatus === filterStatus)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter((p: any) => {
        const student = students.find((s: any) => s.id === p.student_id)
        return (student?.full_name || '').toLowerCase().includes(q) ||
               (p.description || '').toLowerCase().includes(q)
      })
    }
    return list
  }, [enrichedPayments, filterStatus, searchTerm, students, allowedStudentIds])

  const stats = useMemo(() => {
    const all = enrichedPayments
    const pagados  = all.filter((p: any) => p.computedStatus === 'pagado')
    const atrasados = all.filter((p: any) => p.computedStatus === 'atrasado')
    const proximos = all.filter((p: any) => p.computedStatus === 'proximo')
    const pendientes = all.filter((p: any) => p.computedStatus === 'pendiente')

    const totalRecaudado = pagados.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    const totalPendiente = [...atrasados, ...proximos, ...pendientes].reduce((sum: number, p: any) => sum + Number(p.amount), 0)

    return { pagados: pagados.length, atrasados: atrasados.length, proximos: proximos.length, pendientes: pendientes.length, totalRecaudado, totalPendiente }
  }, [enrichedPayments])

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudent || !newAmount || !newDesc) return toast.error('Completa los campos obligatorios')
    setSaving(true)

    const payload = {
      id: uuidv4(),
      institution_id: institutionId,
      student_id: selectedStudent,
      amount: parseFloat(newAmount),
      description: newDesc,
      status: 'pendiente',
      due_date: newDueDate || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setPayments(prev => [payload, ...prev])
    setShowForm(false)
    setSelectedStudent(''); setNewAmount(''); setNewDesc(''); setNewDueDate('')

    const res = await fetch('/api/secretaria/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('Error al generar cobro')
      setPayments(prev => prev.filter(p => p.id !== payload.id))
    } else {
      toast.success('Cobro registrado')
    }
  }

  async function markAsPaid(id: string) {
    const today = new Date().toISOString().split('T')[0]
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'pagado', paid_date: today } : p))

    const res = await fetch('/api/secretaria/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'pagado', paid_date: today }),
    })
    if (!res.ok) toast.error('Error al registrar pago')
    else toast.success('Pago registrado')
  }

  async function handleDelete(id: string) {
    setPayments(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    const res = await fetch(`/api/secretaria/payments?id=${id}`, { method: 'DELETE' })
    if (!res.ok) toast.error('Error al eliminar')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recaudado */}
        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
              <DollarSign size={18} style={{ color: '#10b981' }} />
            </div>
            <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Recaudado</span>
          </div>
          <p className="text-2xl font-display font-bold">{formatMoney(stats.totalRecaudado)}</p>
          <p className="text-xs text-emerald-600 font-medium">{stats.pagados} cobros pagados</p>
        </div>

        {/* Pendiente */}
        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
              <TrendingUp size={18} style={{ color: '#f59e0b' }} />
            </div>
            <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Por cobrar</span>
          </div>
          <p className="text-2xl font-display font-bold">{formatMoney(stats.totalPendiente)}</p>
          <p className="text-xs text-amber-600 font-medium">{stats.pendientes + stats.proximos} pendientes</p>
        </div>

        {/* Atrasados */}
        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            </div>
            <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Atrasados</span>
          </div>
          <p className="text-2xl font-display font-bold text-rose-600">{stats.atrasados}</p>
          <p className="text-xs text-rose-500 font-medium">Requieren atenci&oacute;n</p>
        </div>

        {/* Estudiantes */}
        <div className="bg-surface rounded-2xl border border-surface2 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
              <Users size={18} style={{ color: '#6366f1' }} />
            </div>
            <span className="text-xs font-semibold text-ink3 uppercase tracking-wider">Estudiantes</span>
          </div>
          <p className="text-2xl font-display font-bold">{students.length}</p>
          <p className="text-xs text-indigo-500 font-medium">Registrados</p>
        </div>
      </div>

      {/* ── Alertas semaforizadas ──────────────────────────────────────────── */}
      {(stats.atrasados > 0 || stats.proximos > 0) && (
        <div className="space-y-2">
          {stats.atrasados > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
                {stats.atrasados} pago{stats.atrasados > 1 ? 's' : ''} atrasado{stats.atrasados > 1 ? 's' : ''} — fecha de vencimiento superada
              </span>
            </div>
          )}
          {stats.proximos > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
              <Clock size={16} style={{ color: '#f59e0b' }} />
              <span className="text-sm font-medium" style={{ color: '#d97706' }}>
                {stats.proximos} pago{stats.proximos > 1 ? 's' : ''} pr&oacute;ximo{stats.proximos > 1 ? 's' : ''} a vencer (menos de 5 d&iacute;as)
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden">
        <div className="p-4 space-y-3 border-b border-surface2">
          {/* Row 1: Search + Emitir Cobro */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4" />
              <input
                type="text"
                placeholder="Buscar alumno o concepto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-bg border border-surface2 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-violet/50 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg flex-shrink-0"
              style={{ backgroundColor: '#7C6DFA' }}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Cancelar' : 'Emitir Cobro'}
            </button>
          </div>

          {/* Row 2: Filters — Turno, Curso, Estado */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-ink4" />
            <span className="text-xs font-semibold text-ink4 uppercase tracking-wider mr-1">Filtros:</span>

            {/* Shift filter */}
            {availableShifts.length > 0 && (
              <div className="relative">
                <select
                  value={filterShift}
                  onChange={e => handleShiftChange(e.target.value)}
                  className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:border-violet/50 cursor-pointer"
                >
                  <option value="todos">Todos los turnos</option>
                  {availableShifts.map((s: string) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
              </div>
            )}

            {/* Course filter */}
            <div className="relative">
              <select
                value={filterCourse}
                onChange={e => setFilterCourse(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:border-violet/50 cursor-pointer"
              >
                <option value="todos">Todos los cursos</option>
                {filteredCourses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.parallel || ''} {c.shift ? `(${c.shift})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:border-violet/50 cursor-pointer"
              >
                <option value="todos">Todos los estados</option>
                <option value="pagado">Pagados</option>
                <option value="pendiente">Pendientes</option>
                <option value="proximo">Por vencer</option>
                <option value="atrasado">Atrasados</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
            </div>

            {/* Clear filters */}
            {(filterShift !== 'todos' || filterCourse !== 'todos' || filterStatus !== 'todos') && (
              <button
                onClick={() => { setFilterShift('todos'); setFilterCourse('todos'); setFilterStatus('todos') }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink3 hover:text-ink hover:bg-surface2 transition-colors"
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* ── Create form ─────────────────────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleCreate} className="p-5 border-b border-surface2" style={{ backgroundColor: 'rgba(124,109,250,0.03)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Estudiante</label>
                <select
                  required
                  value={selectedStudent}
                  onChange={e => setSelectedStudent(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
                >
                  <option value="">Seleccione un alumno...</option>
                  {students.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Concepto</label>
                <input
                  required
                  placeholder="Ej: Pensi&oacute;n Abril"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Monto ($)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50"
                />
              </div>
              <div className="lg:col-span-3 flex justify-end items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: '#7C6DFA' }}
                >
                  <CreditCard size={16} />
                  {saving ? 'Guardando...' : 'Registrar Cobro'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Payments list ───────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
              <CreditCard size={28} style={{ color: '#7C6DFA' }} />
            </div>
            <p className="text-ink3 font-medium">No hay registros financieros</p>
            <p className="text-ink4 text-sm mt-1">Emite un cobro para comenzar el seguimiento</p>
          </div>
        ) : (
          <div className="divide-y divide-surface2">
            {filtered.map((p: any) => {
              const student = students.find((s: any) => s.id === p.student_id)
              const sc = STATUS_CONFIG[p.computedStatus as keyof typeof STATUS_CONFIG]
              const Icon = sc.icon
              const isOverdue = p.computedStatus === 'atrasado'
              const isNear = p.computedStatus === 'proximo'

              // Course info from enrollment
              const stuCourseIds = studentCourses[p.student_id] || []
              const stuCourse = stuCourseIds.length > 0 ? coursesById[stuCourseIds[0]] : null

              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-bg/50 transition-colors group">
                  {/* Semaforo dot */}
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />

                  {/* Student + course + concept */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{student?.full_name || 'Estudiante'}</p>
                      {stuCourse && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface2 text-ink3 flex-shrink-0">
                          {stuCourse.name} {stuCourse.parallel || ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink3 truncate">{p.description}</p>
                  </div>

                  {/* Due date */}
                  <div className="hidden sm:block text-right min-w-[100px]">
                    <p className={`text-xs font-medium ${isOverdue ? 'text-rose-600' : isNear ? 'text-amber-600' : 'text-ink4'}`}>
                      {p.due_date ? formatDate(p.due_date) : 'Sin fecha'}
                    </p>
                    {p.paid_date && (
                      <p className="text-[10px] text-emerald-600">Pagado: {formatDate(p.paid_date)}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right min-w-[90px]">
                    <p className="font-display font-bold text-sm">{formatMoney(p.amount)}</p>
                  </div>

                  {/* Status badge */}
                  <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}>
                    <Icon size={12} />
                    {sc.label}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.computedStatus !== 'pagado' && (
                      <button
                        onClick={() => markAsPaid(p.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-emerald-50"
                        title="Marcar como pagado"
                      >
                        <Check size={16} style={{ color: '#10b981' }} />
                      </button>
                    )}
                    {confirmDelete === p.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold text-white"
                          style={{ backgroundColor: '#ef4444' }}
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold text-ink3 bg-surface2"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(p.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-rose-50"
                        title="Eliminar"
                      >
                        <Trash2 size={14} className="text-ink4 hover:text-rose-500" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-surface2 text-xs text-ink4">
            Mostrando {filtered.length} de {payments.length} registros
          </div>
        )}
      </div>
    </div>
  )
}
