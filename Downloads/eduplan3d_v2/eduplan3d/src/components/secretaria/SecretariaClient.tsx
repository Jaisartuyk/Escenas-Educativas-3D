'use client'

import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus, Check, Clock, AlertTriangle, X, Search,
  DollarSign, Users, TrendingUp, CalendarDays,
  ChevronDown, Filter, Trash2, CreditCard, GraduationCap,
  Pencil, Save, Table as TableIcon, LayoutList,
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

const MESES = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr']
const MESES_FULL = ['mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'enero', 'febrero', 'marzo', 'abril']

const STATUS_CONFIG = {
  pagado:    { label: 'PAGADO',     icon: Check,          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: '#10b981' },
  proximo:   { label: 'POR VENCER', icon: Clock,          bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   dot: '#f59e0b' },
  atrasado:  { label: 'ATRASADO',   icon: AlertTriangle,  bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200',    dot: '#ef4444' },
  pendiente: { label: 'PENDIENTE',  icon: CalendarDays,   bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',   dot: '#94a3b8' },
}

const STATUS_CELL: Record<string, string> = {
  pagado:    'bg-emerald-100 text-emerald-800 border-emerald-300',
  proximo:   'bg-amber-100 text-amber-800 border-amber-300',
  atrasado:  'bg-rose-100 text-rose-800 border-rose-300',
  pendiente: 'bg-slate-100 text-slate-600 border-slate-200',
}

// ─── Componente principal ────────────────────────────────────────────────────
export function SecretariaClient({ institutionId, students, courses, enrollments, initialPayments, isTutorMode }: any) {
  const [payments, setPayments]        = useState<any[]>(initialPayments || [])
  const [showForm, setShowForm]        = useState(false)
  const [viewMode, setViewMode]        = useState<'tabla' | 'lista'>('tabla')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterShift, setFilterShift]   = useState<string>('todos')
  const [filterCourse, setFilterCourse] = useState<string>('todos')
  const [filterType, setFilterType]     = useState<string>('todos')
  const [searchTerm, setSearchTerm]    = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form state
  const [selectedStudent, setSelectedStudent] = useState('')
  const [newType, setNewType]         = useState<'matricula' | 'pension' | 'otro'>('pension')
  const [newAmount, setNewAmount]     = useState('60')
  const [newDesc, setNewDesc]         = useState('')
  const [newDueDate, setNewDueDate]   = useState('')
  const [saving, setSaving]           = useState(false)

  // Inline editing
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editAmount, setEditAmount]   = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  // ── Mappings ────────────────────────────────────────────────────────────
  const coursesById = useMemo(() => {
    const map: Record<string, any> = {}
    ;(courses || []).forEach((c: any) => { map[c.id] = c })
    return map
  }, [courses])

  const studentCourses = useMemo(() => {
    const map: Record<string, string[]> = {}
    ;(enrollments || []).forEach((e: any) => {
      if (!map[e.student_id]) map[e.student_id] = []
      map[e.student_id].push(e.course_id)
    })
    return map
  }, [enrollments])

  const availableShifts: string[] = useMemo(() =>
    Array.from(new Set((courses || []).map((c: any) => c.shift as string).filter(Boolean))),
    [courses]
  )

  const filteredCourses = useMemo(() => {
    if (filterShift === 'todos') return courses || []
    return (courses || []).filter((c: any) => c.shift === filterShift)
  }, [courses, filterShift])

  const allowedStudentIds = useMemo(() => {
    if (filterShift === 'todos' && filterCourse === 'todos') return null
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
    if (allowedStudentIds !== null) {
      list = list.filter((p: any) => allowedStudentIds.has(p.student_id))
    }
    if (filterType !== 'todos') {
      list = list.filter((p: any) => p.type === filterType)
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
  }, [enrichedPayments, filterStatus, filterType, searchTerm, students, allowedStudentIds])

  const stats = useMemo(() => {
    const all = enrichedPayments
    const pagados   = all.filter((p: any) => p.computedStatus === 'pagado')
    const atrasados = all.filter((p: any) => p.computedStatus === 'atrasado')
    const proximos  = all.filter((p: any) => p.computedStatus === 'proximo')
    const pendientes = all.filter((p: any) => p.computedStatus === 'pendiente')

    const totalRecaudado = pagados.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    const totalPendiente = [...atrasados, ...proximos, ...pendientes].reduce((sum: number, p: any) => sum + Number(p.amount), 0)

    return { pagados: pagados.length, atrasados: atrasados.length, proximos: proximos.length, pendientes: pendientes.length, totalRecaudado, totalPendiente }
  }, [enrichedPayments])

  // ── Table view: build pivot data (student × month) ──────────────────────
  const tableData = useMemo(() => {
    // Get unique students with payments
    const studentIds = Array.from(new Set(filtered.map((p: any) => p.student_id)))

    return studentIds.map(sid => {
      const student = students.find((s: any) => s.id === sid)
      const stuCourseIds = studentCourses[sid] || []
      const stuCourse = stuCourseIds.length > 0 ? coursesById[stuCourseIds[0]] : null
      const courseLabel = stuCourse ? `${stuCourse.name} ${stuCourse.parallel || ''}`.trim() : ''

      // Student's payments mapped by month
      const studentPayments = filtered.filter((p: any) => p.student_id === sid)
      const matricula = studentPayments.find((p: any) => p.type === 'matricula')

      // Map payments to months
      const monthPayments: Record<string, any> = {}
      studentPayments.filter((p: any) => p.type === 'pension').forEach((p: any) => {
        // Try to match month from description or due_date
        const desc = (p.description || '').toLowerCase()
        let matchedMonth = ''

        for (let i = 0; i < MESES_FULL.length; i++) {
          if (desc.includes(MESES_FULL[i])) {
            matchedMonth = MESES[i]
            break
          }
        }

        // Fallback: use due_date month
        if (!matchedMonth && p.due_date) {
          const d = new Date(p.due_date + 'T00:00:00')
          const monthIdx = d.getMonth() // 0-11
          // Map calendar month to academic month
          const calToAcademic: Record<number, number> = {
            4: 0, 5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 7, 0: 8, 1: 9, 2: 10, 3: 11
          }
          matchedMonth = MESES[calToAcademic[monthIdx] ?? 0]
        }

        if (matchedMonth) {
          monthPayments[matchedMonth] = p
        }
      })

      return {
        studentId: sid,
        name: student?.full_name || 'Estudiante',
        course: courseLabel,
        shift: stuCourse?.shift || '',
        matricula,
        monthPayments,
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered, students, studentCourses, coursesById])

  // Group tableData by shift
  const tableByShift = useMemo(() => {
    const groups: Record<string, typeof tableData> = {}
    tableData.forEach(row => {
      const shift = row.shift || 'SIN JORNADA'
      if (!groups[shift]) groups[shift] = []
      groups[shift].push(row)
    })
    // Sort: MATUTINA first, then VESPERTINA, then others
    const order = ['MATUTINA', 'VESPERTINA']
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    return sorted
  }, [tableData])

  // ── Actions ──────────────────────────────────────────────────────────────
  function handleCellClick(studentId: string, type: 'matricula' | 'pension', month?: string) {
    if (isTutorMode) return
    
    setSelectedStudent(studentId)
    setNewType(type)
    
    const student = students.find((s: any) => s.id === studentId)
    const stuCIds = studentCourses[studentId] || []
    const stuCourse = stuCIds.length > 0 ? coursesById[stuCIds[0]] : null
    const courseLabel = stuCourse ? `${stuCourse.name} ${stuCourse.parallel || ''}`.trim() : ''

    if (type === 'matricula') {
      setNewAmount('35')
      setNewDesc(`Matricula ${new Date().getFullYear()}${courseLabel ? ` — ${courseLabel}` : ''}`)
      const today = new Date()
      setNewDueDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15).toISOString().split('T')[0])
    } else if (type === 'pension' && month) {
      setNewAmount('60')
      const monthIdx = MESES.indexOf(month)
      const academicMonths = [4, 5, 6, 7, 8, 9, 10, 11, 0, 1]
      const targetMonth = academicMonths[monthIdx]
      const year = new Date().getFullYear()
      const pensionYear = targetMonth < 4 ? year + 1 : year
      const due = new Date(pensionYear, targetMonth, 5)
      
      setNewDesc(`Pension ${due.toLocaleString('es-ES', { month: 'long' })} ${pensionYear}${courseLabel ? ` — ${courseLabel}` : ''}`)
      setNewDueDate(due.toISOString().split('T')[0])
    }
    
    setShowForm(true)
    // Scroll to form
    setTimeout(() => {
      window.scrollTo({ top: 300, behavior: 'smooth' })
    }, 100)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudent || !newAmount) return toast.error('Completa los campos obligatorios')

    const student = students.find((s: any) => s.id === selectedStudent)
    const stuCIds = studentCourses[selectedStudent] || []
    const stuCourse = stuCIds.length > 0 ? coursesById[stuCIds[0]] : null
    const courseLabel = stuCourse ? `${stuCourse.name} ${stuCourse.parallel || ''}`.trim() : ''

    const desc = newDesc.trim() || (
      newType === 'matricula'
        ? `Matricula ${new Date().getFullYear()}${courseLabel ? ` — ${courseLabel}` : ''}`
        : newType === 'pension'
        ? `Pension${courseLabel ? ` — ${courseLabel}` : ''}`
        : 'Cobro adicional'
    )

    setSaving(true)
    const payload = {
      id: uuidv4(),
      institution_id: institutionId,
      student_id: selectedStudent,
      amount: parseFloat(newAmount),
      description: desc,
      type: newType,
      status: 'pendiente',
      due_date: newDueDate || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setPayments(prev => [payload, ...prev])
    setShowForm(false)
    setSelectedStudent(''); setNewAmount(''); setNewDesc(''); setNewDueDate(''); setNewType('pension')

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

  function startEdit(p: any) {
    setEditingId(p.id)
    setEditAmount(String(p.amount || ''))
    setEditDueDate(p.due_date || '')
  }

  async function saveEdit(id: string) {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) return toast.error('Monto invalido')

    setPayments(prev => prev.map(p => p.id === id ? { ...p, amount, due_date: editDueDate || p.due_date } : p))
    setEditingId(null)

    const updates: any = { id, amount }
    if (editDueDate) updates.due_date = editDueDate

    const res = await fetch('/api/secretaria/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) toast.error('Error al actualizar')
    else toast.success('Actualizado')
  }

  async function markAsPaid(id: string) {
    if (isTutorMode) return
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

  const [generating, setGenerating] = useState(false)
  async function generateMissing() {
    setGenerating(true)
    try {
      const res = await fetch('/api/secretaria/generate-payments', { method: 'POST' })
      const { generated } = await res.json()
      if (generated > 0) {
        toast.success(`${generated} cobros generados`)
        const r2 = await fetch('/api/secretaria/payments')
        const { data } = await r2.json()
        if (data) setPayments(data)
      } else {
        toast.success('Todos los estudiantes ya tienen cobros')
      }
    } catch { toast.error('Error al generar') }
    finally { setGenerating(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* ── Alertas ─────────────────────────────────────────────────────── */}
      {(stats.atrasados > 0 || stats.proximos > 0) && (
        <div className="space-y-2">
          {stats.atrasados > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
                {stats.atrasados} pago{stats.atrasados > 1 ? 's' : ''} atrasado{stats.atrasados > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {stats.proximos > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
              <Clock size={16} style={{ color: '#f59e0b' }} />
              <span className="text-sm font-medium" style={{ color: '#d97706' }}>
                {stats.proximos} pago{stats.proximos > 1 ? 's' : ''} pr&oacute;ximo{stats.proximos > 1 ? 's' : ''} a vencer
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-surface2 overflow-hidden">
        <div className="p-4 space-y-3 border-b border-surface2">
          {/* Row 1: Search + View toggle + Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-1">
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
              {/* View toggle */}
              <div className="flex items-center bg-bg border border-surface2 rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode('tabla')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === 'tabla' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-ink3 hover:text-ink'
                  }`}
                >
                  <TableIcon size={13} /> Tabla
                </button>
                <button
                  onClick={() => setViewMode('lista')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === 'lista' ? 'bg-violet-100 text-violet-700 shadow-sm' : 'text-ink3 hover:text-ink'
                  }`}
                >
                  <LayoutList size={13} /> Lista
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isTutorMode && (
                <>
                  <button
                    onClick={generateMissing}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-surface2 text-ink3 hover:bg-surface2 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <CalendarDays size={14} />
                    {generating ? 'Generando...' : 'Generar cobros pendientes'}
                  </button>
                  <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg flex-shrink-0"
                    style={{ backgroundColor: '#7C6DFA' }}
                  >
                    {showForm ? <X size={16} /> : <Plus size={16} />}
                    {showForm ? 'Cancelar' : 'Emitir Cobro'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-ink4" />
            <span className="text-xs font-semibold text-ink4 uppercase tracking-wider mr-1">Filtros:</span>

            {availableShifts.length > 0 && (
              <div className="relative">
                <select value={filterShift} onChange={e => handleShiftChange(e.target.value)}
                  className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
                  <option value="todos">Todos los turnos</option>
                  {availableShifts.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
              </div>
            )}

            <div className="relative">
              <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
                <option value="todos">Todos los cursos</option>
                {filteredCourses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.parallel || ''}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
                <option value="todos">Todos los tipos</option>
                <option value="matricula">Matricula</option>
                <option value="pension">Pension</option>
                <option value="otro">Otro</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer">
                <option value="todos">Todos los estados</option>
                <option value="pagado">Pagados</option>
                <option value="pendiente">Pendientes</option>
                <option value="proximo">Por vencer</option>
                <option value="atrasado">Atrasados</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
            </div>

            {(filterShift !== 'todos' || filterCourse !== 'todos' || filterStatus !== 'todos' || filterType !== 'todos') && (
              <button
                onClick={() => { setFilterShift('todos'); setFilterCourse('todos'); setFilterStatus('todos'); setFilterType('todos') }}
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
            <div className="flex gap-2 mb-4">
              {([
                { value: 'matricula', label: 'Matricula', icon: GraduationCap, color: '#6366f1' },
                { value: 'pension',   label: 'Pension',   icon: CalendarDays,   color: '#f59e0b' },
                { value: 'otro',      label: 'Otro',      icon: CreditCard,     color: '#64748b' },
              ] as const).map(({ value, label, icon: Ic, color }) => (
                <button key={value} type="button" onClick={() => { setNewType(value); setNewAmount(value === 'matricula' ? '35' : value === 'pension' ? '60' : '') }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    newType === value ? 'text-white shadow-md' : 'bg-bg border-surface2 text-ink3 hover:border-ink4'
                  }`}
                  style={newType === value ? { backgroundColor: color, borderColor: color } : {}}>
                  <Ic size={14} /> {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Estudiante</label>
                <select required value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50">
                  <option value="">Seleccione un alumno...</option>
                  {students.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Concepto</label>
                <input placeholder={newType === 'matricula' ? 'Matricula 2026' : 'Pension Mayo'} value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Monto ($)</label>
                <input required type="number" step="0.01" min="0" placeholder="0.00" value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Vencimiento</label>
                <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet/50" />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
                style={{ backgroundColor: '#7C6DFA' }}>
                <CreditCard size={16} /> {saving ? 'Guardando...' : 'Registrar Cobro'}
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TABLE VIEW — Pivot: students × months
           ══════════════════════════════════════════════════════════════════ */}
        {viewMode === 'tabla' && (
          filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
                <CreditCard size={28} style={{ color: '#7C6DFA' }} />
              </div>
              <p className="text-ink3 font-medium">No hay registros financieros</p>
              <p className="text-ink4 text-sm mt-1">Emite un cobro para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {tableByShift.map(([shift, rows]) => (
                <div key={shift}>
                  {/* Shift header */}
                  <div className={`px-5 py-2.5 flex items-center gap-2 border-b border-surface2 ${
                    shift === 'MATUTINA' ? 'bg-amber-50/50' : shift === 'VESPERTINA' ? 'bg-blue-50/50' : 'bg-gray-50/50'
                  }`}>
                    <span className={`text-lg ${shift === 'MATUTINA' ? '' : ''}`}>
                      {shift === 'MATUTINA' ? '🌅' : shift === 'VESPERTINA' ? '🌇' : '📋'}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink2">
                      Jornada {shift}
                    </span>
                    <span className="text-[10px] text-ink3 font-medium">
                      ({rows.length} estudiante{rows.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface2">
                        <th className="text-left px-4 py-2.5 font-bold text-ink3 uppercase tracking-wider sticky left-0 bg-surface z-10 min-w-[180px]">
                          Estudiante
                        </th>
                        <th className="text-center px-2 py-2.5 font-bold text-ink3 uppercase tracking-wider min-w-[70px]">
                          Curso
                        </th>
                        <th className="text-center px-2 py-2.5 font-bold text-indigo-600 uppercase tracking-wider min-w-[60px] bg-indigo-50/50">
                          Matr.
                        </th>
                        {MESES.map(m => (
                          <th key={m} className="text-center px-2 py-2.5 font-bold text-ink3 uppercase tracking-wider min-w-[65px]">
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={row.studentId} className={`border-b border-surface2 hover:bg-bg/50 ${ri % 2 === 0 ? '' : 'bg-[rgba(0,0,0,0.015)]'}`}>
                          <td className="px-4 py-2.5 font-semibold text-sm sticky left-0 bg-surface z-10 whitespace-nowrap">
                            {row.name}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface2 text-ink3">
                              {row.course || '—'}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center bg-indigo-50/30">
                            {row.matricula ? (
                              <button
                                onClick={() => !isTutorMode && getPaymentStatus(row.matricula) !== 'pagado' ? markAsPaid(row.matricula.id) : null}
                                className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  STATUS_CELL[getPaymentStatus(row.matricula)]
                                } ${!isTutorMode && getPaymentStatus(row.matricula) !== 'pagado' ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                title={getPaymentStatus(row.matricula) !== 'pagado' ? (isTutorMode ? 'Pago Pendiente' : 'Clic para pagar') : `Pagado`}
                              >
                                {getPaymentStatus(row.matricula) === 'pagado' ? '✓' :
                                 Number(row.matricula.amount) === 0 ? '?' :
                                 formatMoney(row.matricula.amount).replace('$', '').trim()}
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleCellClick(row.studentId, 'matricula')}
                                className="text-ink4 hover:text-violet transition-colors font-bold text-lg"
                                title="Crear cobro de matrícula"
                              >
                                —
                              </button>
                            )}
                          </td>
                          {MESES.map(m => {
                            const payment = row.monthPayments[m]
                            if (!payment) {
                              return (
                                <td key={m} className="px-2 py-2.5 text-center">
                                  <button 
                                    onClick={() => handleCellClick(row.studentId, 'pension', m)}
                                    className="text-ink4 hover:text-violet transition-colors font-bold text-lg"
                                    title={`Crear pensión de ${m}`}
                                  >
                                    —
                                  </button>
                                </td>
                              )
                            }
                            const status = getPaymentStatus(payment)
                            return (
                              <td key={m} className="px-1 py-2 text-center">
                                <button
                                  onClick={() => !isTutorMode && status !== 'pagado' ? markAsPaid(payment.id) : null}
                                  className={`inline-flex items-center justify-center w-full px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                    STATUS_CELL[status]
                                  } ${!isTutorMode && status !== 'pagado' ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                  title={
                                    status === 'pagado' ? `Pagado: ${formatDate(payment.paid_date)}` :
                                    status === 'atrasado' ? `Atrasado${!isTutorMode ? ' — Clic para pagar' : ''}` :
                                    `Pendiente ${formatMoney(payment.amount)}${!isTutorMode ? ' — Clic para pagar' : ''}`
                                  }
                                >
                                  {status === 'pagado' ? '✓' :
                                   Number(payment.amount) === 0 ? '?' :
                                   formatMoney(payment.amount).replace('$', '').trim()}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Legend */}
              <div className="px-5 py-3 border-t border-surface2 flex flex-wrap items-center gap-4 text-[10px] text-ink3">
                <span className="font-bold uppercase tracking-wider">Leyenda:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> Pagado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" /> Pendiente</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Por vencer</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" /> Atrasado</span>
                {!isTutorMode && <span className="ml-auto">Clic en celda pendiente = marcar como pagado</span>}
              </div>
            </div>
          )
        )}

        {/* ══════════════════════════════════════════════════════════════════
           LIST VIEW — Original individual cards
           ══════════════════════════════════════════════════════════════════ */}
        {viewMode === 'lista' && (
          filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
                <CreditCard size={28} style={{ color: '#7C6DFA' }} />
              </div>
              <p className="text-ink3 font-medium">No hay registros financieros</p>
            </div>
          ) : (
            <div className="divide-y divide-surface2">
              {filtered.map((p: any) => {
                const student = students.find((s: any) => s.id === p.student_id)
                const sc = STATUS_CONFIG[p.computedStatus as keyof typeof STATUS_CONFIG]
                const Icon = sc.icon
                const isOverdue = p.computedStatus === 'atrasado'
                const isNear = p.computedStatus === 'proximo'
                const stuCourseIds = studentCourses[p.student_id] || []
                const stuCourse = stuCourseIds.length > 0 ? coursesById[stuCourseIds[0]] : null

                return (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-bg/50 transition-colors group">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{student?.full_name || 'Estudiante'}</p>
                        {stuCourse && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface2 text-ink3 flex-shrink-0">
                            {stuCourse.name} {stuCourse.parallel || ''}
                          </span>
                        )}
                        {p.type === 'matricula' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>MATRICULA</span>}
                        {p.type === 'pension' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#d97706' }}>PENSION</span>}
                      </div>
                      <p className="text-xs text-ink3 truncate">{p.description}</p>
                    </div>

                    <div className="hidden sm:block text-right min-w-[100px]">
                      {editingId === p.id ? (
                        <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                          className="bg-bg border border-violet/30 rounded-lg px-2 py-1 text-xs w-[120px]" />
                      ) : (
                        <>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-rose-600' : isNear ? 'text-amber-600' : 'text-ink4'}`}>
                            {p.due_date ? formatDate(p.due_date) : 'Sin fecha'}
                          </p>
                          {p.paid_date && <p className="text-[10px] text-emerald-600">Pagado: {formatDate(p.paid_date)}</p>}
                        </>
                      )}
                    </div>

                    <div className="text-right min-w-[90px]">
                      {editingId === p.id ? (
                        <input type="number" step="0.01" min="0" value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="bg-bg border border-violet/30 rounded-lg px-2 py-1 text-xs font-bold w-[80px] text-right" autoFocus />
                      ) : (
                        <p className={`font-display font-bold text-sm ${Number(p.amount) === 0 ? 'text-amber-500' : ''}`}>
                          {Number(p.amount) === 0 ? 'Por definir' : formatMoney(p.amount)}
                        </p>
                      )}
                    </div>

                    <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}>
                      <Icon size={12} /> {sc.label}
                    </div>

                    {!isTutorMode && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId === p.id ? (
                          <button onClick={() => saveEdit(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-violet/10" title="Guardar">
                            <Save size={14} style={{ color: '#7C6DFA' }} />
                          </button>
                        ) : p.computedStatus !== 'pagado' ? (
                          <button onClick={() => startEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface2" title="Editar">
                            <Pencil size={14} className="text-ink4" />
                          </button>
                        ) : null}

                        {p.computedStatus !== 'pagado' && editingId !== p.id && (
                          <button onClick={() => markAsPaid(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-50" title="Marcar pagado">
                            <Check size={16} style={{ color: '#10b981' }} />
                          </button>
                        )}

                        {editingId !== p.id && (
                          confirmDelete === p.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(p.id)} className="px-2 py-1 rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: '#ef4444' }}>Si</button>
                              <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg text-[11px] font-bold text-ink3 bg-surface2">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-rose-50" title="Eliminar">
                              <Trash2 size={14} className="text-ink4" />
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-surface2 text-xs text-ink4">
            Mostrando {viewMode === 'tabla' ? tableData.length + ' estudiantes' : filtered.length + ' registros'} de {payments.length} totales
          </div>
        )}
      </div>
    </div>
  )
}
