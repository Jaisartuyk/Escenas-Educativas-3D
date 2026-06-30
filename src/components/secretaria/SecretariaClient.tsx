'use client'

import { useState, useMemo, useEffect } from 'react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus, Check, Clock, AlertTriangle, X, Search,
  DollarSign, Users, TrendingUp, CalendarDays,
  ChevronDown, Filter, Trash2, CreditCard, GraduationCap,
  Pencil, Save, Table as TableIcon, LayoutList, Settings, HandCoins, History, Download,
} from 'lucide-react'
import { updateInstitutionFinancial, syncPendingPayments } from '@/lib/actions/institution'
import { getAppliedAmount, getComputedPaymentStatus, getRemainingAmount, inferPaymentType } from '@/lib/payment-progress'
import { SaldosAnterioresTab } from './SaldosAnterioresTab'

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)
}

function paymentSortScore(payment: any) {
  const status = getComputedPaymentStatus(payment)
  const statusScore =
    status === 'pagado' ? 4 :
    status === 'parcial' ? 3.5 :
    status === 'proximo' ? 3 :
    status === 'pendiente' ? 2 :
    status === 'atrasado' ? 1 : 0

  const dueTime = payment?.due_date ? new Date(`${payment.due_date}T00:00:00`).getTime() : 0
  const createdTime = payment?.created_at ? new Date(payment.created_at).getTime() : 0

  return { statusScore, dueTime, createdTime }
}

function pickPreferredPayment(payments: any[]) {
  if (!payments.length) return null
  return [...payments].sort((a, b) => {
    const sa = paymentSortScore(a)
    const sb = paymentSortScore(b)
    if (sb.statusScore !== sa.statusScore) return sb.statusScore - sa.statusScore
    if (sb.dueTime !== sa.dueTime) return sb.dueTime - sa.dueTime
    return sb.createdTime - sa.createdTime
  })[0]
}

const MESES = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr']
const MESES_FULL = ['mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'enero', 'febrero', 'marzo', 'abril']
const CALENDAR_MONTH_TO_ACADEMIC_KEY: Record<number, string> = {
  4: 'May',
  5: 'Jun',
  6: 'Jul',
  7: 'Ago',
  8: 'Sep',
  9: 'Oct',
  10: 'Nov',
  11: 'Dic',
  0: 'Ene',
  1: 'Feb',
  2: 'Mar',
  3: 'Abr',
}

function getMonthKeyFromPayment(payment: any) {
  if (payment?.due_date) {
    const due = new Date(`${payment.due_date}T00:00:00`)
    if (!Number.isNaN(due.getTime())) {
      return CALENDAR_MONTH_TO_ACADEMIC_KEY[due.getMonth()] || ''
    }
  }

  const desc = (payment?.description || '').toLowerCase()
  for (let i = 0; i < MESES_FULL.length; i++) {
    if (desc.includes(MESES_FULL[i])) {
      return MESES[i]
    }
  }

  return ''
}

function isMatriculaPayment(payment: any) {
  return inferPaymentType(payment) === 'matricula'
}

function isPensionPayment(payment: any) {
  return inferPaymentType(payment) === 'pension'
}

const STATUS_CONFIG = {
  pagado:    { label: 'PAGADO',     icon: Check,          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: '#10b981' },
  parcial:   { label: 'ABONADO',    icon: HandCoins,      bg: 'bg-sky-50',      text: 'text-sky-700',     border: 'border-sky-200',     dot: '#0ea5e9' },
  proximo:   { label: 'POR VENCER', icon: Clock,          bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   dot: '#f59e0b' },
  atrasado:  { label: 'ATRASADO',   icon: AlertTriangle,  bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200',    dot: '#ef4444' },
  pendiente: { label: 'PENDIENTE',  icon: CalendarDays,   bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',   dot: '#94a3b8' },
}

const STATUS_CELL: Record<string, string> = {
  pagado:    'bg-emerald-100 text-emerald-800 border-emerald-300',
  parcial:   'bg-sky-100 text-sky-800 border-sky-300',
  proximo:   'bg-amber-100 text-amber-800 border-amber-300',
  atrasado:  'bg-rose-100 text-rose-800 border-rose-300',
  pendiente: 'bg-slate-100 text-slate-600 border-slate-200',
}

const MISSING_CELL = 'bg-amber-50 text-amber-800 border-amber-300 border-dashed'
const EXPECTED_PENSION_MONTHS = new Set(['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb'])

// ─── Componente principal ────────────────────────────────────────────────────
export function SecretariaClient({ institutionId, students, courses, enrollments, initialPayments, isTutorMode, financialSettings, userRole }: any) {
  const [payments, setPayments]        = useState<any[]>(initialPayments || [])
  const [mainTab, setMainTab]          = useState<'actual' | 'anteriores'>('actual')
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
  const [exporting, setExporting]     = useState(false)
  const [showConfig, setShowConfig]   = useState(false)
  const [finConfig, setFinConfig]     = useState({
    matutina:   { matricula: 35, pension: 60, ...financialSettings?.matutina },
    vespertina: { matricula: 35, pension: 60, ...financialSettings?.vespertina },
  })

  // Inline editing
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editAmount, setEditAmount]   = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [abonoPayment, setAbonoPayment] = useState<any | null>(null)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [abonoDate, setAbonoDate] = useState(new Date().toISOString().split('T')[0])
  const [abonoNote, setAbonoNote] = useState('')
  function getConfigAmount(type: 'matricula' | 'pension') {
    if (filterShift === 'vespertina') {
      return type === 'matricula' ? finConfig.vespertina.matricula : finConfig.vespertina.pension
    }
    return type === 'matricula' ? finConfig.matutina.matricula : finConfig.matutina.pension
  }

  function getExpectedAmountForShift(shift: string | undefined, type: 'matricula' | 'pension') {
    const shiftKey = shift?.toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina'
    return type === 'matricula' ? finConfig[shiftKey].matricula : finConfig[shiftKey].pension
  }

  // ── Cargar pagos con abonos al montar (SSR puede no tener abonos adjuntos) ─
  const tutorStudentIdsParam = useMemo(() => {
    if (!isTutorMode) return ''
    return (students || [])
      .map((student: any) => student?.id)
      .filter(Boolean)
      .join(',')
  }, [isTutorMode, students])

  useEffect(() => {
    const params = new URLSearchParams()
    if (isTutorMode && tutorStudentIdsParam) {
      params.set('student_ids', tutorStudentIdsParam)
    }

    const url = params.toString()
      ? `/api/secretaria/payments?${params.toString()}`
      : '/api/secretaria/payments'

    fetch(url, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => { if (data?.data) setPayments(data.data) })
      .catch(() => {})
  }, [isTutorMode, tutorStudentIdsParam])

  // ── Mappings ────────────────────────────────────────────────────────────
  const coursesById = useMemo(() => {
    const map: Record<string, any> = {}
    ;(courses || []).forEach((c: any) => { map[c.id] = c })
    return map
  }, [courses])

  const studentsById = useMemo(() => {
    const map: Record<string, any> = {}
    ;(students || []).forEach((student: any) => { map[student.id] = student })
    return map
  }, [students])

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
    payments.map((p: any) => ({
      ...p,
      appliedAmount: getAppliedAmount(p),
      remainingAmount: getRemainingAmount(p),
      computedStatus: getComputedPaymentStatus(p),
    })),
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
        const student = studentsById[p.student_id]
        return (student?.full_name || '').toLowerCase().includes(q) ||
               (p.description || '').toLowerCase().includes(q)
      })
    }
    return list
  }, [enrichedPayments, filterStatus, filterType, searchTerm, studentsById, allowedStudentIds])

  const tablePayments = useMemo(() => {
    let list = enrichedPayments
    if (allowedStudentIds !== null) {
      list = list.filter((p: any) => allowedStudentIds.has(p.student_id))
    }
    return list
  }, [enrichedPayments, allowedStudentIds])

  const paymentMatchedStudentIds = useMemo(() => {
    return new Set(filtered.map((payment: any) => payment.student_id).filter(Boolean))
  }, [filtered])

  const filteredStudents = useMemo(() => {
    let list = students || []
    if (allowedStudentIds !== null) {
      list = list.filter((s: any) => allowedStudentIds.has(s.id))
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter((s: any) => (s.full_name || '').toLowerCase().includes(q))
    }
    
    // Si hay un filtro de estado o tipo, solo mostramos alumnos que tengan al menos un pago que coincida
    if (filterStatus !== 'todos' || filterType !== 'todos') {
      list = list.filter((s: any) => paymentMatchedStudentIds.has(s.id))
    }
    return list
  }, [students, allowedStudentIds, searchTerm, filterStatus, filterType, paymentMatchedStudentIds])

  const stats = useMemo(() => {
    const all = enrichedPayments
    const pagados   = all.filter((p: any) => p.computedStatus === 'pagado')
    const parciales = all.filter((p: any) => p.computedStatus === 'parcial')
    const atrasados = all.filter((p: any) => p.computedStatus === 'atrasado')
    const proximos  = all.filter((p: any) => p.computedStatus === 'proximo')
    const pendientes = all.filter((p: any) => p.computedStatus === 'pendiente')

    const totalRecaudado = all.reduce((sum: number, p: any) => sum + Number(p.appliedAmount || 0), 0)
    const totalPendiente = [...parciales, ...atrasados, ...proximos, ...pendientes].reduce((sum: number, p: any) => sum + Number(p.remainingAmount || 0), 0)

    return { pagados: pagados.length, parciales: parciales.length, atrasados: atrasados.length, proximos: proximos.length, pendientes: pendientes.length, totalRecaudado, totalPendiente }
  }, [enrichedPayments])

  // ── Table view: build pivot data (student × month) ──────────────────────
  const tableData = useMemo(() => {
    return (filteredStudents as any[]).map((student: any) => {
      const sid = student.id
      const stuCourseIds = studentCourses[sid] || []
      const stuCourse = stuCourseIds
        .map((courseId) => coursesById[courseId])
        .find(Boolean) || null
      const courseLabel = stuCourse ? `${stuCourse.name} ${stuCourse.parallel || ''}`.trim() : ''

      // Student payments for the pivot table should ignore status/type/search filters.
      // Otherwise existing pending months disappear and invite accidental re-creation.
      const cellPayments = tablePayments.filter((p: any) => p.student_id === sid)

      const matricula = pickPreferredPayment(
        cellPayments.filter((p: any) => isMatriculaPayment(p))
      )

      // Map payments to months
      const monthPaymentsByKey: Record<string, any[]> = {}
      cellPayments.filter((p: any) => isPensionPayment(p)).forEach((p: any) => {
        const matchedMonth = getMonthKeyFromPayment(p)

        if (matchedMonth) {
          if (!monthPaymentsByKey[matchedMonth]) monthPaymentsByKey[matchedMonth] = []
          monthPaymentsByKey[matchedMonth].push(p)
        }
      })

      const monthPayments: Record<string, any> = {}
      Object.entries(monthPaymentsByKey).forEach(([month, monthGroup]) => {
        const preferred = pickPreferredPayment(monthGroup)
        if (preferred) monthPayments[month] = preferred
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
  }, [filteredStudents, tablePayments, studentCourses, coursesById])

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

  const exportRows = useMemo(() => {
    return filtered
      .map((payment: any) => {
        const student = studentsById[payment.student_id]
        const courseIds = studentCourses[payment.student_id] || []
        const course = courseIds
          .map((courseId: string) => coursesById[courseId])
          .find(Boolean) || null
        const normalizedType = inferPaymentType(payment)
        const monthKey = normalizedType === 'pension' ? getMonthKeyFromPayment(payment) : ''
        const dueDate = payment?.due_date || null
        let periodLabel = ''

        if (normalizedType === 'matricula') {
          periodLabel = dueDate ? String(new Date(`${dueDate}T00:00:00`).getFullYear()) : ''
        } else if (normalizedType === 'pension') {
          periodLabel = monthKey || ''
        }

        return {
          id: payment.id,
          studentName: student?.full_name || 'Estudiante',
          studentEmail: student?.email || '',
          courseName: course?.name || '',
          parallel: course?.parallel || '',
          shift: course?.shift || '',
          type: normalizedType || payment.type || '',
          description: payment.description || '',
          periodLabel,
          computedStatus: payment.computedStatus,
          amount: Number(payment.amount || 0),
          appliedAmount: Number(payment.appliedAmount || 0),
          remainingAmount: Number(payment.remainingAmount || 0),
          dueDate: payment.due_date || '',
          paidDate: payment.paid_date || '',
          createdAt: payment.created_at || '',
          updatedAt: payment.updated_at || '',
          abonos: Array.isArray(payment.abonos) ? payment.abonos : [],
        }
      })
      .sort((a, b) => {
        const byName = a.studentName.localeCompare(b.studentName)
        if (byName !== 0) return byName
        const byDue = (a.dueDate || '').localeCompare(b.dueDate || '')
        if (byDue !== 0) return byDue
        return a.description.localeCompare(b.description)
      })
  }, [filtered, studentsById, studentCourses, coursesById])

  // ── Actions ──────────────────────────────────────────────────────────────
  function handleCellClick(studentId: string, type: 'matricula' | 'pension', month?: string) {
    if (isTutorMode) return
    
    setSelectedStudent(studentId)
    setNewType(type)
    
    const student = students.find((s: any) => s.id === studentId)
    const stuCIds = studentCourses[studentId] || []
    const stuCourse = stuCIds.length > 0 ? coursesById[stuCIds[0]] : null
    const courseLabel = stuCourse ? `${stuCourse.name} ${stuCourse.parallel || ''}`.trim() : ''
    const shift = (stuCourse?.shift?.toLowerCase() === 'vespertina' ? 'vespertina' : 'matutina') as 'matutina' | 'vespertina'
    const prices = finConfig[shift]

    if (type === 'matricula') {
      setNewAmount(String(prices.matricula))
      setNewDesc(`Matricula ${new Date().getFullYear()}${courseLabel ? ` — ${courseLabel}` : ''}`)
      const today = new Date()
      setNewDueDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15).toISOString().split('T')[0])
    } else if (type === 'pension' && month) {
      setNewAmount(String(prices.pension))
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

  function openAbono(payment: any) {
    setAbonoPayment(payment)
    setAbonoAmount(String(payment.remainingAmount || payment.amount || ''))
    setAbonoDate(new Date().toISOString().split('T')[0])
    setAbonoNote('')
  }

  async function submitAbono() {
    if (!abonoPayment) return
    const amount = parseFloat(abonoAmount)
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Monto de abono inválido')

    const res = await fetch('/api/secretaria/payments/abonos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_id: abonoPayment.id,
        amount,
        paid_at: abonoDate,
        note: abonoNote,
      }),
    })

    const dataJson = await res.json()
    if (!res.ok) {
      toast.error(dataJson.error || 'Error al registrar abono')
      return
    }

    if (dataJson?.data?.payment) {
      setPayments(prev => prev.map((payment: any) => payment.id === abonoPayment.id ? dataJson.data.payment : payment))
    }

    toast.success('Abono registrado')
    setAbonoPayment(null)
  }

  const [generating, setGenerating] = useState(false)
  async function generateMissing() {
    setGenerating(true)
    try {
      const res = await fetch('/api/secretaria/generate-payments', { method: 'POST' })
      const dataJson = await res.json()
      
      if (!res.ok) {
        toast.error(dataJson.error || 'Error al generar cobros')
      } else if (dataJson.generated > 0) {
        toast.success(`${dataJson.generated} cobros generados`)
        const r2 = await fetch('/api/secretaria/payments')
        const { data } = await r2.json()
        if (data) setPayments(data)
      } else {
        toast.success('Todos los estudiantes ya tienen cobros')
      }
    } catch { toast.error('Error de red al generar') }
    finally { setGenerating(false) }
  }

  async function handleSaveConfig() {
    setSaving(true)
    const res = await updateInstitutionFinancial(institutionId, finConfig)
    setSaving(false)
    if (res.error) toast.error('Error al guardar configuración')
    else {
      const r2 = await fetch('/api/secretaria/payments')
      const dataJson = await r2.json()
      if (dataJson?.data) setPayments(dataJson.data)
      toast.success(`Configuración guardada${typeof res.updated === 'number' ? ` y ${res.updated} cobros sincronizados` : ' y cobros sincronizados'}`)
      setShowConfig(false)
    }
  }

  async function exportExcel() {
    try {
      setExporting(true)
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'ClassNova'
      workbook.created = new Date()

      const today = new Date()
      const safeDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const summarySheet = workbook.addWorksheet('Resumen')
      summarySheet.columns = [
        { header: 'Indicador', key: 'label', width: 32 },
        { header: 'Valor', key: 'value', width: 24 },
      ]
      summarySheet.addRows([
        { label: 'Fecha de exportación', value: safeDate },
        { label: 'Vista', value: 'Secretaría Académica' },
        { label: 'Registros exportados', value: exportRows.length },
        { label: 'Estado aplicado', value: filterStatus },
        { label: 'Jornada aplicada', value: filterShift },
        { label: 'Curso aplicado', value: filterCourse === 'todos' ? 'todos' : (coursesById[filterCourse]?.name || filterCourse) },
        { label: 'Tipo aplicado', value: filterType },
        { label: 'Búsqueda aplicada', value: searchTerm.trim() || '(sin filtro)' },
        { label: 'Total recaudado (filtrado)', value: exportRows.reduce((sum, row) => sum + row.appliedAmount, 0) },
        { label: 'Total pendiente (filtrado)', value: exportRows.reduce((sum, row) => sum + row.remainingAmount, 0) },
      ])
      summarySheet.getRow(1).font = { bold: true }

      const paymentsSheet = workbook.addWorksheet('Cobros')
      paymentsSheet.columns = [
        { header: 'ID', key: 'id', width: 38 },
        { header: 'Estudiante', key: 'studentName', width: 34 },
        { header: 'Correo', key: 'studentEmail', width: 28 },
        { header: 'Curso', key: 'courseName', width: 18 },
        { header: 'Paralelo', key: 'parallel', width: 12 },
        { header: 'Jornada', key: 'shift', width: 14 },
        { header: 'Tipo', key: 'type', width: 14 },
        { header: 'Descripción', key: 'description', width: 40 },
        { header: 'Período', key: 'periodLabel', width: 14 },
        { header: 'Estado real', key: 'computedStatus', width: 16 },
        { header: 'Monto', key: 'amount', width: 14 },
        { header: 'Abonado', key: 'appliedAmount', width: 14 },
        { header: 'Saldo', key: 'remainingAmount', width: 14 },
        { header: 'Vence', key: 'dueDate', width: 14 },
        { header: 'Pagado', key: 'paidDate', width: 14 },
        { header: 'Creado', key: 'createdAt', width: 24 },
        { header: 'Actualizado', key: 'updatedAt', width: 24 },
      ]

      exportRows.forEach((row) => paymentsSheet.addRow(row))
      paymentsSheet.getRow(1).font = { bold: true }

      ;['K', 'L', 'M'].forEach((col) => {
        paymentsSheet.getColumn(col).numFmt = '$#,##0.00'
      })

      const abonosSheet = workbook.addWorksheet('Abonos')
      abonosSheet.columns = [
        { header: 'Pago ID', key: 'paymentId', width: 38 },
        { header: 'Estudiante', key: 'studentName', width: 34 },
        { header: 'Descripción cobro', key: 'description', width: 40 },
        { header: 'Abono ID', key: 'abonoId', width: 38 },
        { header: 'Monto abono', key: 'amount', width: 16 },
        { header: 'Fecha abono', key: 'paidAt', width: 16 },
        { header: 'Observación', key: 'note', width: 34 },
      ]

      exportRows.forEach((row) => {
        row.abonos.forEach((abono: any) => {
          abonosSheet.addRow({
            paymentId: row.id,
            studentName: row.studentName,
            description: row.description,
            abonoId: abono.id || '',
            amount: Number(abono.amount || 0),
            paidAt: abono.paid_at || '',
            note: abono.note || '',
          })
        })
      })
      abonosSheet.getRow(1).font = { bold: true }
      abonosSheet.getColumn('E').numFmt = '$#,##0.00'

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `secretaria_cobros_${safeDate}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)

      toast.success('Excel exportado')
    } catch (error) {
      console.error('[secretaria/export-excel]', error)
      toast.error('No se pudo exportar el Excel')
    } finally {
      setExporting(false)
    }
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
          <p className="text-xs text-amber-600 font-medium">{stats.pendientes + stats.proximos + stats.parciales} pendientes / abonados</p>
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

      {/* ── Tabs principales ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-surface border border-surface2 rounded-2xl p-1.5">
        <button
          onClick={() => setMainTab('actual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            mainTab === 'actual' ? 'bg-white shadow-sm text-violet-700 border border-violet-100' : 'text-ink3 hover:text-ink'
          }`}
        >
          <CreditCard size={15} /> Año Actual
        </button>
        <button
          onClick={() => setMainTab('anteriores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            mainTab === 'anteriores' ? 'bg-white shadow-sm text-rose-600 border border-rose-100' : 'text-ink3 hover:text-ink'
          }`}
        >
          <History size={15} /> Saldos Anteriores
        </button>
      </div>

      {/* ── Contenido de Saldos Anteriores ──────────────────────────────── */}
      {mainTab === 'anteriores' && (
        <div className="bg-surface rounded-2xl border border-surface2 p-5">
          <div className="mb-4">
            <h2 className="font-bold text-base text-ink">Saldos de Años Anteriores</h2>
            <p className="text-xs text-ink4 mt-0.5">Registra y gestiona deudas de períodos lectivos pasados.</p>
          </div>
          <SaldosAnterioresTab students={students} institutionId={institutionId} userRole={userRole} />
        </div>
      )}

      {/* ── Toolbar (solo año actual) ──────────────────────────────────────── */}
      {mainTab === 'actual' && (<>
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
                    onClick={exportExcel}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-surface2 text-ink3 hover:bg-surface2 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Download size={14} />
                    {exporting ? 'Exportando...' : 'Exportar Excel'}
                  </button>
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors flex-shrink-0 ${
                      showConfig ? 'bg-violet-100 text-violet-700 border-violet-200' : 'border-surface2 text-ink3 hover:bg-surface2'
                    }`}
                  >
                    <Settings size={14} />
                    Configurar Valores
                  </button>
                  <button
                    onClick={generateMissing}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-surface2 text-ink3 hover:bg-surface2 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <CalendarDays size={14} />
                    {generating ? 'Generando...' : 'Generar cobros'}
                  </button>
                  <button
                    onClick={() => { setShowForm(!showForm); setShowConfig(false) }}
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
                <option value="parcial">Abonados</option>
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
                <button key={value} type="button" onClick={() => { setNewType(value); setNewAmount(value === 'otro' ? '' : String(getConfigAmount(value))) }}
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

        {/* ── Configuration panel ─────────────────────────────────────────── */}
        {showConfig && (
          <div className="p-6 border-b border-surface2 bg-bg space-y-6 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                  <Settings size={16} className="text-violet" />
                  Configuración de Valores por Jornada
                </h3>
                <p className="text-xs text-ink3 mt-0.5">Define los precios base para matrículas y pensiones de cada turno.</p>
              </div>
              <button 
                onClick={() => setShowConfig(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink4 hover:bg-surface2 hover:text-ink transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Matutina */}
              <div className="space-y-4 p-5 rounded-2xl bg-amber-50/40 border border-amber-100/50 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-lg">🌅</div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Jornada Matutina</span>
                    <p className="text-[10px] text-amber-600 font-medium">Turnos de la mañana</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-ink4 tracking-wider">Matrícula</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4 text-xs">$</span>
                      <input
                        type="number"
                        value={finConfig.matutina.matricula}
                        onChange={e => setFinConfig({ ...finConfig, matutina: { ...finConfig.matutina, matricula: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-surface border border-surface2 rounded-xl pl-6 pr-3 py-2 text-sm font-semibold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-ink4 tracking-wider">Pensión</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4 text-xs">$</span>
                      <input
                        type="number"
                        value={finConfig.matutina.pension}
                        onChange={e => setFinConfig({ ...finConfig, matutina: { ...finConfig.matutina, pension: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-surface border border-surface2 rounded-xl pl-6 pr-3 py-2 text-sm font-semibold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vespertina */}
              <div className="space-y-4 p-5 rounded-2xl bg-blue-50/40 border border-blue-100/50 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg">🌇</div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Jornada Vespertina</span>
                    <p className="text-[10px] text-blue-600 font-medium">Turnos de la tarde</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-ink4 tracking-wider">Matrícula</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4 text-xs">$</span>
                      <input
                        type="number"
                        value={finConfig.vespertina.matricula}
                        onChange={e => setFinConfig({ ...finConfig, vespertina: { ...finConfig.vespertina, matricula: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-surface border border-surface2 rounded-xl pl-6 pr-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-ink4 tracking-wider">Pensión</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4 text-xs">$</span>
                      <input
                        type="number"
                        value={finConfig.vespertina.pension}
                        onChange={e => setFinConfig({ ...finConfig, vespertina: { ...finConfig.vespertina, pension: parseFloat(e.target.value) || 0 } })}
                        className="w-full bg-surface border border-surface2 rounded-xl pl-6 pr-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-surface2/50">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-violet/20 active:scale-95 transition-all disabled:opacity-50"
                style={{ backgroundColor: '#7C6DFA' }}
              >
                {saving ? 'Guardando...' : <><Save size={16} /> Guardar Configuración</>}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
           TABLE VIEW — Pivot: students × months
           ══════════════════════════════════════════════════════════════════ */}
        {viewMode === 'tabla' && (
          tableData.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
                <CreditCard size={28} style={{ color: '#7C6DFA' }} />
              </div>
              <p className="text-ink3 font-medium">
                {filterShift !== 'todos' || filterCourse !== 'todos' || filterStatus !== 'todos' || filterType !== 'todos' || searchTerm.trim()
                  ? 'No hay estudiantes para este filtro'
                  : 'No hay estudiantes matriculados para mostrar'}
              </p>
              <p className="text-ink4 text-sm mt-1">
                {filterShift !== 'todos' || filterCourse !== 'todos' || filterStatus !== 'todos' || filterType !== 'todos' || searchTerm.trim()
                  ? 'Prueba con otro curso, turno o búsqueda.'
                  : 'Cuando existan matrículas activas, aquí verás su matriz de cobros.'}
              </p>
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
                                onClick={() => {
                                  if (isTutorMode) return
                                  if (row.matricula.computedStatus !== 'pagado') { openAbono(row.matricula) }
                                }}
                                className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  STATUS_CELL[row.matricula.computedStatus]
                                } ${!isTutorMode && row.matricula.computedStatus !== 'pagado' ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                title={
                                  row.matricula.computedStatus === 'pagado' ? 'Matrícula pagada ✓' :
                                  row.matricula.computedStatus === 'parcial' ? `Abonado ${formatMoney(row.matricula.appliedAmount || 0)} · Restan ${formatMoney(row.matricula.remainingAmount || 0)} — Clic para abonar más` :
                                  isTutorMode ? 'Cobro pendiente' : 'Clic para registrar pago o abono'
                                }
                              >
                                {row.matricula.computedStatus === 'pagado' ? '✓' :
                                 row.matricula.computedStatus === 'parcial' ? `+${Number(row.matricula.remainingAmount || 0).toFixed(0)}` :
                                 Number(row.matricula.amount) === 0 ? '?' :
                                 formatMoney(row.matricula.amount).replace('$', '').trim()}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCellClick(row.studentId, 'matricula')}
                                className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${MISSING_CELL} ${!isTutorMode ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                title={isTutorMode ? 'Matrícula no generada todavía' : 'Matrícula no generada todavía - clic para emitir'}
                              >
                                {formatMoney(getExpectedAmountForShift(row.shift, 'matricula')).replace('$', '').trim()}
                              </button>
                            )}
                          </td>
                          {MESES.map(m => {
                            const payment = row.monthPayments[m]
                            if (!payment) {
                              const expectedPensionMonth = EXPECTED_PENSION_MONTHS.has(m)
                              return (
                                <td key={m} className="px-2 py-2.5 text-center">
                                  <button
                                    onClick={() => handleCellClick(row.studentId, 'pension', m)}
                                    className={expectedPensionMonth
                                      ? `inline-flex items-center justify-center w-full px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${MISSING_CELL} ${!isTutorMode ? 'cursor-pointer hover:shadow-sm' : ''}`
                                      : 'text-ink4 hover:text-violet transition-colors font-bold text-lg'}
                                    title={expectedPensionMonth
                                      ? (isTutorMode ? `Pensión de ${m} no generada todavía` : `Pensión de ${m} no generada todavía - clic para emitir`)
                                      : `Crear pensión de ${m}`}
                                  >
                                    {expectedPensionMonth
                                      ? formatMoney(getExpectedAmountForShift(row.shift, 'pension')).replace('$', '').trim()
                                      : '?'}
                                  </button>
                                </td>
                              )
                            }
                            const status = payment.computedStatus
                            return (
                              <td key={m} className="px-1 py-2 text-center">
                                <button
                                  onClick={() => {
                                    if (isTutorMode) return
                                    if (status === 'parcial') { openAbono(payment); return }
                                    if (status !== 'pagado') markAsPaid(payment.id)
                                  }}
                                  className={`inline-flex items-center justify-center w-full px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${STATUS_CELL[status]} ${!isTutorMode && status !== 'pagado' ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                  title={
                                    status === 'pagado' ? `Pagado: ${formatDate(payment.paid_date)}` :
                                    status === 'parcial' ? `Abonado $${(payment.appliedAmount || 0).toFixed(2)} · Restan $${(payment.remainingAmount || 0).toFixed(2)} ? Clic para abonar más` :
                                    status === 'atrasado' ? `Atrasado${!isTutorMode ? ' ? Clic para pagar' : ''}` :
                                    `Pendiente ${formatMoney(payment.remainingAmount || payment.amount)}${!isTutorMode ? ' ? Clic para pagar' : ''}`
                                  }
                                >
                                  {status === 'pagado' ? '?' :
                                   status === 'parcial' ? `+${Number(payment.remainingAmount || 0).toFixed(0)}` :
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
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border border-sky-300 inline-block" /> Abonado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" /> Pendiente</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Por vencer</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" /> Atrasado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 border-dashed inline-block" /> Falta generar</span>
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
                        {isMatriculaPayment(p) && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>MATRICULA</span>}
                        {isPensionPayment(p) && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#d97706' }}>PENSION</span>}
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
                          {Number(p.amount) === 0 ? 'Por definir' : formatMoney(p.computedStatus === 'pagado' ? p.amount : (p.remainingAmount || p.amount))}
                        </p>
                      )}
                      {editingId !== p.id && p.computedStatus === 'parcial' && (
                        <p className="text-[10px] text-sky-600">Abonado {formatMoney(p.appliedAmount || 0)}</p>
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

                        {editingId !== p.id && p.computedStatus !== 'pagado' && (
                          <button onClick={() => openAbono(p)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-sky-50" title="Registrar abono">
                            <HandCoins size={16} className="text-sky-600" />
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

      {abonoPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl border border-surface2 bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface2 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Registrar abono</h3>
                <p className="text-xs text-ink3 mt-1">{abonoPayment.description}</p>
              </div>
              <button onClick={() => setAbonoPayment(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface2">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-ink4 uppercase tracking-wider font-bold">Monto total</p>
                  <p className="mt-1 text-base font-bold text-ink">{formatMoney(Number(abonoPayment.amount || 0))}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-3">
                  <p className="text-rose-600 uppercase tracking-wider font-bold">Saldo restante</p>
                  <p className="mt-1 text-base font-bold text-rose-700">{formatMoney(Number(abonoPayment.remainingAmount || abonoPayment.amount || 0))}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Monto a abonar</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(abonoPayment.remainingAmount || abonoPayment.amount || 0)}
                  value={abonoAmount}
                  onChange={e => setAbonoAmount(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Fecha del abono</label>
                <input
                  type="date"
                  value={abonoDate}
                  onChange={e => setAbonoDate(e.target.value)}
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink3 mb-1.5 uppercase tracking-wider">Observación</label>
                <textarea
                  rows={3}
                  value={abonoNote}
                  onChange={e => setAbonoNote(e.target.value)}
                  placeholder="Ej. abono recibido en caja"
                  className="w-full bg-bg border border-surface2 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-surface2 px-5 py-4">
              <button onClick={() => setAbonoPayment(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-ink3 hover:bg-surface2">
                Cancelar
              </button>
              <button onClick={submitAbono} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700">
                <HandCoins size={15} /> Guardar abono
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}
