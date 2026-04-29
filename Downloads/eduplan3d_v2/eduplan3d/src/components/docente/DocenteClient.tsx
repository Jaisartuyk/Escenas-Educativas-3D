'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Plus, Users, ClipboardList, BarChart2,
  CheckCircle2, XCircle, Clock3, ThumbsUp, ThumbsDown,
  Star, Trash2, BookOpen, CalendarDays, Settings, X,
  Upload, Paperclip
} from 'lucide-react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { FilePreview } from '@/components/ui/FilePreview'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'late'
type BehaviorType     = 'positive' | 'negative' | 'recommendation'
type DetailTab        = 'asistencia' | 'calificaciones' | 'comportamiento'

// ─── Constants ────────────────────────────────────────────────────────────────
// Inline hex colors — Tailwind purges dynamic class names in production
const CARD_COLORS = [
  '#7C6DFA', '#3B82F6', '#14B8A6',
  '#F59E0B', '#F43F5E', '#6366F1',
  '#10B981', '#F97316', '#EC4899', '#06B6D4',
]
const DAYS_ES   = ['Lun','Mar','Mié','Jue','Vie']
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Asigna colores por curso — cada curso tiene su propio color
function buildCourseColorMap(subjects: any[]): Record<string, string> {
  const uniqueCourses = Array.from(new Set(
    subjects.map((s: any) => s.course?.name || 'Sin curso')
  ))
  const map: Record<string, string> = {}
  uniqueCourses.forEach((name, i) => { map[name] = CARD_COLORS[i % CARD_COLORS.length] })
  return map
}

// Color por subject id (combina materia+curso para evitar colisiones)
function getSubjectColor(s: any, courseColorMap: Record<string, string>): string {
  return courseColorMap[s.course?.name || 'Sin curso'] || CARD_COLORS[0]
}

function getMondayOfWeek(date = new Date()) {
  const d   = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(d: Date) { return d.toISOString().split('T')[0] }

function fmtDayHeader(d: Date) {
  return `${DAYS_ES[d.getDay() - 1]} ${d.getDate()}`
}

function fmtWeekRange(mon: Date) {
  const fri = addDays(mon, 4)
  return `${mon.getDate()} - ${fri.getDate()} ${MONTHS_ES[fri.getMonth()]} ${fri.getFullYear()}`
}

const CAT_COLORS = ['#4F46E5','#10B981','#EF4444','#8B5CF6','#F59E0B','#3B82F6','#EC4899','#06B6D4']

// ─── Componente principal ─────────────────────────────────────────────────────
export function DocenteClient({
  profile, mySubjects,
  initialAssignments, initialGrades, initialCategories, teacherId,
  parcialesCount = 2,
  horariosData = {},
}: any) {
  // ── Enrollments + student profiles — cargados via API (server components no pueden consultar profiles) ──
  const supabase = createClient()
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false)
  const [enrollmentsDiag, setEnrollmentsDiag] = useState<{ reason: string; message?: string } | null>(null)

  useEffect(() => {
    fetch('/api/docente/students')
      .then(r => r.json())
      .then(({ data, diag }) => {
        const mapped = (data || []).map((e: any) => ({
          course_id:  e.course_id,
          student_id: e.student_id,
          student:    e.student ?? { id: e.student_id, full_name: 'Sin perfil', email: '' },
        }))
        setEnrollments(mapped)
        setEnrollmentsDiag(diag || null)
        setEnrollmentsLoaded(true)
      })
      .catch(() => setEnrollmentsLoaded(true))
  }, [])

  // ── Vista activa ─────────────────────────────────────────────────────────
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [activeTab,         setActiveTab]         = useState<DetailTab>('asistencia')
  const [horarioFilter,     setHorarioFilter]     = useState<string>('TODOS') // filtro por curso en horario

  // ── Assignments / Grades (existentes) ───────────────────────────────────
  const [assignments, setAssignments] = useState<any[]>(initialAssignments)
  const [grades,      setGrades]      = useState<any[]>(initialGrades)

  // ── Asistencia ───────────────────────────────────────────────────────────
  const [weekStart,   setWeekStart]   = useState<Date>(() => getMondayOfWeek())
  const [attendance,  setAttendance]  = useState<Record<string, AttendanceStatus>>({}) // "date_studentId" → status
  const [loadingAtt,  setLoadingAtt]  = useState(false)

  // ── Comportamiento ───────────────────────────────────────────────────────
  const [behaviors,       setBehaviors]       = useState<any[]>([])
  const [loadingBeh,      setLoadingBeh]      = useState(false)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [newBehType,      setNewBehType]      = useState<BehaviorType>('positive')
  const [newBehDesc,      setNewBehDesc]      = useState('')
  const [savingBeh,       setSavingBeh]       = useState(false)

  // ── Calificaciones ───────────────────────────────────────────────────────
  const [trimestre,    setTrimestre]    = useState(1)
  const [parcial,      setParcial]      = useState(1)
  const [calView,      setCalView]      = useState<'parcial' | 'resumen'>('parcial')
  const [newAsgTitle,  setNewAsgTitle]  = useState('')
  const [newAsgDesc,   setNewAsgDesc]   = useState('')
  const [newAsgDate,   setNewAsgDate]   = useState('')
  const [newAsgCatId,  setNewAsgCatId]  = useState<string>('')
  const [editingGrades,setEditingGrades]= useState<Record<string, string>>({})

  // ── Categorías de calificación ─────────────────────────────────────────────
  const [categories,    setCategories]    = useState<any[]>(initialCategories || [])
  const [showCatModal,  setShowCatModal]  = useState(false)
  const [editCat,       setEditCat]       = useState<any>(null)
  const [catName,       setCatName]       = useState('')
  const [catWeight,     setCatWeight]     = useState('20')
  const [catColor,      setCatColor]      = useState(CAT_COLORS[0])

  // ── Modal detalle de actividad ──────────────────────────────────────────────
  const [editActivity,     setEditActivity]     = useState<any>(null)
  const [actTab,           setActTab]           = useState<'general'|'descripcion'|'adjuntos'|'estudiantes'>('general')
  const [actTitle,         setActTitle]         = useState('')
  const [actDesc,          setActDesc]          = useState('')
  const [actStartDate,     setActStartDate]     = useState('')
  const [actDueDate,       setActDueDate]       = useState('')
  const [actDueTime,       setActDueTime]       = useState('23:59')
  const [actCatId,         setActCatId]         = useState('')
  const [savingAct,        setSavingAct]        = useState(false)
  const [actAttachments,   setActAttachments]   = useState<string[]>([])  // existing file URLs
  const [actNewFiles,      setActNewFiles]      = useState<File[]>([])    // pending uploads
  const [uploadingAtt,     setUploadingAtt]     = useState(false)
  const [actSubmissions,   setActSubmissions]   = useState<any[]>([])     // student submissions for this assignment
  const [loadingActSubs,   setLoadingActSubs]   = useState(false)

  const selectedSubject = mySubjects.find((s: any) => s.id === selectedSubjectId)
  const instId        = (profile?.institutions as any)?.id || profile?.institution_id
  const courseColorMap = buildCourseColorMap(mySubjects)

  // ── Helpers para categorías (scope componente para uso en modales) ────────
  const getCatColor = (catId: string | null) => {
    const cat = categories.find((c: any) => c.id === catId)
    return cat?.color || '#94A3B8'
  }
  const getCatName = (catId: string | null) => {
    const cat = categories.find((c: any) => c.id === catId)
    return cat?.name || 'Sin categoría'
  }

  // ── Alumnos del curso seleccionado ───────────────────────────────────────
  // Usamos course_id (FK directa) y course?.id (del join) como fallback,
  // en caso de que el join no haya cargado.
  const selectedCourseId = selectedSubject?.course_id || selectedSubject?.course?.id || null
  const students: any[] = selectedSubject
    ? enrollments.filter((e: any) => e.course_id === selectedCourseId)
        .map((e: any) => e.student).filter(Boolean)
    : []

  // ── Cargar asistencia cuando cambia la semana o el subject ───────────────
  const loadAttendance = useCallback(async (subjectId: string, week: Date) => {
    setLoadingAtt(true)
    try {
      const res = await fetch(`/api/docente/attendance?subjectId=${subjectId}&weekStart=${toISO(week)}`)
      const { data } = await res.json()
      const map: Record<string, AttendanceStatus> = {}
      ;(data || []).forEach((r: any) => {
        map[`${r.date}_${r.student_id}`] = r.status
      })
      setAttendance(map)
    } finally { setLoadingAtt(false) }
  }, [])

  useEffect(() => {
    if (selectedSubjectId && activeTab === 'asistencia') {
      loadAttendance(selectedSubjectId, weekStart)
    }
  }, [selectedSubjectId, weekStart, activeTab, loadAttendance])

  // ── Cargar comportamiento cuando se abre la pestaña ──────────────────────
  const loadBehaviors = useCallback(async (subjectId: string) => {
    setLoadingBeh(true)
    try {
      const res = await fetch(`/api/docente/behavior?subjectId=${subjectId}`)
      const { data } = await res.json()
      setBehaviors(data || [])
    } finally { setLoadingBeh(false) }
  }, [])

  useEffect(() => {
    if (selectedSubjectId && activeTab === 'comportamiento') {
      loadBehaviors(selectedSubjectId)
    }
  }, [selectedSubjectId, activeTab, loadBehaviors])

  // ── Abrir un subject ──────────────────────────────────────────────────────
  function openSubject(id: string) {
    setSelectedSubjectId(id)
    setActiveTab('asistencia')
    setWeekStart(getMondayOfWeek())
    setExpandedStudent(null)
    setNewBehDesc('')
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ASISTENCIA — toggle
  // ════════════════════════════════════════════════════════════════════════
  const NEXT_STATUS: Record<AttendanceStatus, AttendanceStatus> = {
    present: 'absent',
    absent:  'late',
    late:    'present',
  }

  async function toggleAttendance(date: string, studentId: string) {
    const key    = `${date}_${studentId}`
    const current: AttendanceStatus = attendance[key] || 'present'
    const next   = NEXT_STATUS[current]

    setAttendance(prev => ({ ...prev, [key]: next }))

    try {
      const res = await fetch('/api/docente/attendance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject_id:     selectedSubjectId,
          student_id:     studentId,
          date,
          status:         next,
          institution_id: instId,
        }),
      })
      const data = await res.json()
      if (data.error) {
        console.error('[attendance] Error:', data.error)
        toast.error('Error al guardar asistencia: ' + data.error)
        // Revertir cambio optimista
        setAttendance(prev => ({ ...prev, [key]: current }))
      }
    } catch (e) {
      console.error('[attendance] Fetch failed:', e)
      toast.error('Error de conexión al guardar asistencia')
      setAttendance(prev => ({ ...prev, [key]: current }))
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CALIFICACIONES — crear tarea
  // ════════════════════════════════════════════════════════════════════════
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!newAsgTitle.trim() || !selectedSubjectId) return

    const id     = uuidv4()
    const newAsg = {
      id, subject_id: selectedSubjectId,
      title: newAsgTitle, description: newAsgDesc,
      due_date:    newAsgDate || null,
      trimestre, parcial,
      category_id: newAsgCatId || null,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }
    setAssignments(prev => [newAsg, ...prev])
    setNewAsgTitle(''); setNewAsgDesc(''); setNewAsgDate(''); setNewAsgCatId('')

    const res = await fetch('/api/docente/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify(newAsg),
    })
    const data = await res.json()
    if (data.error) toast.error('Error al crear tarea: ' + data.error)
    else toast.success('✓ Tarea publicada')
  }

  // ── Categorías CRUD ──────────────────────────────────────────────────────
  function openNewCat() {
    setEditCat(null)
    setCatName('')
    setCatWeight('20')
    setCatColor(CAT_COLORS[categories.length % CAT_COLORS.length])
    setShowCatModal(true)
  }
  function openEditCat(c: any) {
    setEditCat(c)
    setCatName(c.name)
    setCatWeight(String(c.weight_percent))
    setCatColor(c.color)
    setShowCatModal(true)
  }
  async function saveCat() {
    if (!catName.trim()) return
    const payload = {
      ...(editCat ? { id: editCat.id } : {}),
      name: catName,
      color: catColor,
      weight_percent: parseFloat(catWeight) || 20,
      sort_order: editCat ? editCat.sort_order : categories.length,
    }
    const res = await fetch('/api/docente/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const { data, error } = await res.json()
    if (error) toast.error(error)
    else { setCategories(data || []); toast.success(editCat ? 'Categoría actualizada' : 'Categoría creada') }
    setShowCatModal(false)
  }
  async function deleteCat(id: string) {
    await fetch(`/api/docente/categories?id=${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter((c: any) => c.id !== id))
    toast.success('Categoría eliminada')
  }

  // ── Modal actividad: abrir / guardar / eliminar ────────────────────────────
  function openActivityModal(a: any) {
    setEditActivity(a)
    setActTab('general')
    setActTitle(a.title || '')
    setActDesc(a.description || '')
    setActStartDate(a.start_date || '')
    setActDueDate(a.due_date || '')
    setActDueTime(a.due_time || '23:59')
    setActCatId(a.category_id || '')
    setActAttachments(a.attachment_urls || [])
    setActNewFiles([])
  }
  async function saveActivity() {
    if (!editActivity || !actTitle.trim()) return
    setSavingAct(true)
    const payload = {
      id:          editActivity.id,
      title:       actTitle,
      description: actDesc,
      start_date:  actStartDate || null,
      due_date:    actDueDate || null,
      due_time:    actDueTime || '23:59',
      category_id: actCatId || null,
    }
    const res = await fetch('/api/docente/assignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setSavingAct(false); return }
    setAssignments(prev => prev.map(a => a.id === editActivity.id ? { ...a, ...payload } : a))
    setEditActivity(null)
    setSavingAct(false)
    toast.success('Actividad actualizada')
  }
  async function deleteActivity() {
    if (!editActivity) return
    if (!confirm('¿Eliminar esta actividad y todas sus calificaciones?')) return
    await fetch(`/api/docente/assignments?id=${editActivity.id}`, { method: 'DELETE' })
    setAssignments(prev => prev.filter(a => a.id !== editActivity.id))
    setGrades(prev => prev.filter((g: any) => g.assignment_id !== editActivity.id))
    setEditActivity(null)
    toast.success('Actividad eliminada')
  }

  function getDaysRemaining(dueDate: string | null): number | null {
    if (!dueDate) return null
    const diff = new Date(dueDate).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // ── Cálculo promedio ponderado ────────────────────────────────────────────
  function getWeightedAvg(studentId: string, filteredAssignments: any[]): number | null {
    if (categories.length === 0) {
      // Sin categorías → promedio simple
      const scores = filteredAssignments.map(a => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
      return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    }
    let totalWeight = 0
    let weightedSum = 0
    let hasAnyGrade = false
    categories.forEach(cat => {
      const catAsgs = filteredAssignments.filter(a => a.category_id === cat.id)
      const scores  = catAsgs.map(a => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
      if (scores.length > 0) {
        hasAnyGrade = true
        const catAvg = scores.reduce((a, b) => a + b, 0) / scores.length
        weightedSum += catAvg * (cat.weight_percent / 100)
        totalWeight += cat.weight_percent / 100
      }
    })
    // Also include uncategorized
    const uncatAsgs = filteredAssignments.filter(a => !a.category_id)
    const uncatScores = uncatAsgs.map(a => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
    if (uncatScores.length > 0) {
      hasAnyGrade = true
      const uncatAvg = uncatScores.reduce((a, b) => a + b, 0) / uncatScores.length
      const remainingWeight = Math.max(0, 1 - categories.reduce((s, c) => s + c.weight_percent / 100, 0))
      if (remainingWeight > 0) {
        weightedSum += uncatAvg * remainingWeight
        totalWeight += remainingWeight
      }
    }
    if (!hasAnyGrade) return null
    return totalWeight > 0 ? weightedSum / totalWeight : null
  }

  function handleGradeChange(assignmentId: string, studentId: string, value: string) {
    setEditingGrades(prev => ({ ...prev, [`${assignmentId}_${studentId}`]: value }))
  }

  async function handleSaveGrade(assignmentId: string, studentId: string) {
    const key = `${assignmentId}_${studentId}`
    const val = editingGrades[key]
    if (val === undefined) return
    const score = parseFloat(val)
    if (isNaN(score)) return

    const existing = grades.find(
      (g: any) => g.assignment_id === assignmentId && g.student_id === studentId
    )
    if (existing) {
      setGrades(grades.map((g: any) => g.id === existing.id ? { ...g, score } : g))
      await fetch('/api/docente/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ existingId: existing.id, score }),
      })
    } else {
      const id = uuidv4()
      const newGrade = { id, assignment_id: assignmentId, student_id: studentId, score,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      setGrades(prev => [...prev, newGrade])
      await fetch('/api/docente/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ id, assignment_id: assignmentId, student_id: studentId, score }),
      })
    }
    const updated = { ...editingGrades }
    delete updated[key]
    setEditingGrades(updated)
    toast.success('Nota guardada', { icon: '📝' })
  }

  function getGrade(assignmentId: string, studentId: string): number | null {
    const g = grades.find((g: any) => g.assignment_id === assignmentId && g.student_id === studentId)
    return g != null ? g.score : null
  }

  function gradeColor(s: number | null) {
    if (s === null) return 'text-ink4'
    if (s < 7)   return 'text-rose-500'
    if (s < 8.5) return 'text-amber-500'
    return 'text-emerald-500'
  }
  function gradeBg(s: number | null) {
    if (s === null) return ''
    if (s < 7)   return 'bg-rose-500/10'
    if (s < 8.5) return 'bg-amber-500/10'
    return 'bg-emerald-500/10'
  }

  // ════════════════════════════════════════════════════════════════════════
  //  COMPORTAMIENTO — añadir / eliminar
  // ════════════════════════════════════════════════════════════════════════
  async function addBehavior(studentId: string) {
    if (!newBehDesc.trim()) { toast.error('Escribe una descripción'); return }
    setSavingBeh(true)
    try {
      const res = await fetch('/api/docente/behavior', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject_id:     selectedSubjectId,
          student_id:     studentId,
          type:           newBehType,
          description:    newBehDesc,
          date:           toISO(new Date()),
          institution_id: instId,
        }),
      })
      const { data } = await res.json()
      if (data) {
        setBehaviors(prev => [data, ...prev])
        setNewBehDesc('')
        toast.success('Observación guardada')
      }
    } finally { setSavingBeh(false) }
  }

  async function deleteBehavior(id: string) {
    await fetch(`/api/docente/behavior?id=${id}`, { method: 'DELETE' })
    setBehaviors(prev => prev.filter((b: any) => b.id !== id))
    toast.success('Eliminado')
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER: PANEL INFORMATIVO
  // ════════════════════════════════════════════════════════════════════════
  // ── Build teacher's personal schedule from saved horarios ─────────────────
  const teacherName = profile?.full_name || ''
  const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes'] as const

  // Extract teacher's subjects names tied to their specific courses for matching
  const mySubjectsMap: Record<string, Set<string>> = {}
  mySubjects.forEach((s: any) => {
    const cName = s.course?.name || ''
    const cPar  = s.course?.parallel || ''
    const fullCourseName = `${cName}${cPar ? ` ${cPar}` : ''}`.trim()
    if (!mySubjectsMap[fullCourseName]) mySubjectsMap[fullCourseName] = new Set()
    mySubjectsMap[fullCourseName].add((s.name || '').toUpperCase().trim())
  })

  // ── Per-slot data: config + teacher's grid (dia → periodoIndex → {materia, curso}) ──
  type ScheduleCell = { materia: string; curso: string }
  type SlotData = {
    key: string
    config: any
    // Teacher's personal grid: dia → array[nPeriodos] of cell | null
    grid: Record<string, (ScheduleCell | null)[]>
    cursos: string[]
  }
  const slotsData: SlotData[] = []

  Object.entries(horariosData).forEach(([key, slot]: [string, any]) => {
    const horario  = slot?.horario  || {}
    const config   = slot?.config   || {}
    const nPeriods = config.nPeriodos || config.horarios?.length || 8
    const recesos  = new Set<number>(config.recesos || [4])

    // Build this teacher's grid for this slot
    const grid: Record<string, (ScheduleCell | null)[]> = {}
    DIAS_SEMANA.forEach(d => { grid[d] = Array(nPeriods).fill(null) })

    const cursosInSlot = new Set<string>()

    Object.entries(horario).forEach(([curso, dias]: [string, any]) => {
      Object.entries(dias || {}).forEach(([dia, materias]: [string, any]) => {
        if (!Array.isArray(materias) || !grid[dia]) return
        materias.forEach((materia: string, idx: number) => {
          if (!materia || recesos.has(idx)) return
          if (mySubjectsMap[curso] && mySubjectsMap[curso].has(materia.toUpperCase().trim())) {
            grid[dia][idx] = { materia, curso }
            cursosInSlot.add(curso)
          }
        })
      })
    })

    if (cursosInSlot.size > 0) {
      slotsData.push({ key, config, grid, cursos: Array.from(cursosInSlot).sort() })
    }
  })

  const hasSchedule = slotsData.length > 0

  // Today's info
  const now       = new Date()
  const dayIndex  = now.getDay()
  const todayName = dayIndex >= 1 && dayIndex <= 5 ? DIAS_SEMANA[dayIndex - 1] : null

  // Today's classes across all slots
  const todayClasses: { materia: string; curso: string; hora: string; periodoIdx: number; slotLabel: string }[] = []
  slotsData.forEach(slot => {
    if (!todayName) return
    const perArr = slot.config.horarios || []
    const rec    = new Set<number>(slot.config.recesos || [4])
    slot.grid[todayName]?.forEach((cell, idx) => {
      if (cell && !rec.has(idx)) {
        todayClasses.push({
          materia: cell.materia,
          curso: cell.curso,
          hora: perArr[idx] || `Período ${idx + 1}`,
          periodoIdx: idx,
          slotLabel: `${slot.config.nivel || ''} ${slot.config.jornada || ''}`.trim(),
        })
      }
    })
  })
  todayClasses.sort((a, b) => a.periodoIdx - b.periodoIdx)

  // Greeting based on time of day
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = teacherName.split(' ')[0] || 'Docente'

  // Stats
  const totalAlumnos = new Set(enrollments.map((e: any) => e.student_id)).size
  const totalTareas  = assignments.length
  const totalHorasSem = mySubjects.reduce((acc: number, s: any) => acc + (s.weekly_hours || 0), 0)

  if (!selectedSubjectId) {
    return (
      <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
        {/* ── Header con saludo ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-ink3 text-sm mt-1" suppressHydrationWarning>
              {todayName
                ? `${todayName}, ${now.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `${now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
              }
            </p>
          </div>
        </div>

        {/* ── Stats rápidos ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Materias',      value: mySubjects.length, icon: '📚', color: '#7C6DFA' },
            { label: 'Alumnos',       value: totalAlumnos,      icon: '👥', color: '#14B8A6' },
            { label: 'Tareas',        value: totalTareas,       icon: '📝', color: '#F59E0B' },
            { label: 'Horas/semana',  value: totalHorasSem,     icon: '⏱',  color: '#3B82F6' },
          ].map(stat => (
            <div key={stat.label} className="bg-surface rounded-2xl border border-surface2 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink4">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ── Clases de hoy ──────────────────────────────────────────────── */}
        {todayName && (
          <div className="bg-surface rounded-2xl border border-surface2 p-5">
            <h2 className="font-display text-base font-bold tracking-tight mb-3 flex items-center gap-2">
              📅 Clases de hoy
              <span className="text-xs font-normal text-ink4 ml-1">
                {todayClasses.length === 0 ? 'No tienes clases hoy' : `${todayClasses.length} clase${todayClasses.length > 1 ? 's' : ''}`}
              </span>
            </h2>
            {todayClasses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {todayClasses.map((entry, i) => {
                  const color = courseColorMap[entry.curso] || CARD_COLORS[i % CARD_COLORS.length]
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface2 bg-bg min-w-[200px]"
                    >
                      <div
                        style={{ backgroundColor: color }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      >
                        {entry.hora.split('-')[0]?.trim().slice(0,5) || ''}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-ink truncate">{entry.materia}</div>
                        <div className="text-xs text-ink4 truncate">{entry.curso} · {entry.hora}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-ink4">🎉 ¡Día libre! No tienes clases programadas.</p>
            )}
          </div>
        )}
        {!todayName && (
          <div className="bg-surface rounded-2xl border border-surface2 p-5 text-center">
            <p className="text-sm text-ink3">🎉 ¡Es fin de semana! Disfruta tu descanso.</p>
          </div>
        )}

        {/* ── Horario semanal del docente ─────────────────────────────────── */}
        {/* ── Horario semanal del docente ─────────────────────────────────── */}
        {hasSchedule && (() => {
          // All courses across all slots
          const allCursos = slotsData.flatMap(s => s.cursos)
          const uniqueCursos = Array.from(new Set(allCursos)).sort()

          // Determine which slots to show based on filter
          const activeSlots = horarioFilter === 'TODOS'
            ? slotsData
            : slotsData.filter(s => s.cursos.includes(horarioFilter))

          return (
            <div className="bg-surface rounded-2xl border border-surface2 p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h2 className="font-display text-base font-bold tracking-tight flex items-center gap-2">
                  🗓 Mi Horario Semanal
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setHorarioFilter('TODOS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      horarioFilter === 'TODOS'
                        ? 'bg-violet text-white shadow-glow'
                        : 'bg-bg text-ink3 hover:bg-surface2 border border-surface2'
                    }`}
                  >
                    Todos
                  </button>
                  {uniqueCursos.map(curso => {
                    const color = courseColorMap[curso] || '#94A3B8'
                    const isActive = horarioFilter === curso
                    return (
                      <button
                        key={curso}
                        onClick={() => setHorarioFilter(curso)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          isActive ? 'text-white shadow-sm' : 'text-ink3 hover:text-ink bg-bg'
                        }`}
                        style={isActive
                          ? { backgroundColor: color, borderColor: color }
                          : { borderColor: color + '40' }
                        }
                      >
                        {curso}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Render one table per slot (each slot has its own hours/recesos) */}
              <div className="space-y-6">
                {activeSlots.map(slot => {
                  const cfg      = slot.config
                  const horarios = cfg.horarios || []
                  const rec      = new Set<number>(cfg.recesos || [4])
                  const nPeriods = horarios.length || cfg.nPeriodos || 8
                  const slotLabel = `${cfg.nivel === 'Escuela' ? '🏫 Escuela / Básica' : '🎓 Colegio / Bachillerato'} — ${cfg.jornada === 'MATUTINA' ? '🌅 Matutina' : '🌇 Vespertina'}`

                  return (
                    <div key={slot.key}>
                      {/* Slot header (only if multiple slots visible) */}
                      {activeSlots.length > 1 && (
                        <div className="text-xs font-semibold text-ink3 mb-2 px-1">{slotLabel}</div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr>
                              <th className="text-left p-2 text-ink4 font-semibold border-b border-surface2 w-24">Hora</th>
                              {DIAS_SEMANA.map(d => (
                                <th
                                  key={d}
                                  className={`text-center p-2 font-semibold border-b border-surface2 ${
                                    d === todayName ? 'text-violet bg-[rgba(124,109,250,0.06)]' : 'text-ink4'
                                  }`}
                                >
                                  {d.slice(0, 3).toUpperCase()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: nPeriods }, (_, idx) => {
                              const isRecess = rec.has(idx)
                              const timeLabel = horarios[idx] || `${idx + 1}°`

                              if (isRecess) return (
                                <tr key={idx} className="bg-[rgba(255,179,71,0.05)]">
                                  <td className="p-2 text-ink4 font-medium border-b border-surface2 text-center whitespace-nowrap">
                                    ☕ {timeLabel}
                                  </td>
                                  {DIAS_SEMANA.map(d => (
                                    <td key={d} className="p-1 text-center border-b border-surface2 text-ink4 text-[10px]">
                                      Recreo
                                    </td>
                                  ))}
                                </tr>
                              )

                              return (
                                <tr key={idx} className="hover:bg-bg/50">
                                  <td className="p-2 text-ink4 font-medium border-b border-surface2 whitespace-nowrap">
                                    {timeLabel}
                                  </td>
                                  {DIAS_SEMANA.map(d => {
                                    const cell = slot.grid[d]?.[idx]
                                    // If filtering by course, only show that course
                                    if (cell && horarioFilter !== 'TODOS' && cell.curso !== horarioFilter) {
                                      return (
                                        <td key={d} className={`p-1 text-center border-b border-surface2 ${d === todayName ? 'bg-[rgba(124,109,250,0.04)]' : ''}`}>
                                          <span className="text-ink4/40">—</span>
                                        </td>
                                      )
                                    }
                                    if (!cell) return (
                                      <td key={d} className={`p-1 text-center border-b border-surface2 ${d === todayName ? 'bg-[rgba(124,109,250,0.04)]' : ''}`}>
                                        <span className="text-ink4/40">—</span>
                                      </td>
                                    )
                                    const color = courseColorMap[cell.curso] || '#94A3B8'
                                    return (
                                      <td
                                        key={d}
                                        className={`p-1 border-b border-surface2 ${d === todayName ? 'bg-[rgba(124,109,250,0.04)]' : ''}`}
                                      >
                                        <div
                                          className="rounded-lg px-2 py-1.5 text-center"
                                          style={{ backgroundColor: color + '18', borderLeft: `3px solid ${color}` }}
                                        >
                                          <div className="font-semibold text-ink truncate" style={{ fontSize: '10px' }}>
                                            {cell.materia}
                                          </div>
                                          <div className="text-ink4 truncate" style={{ fontSize: '9px' }}>
                                            {cell.curso}
                                          </div>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Mis Clases (cuadernillo) ────────────────────────────────────── */}
        <div>
          <h2 className="font-display text-base font-bold tracking-tight mb-3 flex items-center gap-2">
            📖 Mis Clases
            <span className="text-xs font-normal text-ink4">Asistencia · Calificaciones · Comportamiento</span>
          </h2>

          {mySubjects.length === 0 ? (
            <div className="p-14 text-center text-ink3 bg-surface rounded-3xl border border-surface2">
              <BookOpen size={36} className="mx-auto mb-3 text-ink4" />
              <p className="font-semibold">No tienes materias asignadas</p>
              <p className="text-sm text-ink4 mt-1">El administrador debe asignarte en Gestión Académica.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mySubjects.map((s: any) => {
                const color    = getSubjectColor(s, courseColorMap)
                const studs    = enrollments.filter((e: any) => e.course_id === s.course?.id)
                const asgCount = assignments.filter((a: any) => a.subject_id === s.id).length
                const initial  = s.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

                return (
                  <button
                    key={s.id}
                    onClick={() => openSubject(s.id)}
                    className="bg-surface rounded-2xl border border-surface2 overflow-hidden text-left hover:border-violet/40 hover:shadow-lg transition-all group"
                  >
                    <div style={{ backgroundColor: color }} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-sm leading-tight truncate">{s.name}</div>
                        <div className="text-white/70 text-xs truncate">
                          {s.course?.name} {s.course?.parallel}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-ink3">
                        <span className="flex items-center gap-1"><Users size={12} /> {studs.length}</span>
                        <span className="flex items-center gap-1"><ClipboardList size={12} /> {asgCount}</span>
                        <span className="flex items-center gap-1"><CalendarDays size={12} /> {s.weekly_hours}h</span>
                      </div>
                      <span className="text-xs text-violet group-hover:translate-x-1 transition-transform font-medium">→</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER: DETALLE DE CLASE
  // ════════════════════════════════════════════════════════════════════════
  const color = selectedSubject ? getSubjectColor(selectedSubject, courseColorMap) : CARD_COLORS[0]

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-5">

      {/* Header de la clase */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSelectedSubjectId(null)}
          className="w-9 h-9 rounded-xl border border-surface2 flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ backgroundColor: color }} className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {selectedSubject?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl lg:text-2xl font-bold tracking-tight leading-tight">
            {selectedSubject?.name}
          </h1>
          <p className="text-sm text-ink3">
            {selectedSubject?.course?.name} {selectedSubject?.course?.parallel}
            {' · '}{students.length} alumnos · {selectedSubject?.weekly_hours}h/sem
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-2xl p-1 border border-surface2 overflow-x-auto">
        {([
          { id: 'asistencia',      label: 'Asistencia',      icon: CalendarDays  },
          { id: 'calificaciones',  label: 'Calificaciones',  icon: BarChart2     },
          { id: 'comportamiento',  label: 'Comportamiento',  icon: Star          },
        ] as { id: DetailTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === id ? 'bg-violet text-white shadow-glow' : 'text-ink3 hover:text-ink hover:bg-bg'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: ASISTENCIA ──────────────────────────────────────────────── */}
      {activeTab === 'asistencia' && (() => {
        const weekDates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

        // Conteo de ausencias por alumno
        const presentCount = (studentId: string) =>
          weekDates.filter(d => attendance[`${toISO(d)}_${studentId}`] === 'present').length
        const absentCount = (studentId: string) =>
          weekDates.filter(d => attendance[`${toISO(d)}_${studentId}`] === 'absent').length
        const lateCount = (studentId: string) =>
          weekDates.filter(d => attendance[`${toISO(d)}_${studentId}`] === 'late').length

        return (
          <div className="space-y-4">
            {/* Navegación semana */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekStart(d => addDays(d, -7))}
                className="w-9 h-9 rounded-xl border border-surface2 flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-ink min-w-[180px] text-center">
                {fmtWeekRange(weekStart)}
              </span>
              <button
                onClick={() => setWeekStart(d => addDays(d, 7))}
                className="w-9 h-9 rounded-xl border border-surface2 flex items-center justify-center text-ink3 hover:text-ink hover:bg-surface2 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setWeekStart(getMondayOfWeek())}
                className="text-xs text-violet hover:underline font-medium"
              >
                Hoy
              </button>
            </div>

            {students.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-amber/40 bg-amber/5 rounded-2xl">
                <div className="text-amber-700 font-semibold mb-1">No hay alumnos para mostrar</div>
                <div className="text-sm text-ink3">
                  {enrollments.length === 0
                    ? (enrollmentsDiag?.message || 'No hay alumnos matriculados en este curso.')
                    : `Esta materia no tiene alumnos matriculados en su curso. Tienes ${
                        new Set(enrollments.map((e: any) => e.student_id)).size
                      } alumno(s) en otros cursos. Verifica que la materia esté vinculada al curso correcto (Académico → Materias).`}
                </div>
                {enrollmentsDiag?.reason && enrollmentsDiag.reason !== 'ok' && (
                  <div className="text-[11px] text-ink4 mt-2">Diagnóstico: <code>{enrollmentsDiag.reason}</code></div>
                )}
                {selectedCourseId && (
                  <div className="text-[10px] text-ink4 mt-1">course_id: <code>{selectedCourseId}</code></div>
                )}
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-surface2 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap min-w-max">
                  <thead className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold sticky left-0 bg-bg3 z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                        Estudiante
                      </th>
                      {weekDates.map((d, i) => (
                        <th key={i} className="px-3 py-3 text-center font-medium min-w-[80px] text-ink3">
                          {fmtDayHeader(d)}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l border-surface2">P</th>
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l border-surface2/50">F</th>
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l border-surface2/50">A</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface">
                    {students.map((st: any, idx: number) => (
                      <tr key={st.id} className="hover:bg-bg/40 transition-colors">
                        <td className="px-4 py-2.5 sticky left-0 bg-surface hover:bg-bg/40 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink4 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                            <span className="font-medium text-ink text-xs truncate w-36" title={st.full_name}>
                              {st.full_name}
                            </span>
                          </div>
                        </td>
                        {weekDates.map((d) => {
                          const dateStr = toISO(d)
                          const key     = `${dateStr}_${st.id}`
                          const status: AttendanceStatus = attendance[key] || 'present'
                          const isToday = dateStr === toISO(new Date())
                          return (
                            <td key={dateStr} className={`px-2 py-2 text-center border-l border-surface/30 ${isToday ? 'bg-violet/5' : ''}`}>
                              <button
                                onClick={() => toggleAttendance(dateStr, st.id)}
                                title={status === 'present' ? 'Presente' : status === 'absent' ? 'Falta' : 'Atraso'}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all font-bold text-xs
                                  ${status === 'present'
                                    ? 'bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30'
                                    : status === 'absent'
                                      ? 'bg-rose-500/20 text-rose-600 hover:bg-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30'}`}
                              >
                                {status === 'present' ? 'P' : status === 'absent' ? 'F' : 'A'}
                              </button>
                            </td>
                          )
                        })}
                        {/* Conteos */}
                        <td className="px-3 py-2 text-center border-l border-surface2">
                          <span className={`text-xs font-bold ${presentCount(st.id) > 0 ? 'text-emerald-500' : 'text-ink4'}`}>
                            {presentCount(st.id)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center border-l border-surface2/50">
                          <span className={`text-xs font-bold ${absentCount(st.id) > 0 ? 'text-rose-500' : 'text-ink4'}`}>
                            {absentCount(st.id)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center border-l border-surface2/50">
                          <span className={`text-xs font-bold ${lateCount(st.id) > 0 ? 'text-amber-500' : 'text-ink4'}`}>
                            {lateCount(st.id)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Leyenda */}
            <div className="flex items-center gap-5 text-xs text-ink3 px-1">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="opacity-40" /> Presente</span>
              <span className="flex items-center gap-1.5"><XCircle size={13} className="text-rose-500" /> Falta (F)</span>
              <span className="flex items-center gap-1.5"><Clock3 size={13} className="text-amber-500" /> Atraso (A)</span>
            </div>
          </div>
        )
      })()}

      {/* ── TAB: CALIFICACIONES ──────────────────────────────────────────── */}
      {activeTab === 'calificaciones' && (() => {
        const filteredAssignments = assignments.filter(
          (a: any) => a.subject_id === selectedSubjectId
            && a.trimestre === trimestre
            && a.parcial   === parcial
        )

        const totalWeight = categories.reduce((s: number, c: any) => s + Number(c.weight_percent), 0)

        // Sort assignments by category order
        const sortedAssignments = [...filteredAssignments].sort((a, b) => {
          const catA = categories.findIndex((c: any) => c.id === a.category_id)
          const catB = categories.findIndex((c: any) => c.id === b.category_id)
          return (catA === -1 ? 999 : catA) - (catB === -1 ? 999 : catB)
        })

        // Count assignments per category — subtotal column only if 2+
        const catCount: Record<string, number> = {}
        sortedAssignments.forEach(a => {
          const cid = a.category_id || '__none__'
          catCount[cid] = (catCount[cid] || 0) + 1
        })
        const showSubtotal = (catId: string | null) => (catCount[catId || '__none__'] || 0) >= 2

        return (
          <div className="space-y-5">
            {/* Vista toggle: Parcial / Resumen Trimestral */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-surface rounded-xl p-1 border border-surface2">
                <button onClick={() => setCalView('parcial')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${calView === 'parcial' ? 'bg-violet text-white' : 'text-ink3 hover:text-ink hover:bg-bg'}`}>
                  Por Parcial
                </button>
                <button onClick={() => setCalView('resumen')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${calView === 'resumen' ? 'bg-violet text-white' : 'text-ink3 hover:text-ink hover:bg-bg'}`}>
                  Resumen Trimestral
                </button>
              </div>
              <div className="flex gap-1 bg-surface rounded-xl p-1 border border-surface2">
                {[1, 2, 3].map(t => (
                  <button key={t} onClick={() => setTrimestre(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${trimestre === t ? 'bg-teal text-white' : 'text-ink3 hover:text-ink hover:bg-bg'}`}>
                    T{t}
                  </button>
                ))}
              </div>
              {calView === 'parcial' && (
                <div className="flex gap-1 bg-surface rounded-xl p-1 border border-surface2">
                  {Array.from({ length: parcialesCount }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setParcial(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${parcial === p ? 'bg-amber-500 text-white' : 'text-ink3 hover:text-ink hover:bg-bg'}`}>
                      P{p}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-xs text-ink3">
                {calView === 'parcial' ? `Trimestre ${trimestre} · Parcial ${parcial}` : `Resumen Trimestre ${trimestre}`}
              </span>
              <div className="ml-auto">
                <button onClick={openNewCat}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface2 text-xs font-semibold text-ink3 hover:text-ink hover:bg-surface2 transition-all">
                  <Settings size={13} /> Categorías
                </button>
              </div>
            </div>

            {/* ═══ VISTA RESUMEN TRIMESTRAL ═══ */}
            {calView === 'resumen' && (() => {
              // Calcular promedios por parcial y examen para cada estudiante
              const getParcialAvg = (studentId: string, p: number): number | null => {
                const pAsgs = assignments.filter((a: any) =>
                  a.subject_id === selectedSubjectId && a.trimestre === trimestre && a.parcial === p
                )
                return getWeightedAvg(studentId, pAsgs)
              }

              const getExamScore = (studentId: string): number | null => {
                const examAsgs = assignments.filter((a: any) =>
                  a.subject_id === selectedSubjectId && a.trimestre === trimestre && a.parcial === 0
                )
                if (examAsgs.length === 0) return null
                const scores = examAsgs.map((a: any) => getGrade(a.id, studentId)).filter((g): g is number => g !== null)
                return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
              }

              const getTrimestreAvg = (studentId: string): number | null => {
                const parcialAvgs: number[] = []
                for (let p = 1; p <= parcialesCount; p++) {
                  const avg = getParcialAvg(studentId, p)
                  if (avg !== null) parcialAvgs.push(avg)
                }
                const exam = getExamScore(studentId)

                if (parcialAvgs.length === 0 && exam === null) return null

                // 70% parciales + 30% examen
                const parcialMean = parcialAvgs.length > 0
                  ? parcialAvgs.reduce((a, b) => a + b, 0) / parcialAvgs.length
                  : null

                if (exam !== null && parcialMean !== null) {
                  return parcialMean * 0.7 + exam * 0.3
                }
                return parcialMean
              }

              const getParcialMean = (studentId: string): number | null => {
                const parcialAvgs: number[] = []
                for (let p = 1; p <= parcialesCount; p++) {
                  const avg = getParcialAvg(studentId, p)
                  if (avg !== null) parcialAvgs.push(avg)
                }
                return parcialAvgs.length > 0
                  ? parcialAvgs.reduce((a, b) => a + b, 0) / parcialAvgs.length
                  : null
              }

              const examAssignments = assignments.filter((a: any) =>
                a.subject_id === selectedSubjectId && a.trimestre === trimestre && a.parcial === 0
              )

              return (
                <div className="space-y-4">
                  {/* Tabla resumen */}
                  <div className="bg-surface rounded-2xl border border-surface2 overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead>
                        <tr className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2">
                          <th className="px-4 py-3 text-left font-bold w-48">Estudiante</th>
                          {Array.from({ length: parcialesCount }, (_, i) => (
                            <th key={i} className="px-3 py-3 text-center font-bold min-w-[80px]">
                              P{i + 1}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center font-bold min-w-[110px] border-l-2 border-emerald-400"
                            style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
                            Prom. Parciales
                            <div className="text-[9px] font-normal text-ink4 normal-case tracking-normal">70%</div>
                          </th>
                          <th className="px-3 py-3 text-center font-bold min-w-[100px] border-l-2 border-amber-300"
                            style={{ backgroundColor: 'rgba(245,158,11,0.08)' }}>
                            Examen
                            <div className="text-[9px] font-normal text-ink4 normal-case tracking-normal">30%</div>
                          </th>
                          <th className="px-3 py-3 text-center font-bold min-w-[110px] border-l-2 border-surface2"
                            style={{ backgroundColor: 'rgba(124,109,250,0.08)' }}>
                            Prom. T{trimestre}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface">
                        {students.map((st: any) => {
                          const examScore = getExamScore(st.id)
                          const triAvg = getTrimestreAvg(st.id)
                          return (
                            <tr key={st.id} className="hover:bg-bg/40 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-xs text-ink truncate block w-40" title={st.full_name}>
                                  {st.full_name}
                                </span>
                              </td>
                              {Array.from({ length: parcialesCount }, (_, i) => {
                                const avg = getParcialAvg(st.id, i + 1)
                                return (
                                  <td key={i} className={`px-3 py-2.5 text-center font-semibold ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                                    {avg !== null ? avg.toFixed(2) : '—'}
                                  </td>
                                )
                              })}
                              {(() => {
                                const pmean = getParcialMean(st.id)
                                return (
                                  <td className={`px-3 py-2.5 text-center font-bold border-l-2 border-emerald-400 ${pmean !== null ? gradeColor(pmean) : 'text-ink4'}`}
                                    style={{ backgroundColor: 'rgba(16,185,129,0.04)' }}>
                                    {pmean !== null ? pmean.toFixed(2) : '—'}
                                  </td>
                                )
                              })()}
                              <td className={`px-3 py-2.5 text-center font-semibold border-l-2 border-amber-300 ${examScore !== null ? gradeColor(examScore) : 'text-ink4'}`}
                                style={{ backgroundColor: 'rgba(245,158,11,0.04)' }}>
                                {examScore !== null ? examScore.toFixed(2) : '—'}
                              </td>
                              <td className={`px-3 py-2.5 text-center font-bold text-base border-l-2 border-surface2 ${triAvg !== null ? gradeColor(triAvg) : 'text-ink4'}`}
                                style={{ backgroundColor: 'rgba(124,109,250,0.04)' }}>
                                {triAvg !== null ? triAvg.toFixed(2) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Crear examen trimestral */}
                  <div className="bg-surface rounded-2xl border border-surface2 p-4">
                    <h3 className="font-bold text-sm text-ink mb-3">
                      + Examen Trimestral · T{trimestre}
                    </h3>
                    <form onSubmit={(e) => {
                      e.preventDefault()
                      const title = (e.currentTarget.elements.namedItem('examTitle') as HTMLInputElement).value
                      if (!title.trim()) return
                      const id = uuidv4()
                      const newAsg = {
                        id, subject_id: selectedSubjectId,
                        title, description: 'Examen Trimestral',
                        due_date: null, trimestre, parcial: 0,
                        category_id: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      }
                      setAssignments((prev: any[]) => [newAsg, ...prev])
                      fetch('/api/docente/assignments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newAsg),
                      })
                      toast.success('Examen trimestral creado')
                      ;(e.target as HTMLFormElement).reset()
                    }} className="flex gap-3 items-end">
                      <input name="examTitle" required
                        placeholder={`Ej. Examen T${trimestre}`}
                        defaultValue={`Examen Trimestral T${trimestre}`}
                        className="flex-1 min-w-[200px] bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                      <button type="submit"
                        className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0">
                        <Plus size={14} /> Crear Examen
                      </button>
                    </form>
                    {examAssignments.length > 0 && (
                      <div className="mt-3 text-xs text-ink3">
                        Examenes creados: {examAssignments.map((a: any) => a.title).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Notas del examen */}
                  {examAssignments.length > 0 && (
                    <div className="bg-surface rounded-2xl border border-surface2 overflow-x-auto">
                      <div className="px-4 py-3 border-b border-surface2">
                        <h3 className="font-bold text-sm text-ink">Notas del Examen Trimestral</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2">
                            <th className="px-4 py-2 text-left font-bold w-48">Estudiante</th>
                            {examAssignments.map((a: any) => (
                              <th key={a.id} className="px-3 py-2 text-center font-medium min-w-[100px]">
                                {a.title}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface">
                          {students.map((st: any) => (
                            <tr key={st.id} className="hover:bg-bg/40 transition-colors">
                              <td className="px-4 py-2">
                                <span className="font-medium text-xs text-ink">{st.full_name}</span>
                              </td>
                              {examAssignments.map((a: any) => {
                                const key = `${a.id}_${st.id}`
                                const isEdit = editingGrades[key] !== undefined
                                const cur = isEdit ? editingGrades[key] : (getGrade(a.id, st.id) ?? '')
                                const score = cur !== '' ? Number(cur) : null
                                return (
                                  <td key={a.id} className={`px-3 py-2 text-center ${!isEdit && score !== null ? gradeBg(score) : ''}`}>
                                    <input
                                      type="number" min="0" max="10" step="0.01"
                                      value={cur}
                                      onChange={e => handleGradeChange(a.id, st.id, e.target.value)}
                                      onBlur={() => handleSaveGrade(a.id, st.id)}
                                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                      placeholder="—"
                                      className={`w-16 h-8 text-center text-sm font-bold bg-transparent border-b-2 rounded-none outline-none transition-all
                                        ${isEdit ? 'border-teal text-teal' : score !== null ? `border-transparent ${gradeColor(score)}` : 'border-transparent text-ink4 hover:border-surface2'}`}
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Info */}
                  <div className="rounded-lg p-3 text-xs flex items-start gap-2"
                    style={{ background: 'rgba(124,109,250,0.08)', color: 'rgba(124,109,250,0.9)' }}>
                    <BarChart2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      <b>Promedio Trimestral</b> = 70% promedio de parciales + 30% examen trimestral.
                      Si no hay examen registrado, el promedio se calcula solo con los parciales.
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* ═══ VISTA POR PARCIAL ═══ */}
            {calView === 'parcial' && (<>

            {/* Leyenda de categorías */}
            {categories.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap text-xs">
                {categories.map((c: any) => (
                  <button key={c.id} onClick={() => openEditCat(c)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface2 transition-colors cursor-pointer">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: c.color }} />
                    <span className="text-ink3">{c.name}: ({Number(c.weight_percent).toFixed(0)}%)</span>
                  </button>
                ))}
                {totalWeight !== 100 && (
                  <span className="text-rose-500 font-semibold">
                    ⚠ Total: {totalWeight.toFixed(0)}% (debe ser 100%)
                  </span>
                )}
              </div>
            )}

            {/* Formulario nueva tarea */}
            <div className="bg-surface rounded-2xl border border-surface2 p-4">
              <h3 className="font-bold text-sm text-ink mb-3">
                + Nueva actividad · T{trimestre} P{parcial}
              </h3>
              <form onSubmit={handleCreateAssignment} className="flex flex-wrap gap-3 items-end">
                {categories.length > 0 && (
                  <select value={newAsgCatId} onChange={e => setNewAsgCatId(e.target.value)}
                    className="bg-bg border border-surface2 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-violet min-w-[180px]"
                    style={newAsgCatId ? { borderLeftColor: getCatColor(newAsgCatId), borderLeftWidth: 3 } : {}}>
                    <option value="">Tipo de actividad...</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <input required value={newAsgTitle} onChange={e => setNewAsgTitle(e.target.value)}
                  placeholder="Nombre de la actividad"
                  className="flex-1 min-w-[180px] bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                <input value={newAsgDesc} onChange={e => setNewAsgDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="flex-1 min-w-[140px] bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                <input type="date" value={newAsgDate} onChange={e => setNewAsgDate(e.target.value)}
                  className="bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet w-36" />
                <button type="submit"
                  className="bg-violet hover:bg-violet2 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-glow flex items-center gap-2 flex-shrink-0">
                  <Plus size={14} /> Publicar
                </button>
              </form>
            </div>

            {/* Tabla de notas */}
            {sortedAssignments.length === 0 || students.length === 0 ? (
              <div className={`p-8 text-center border border-dashed rounded-2xl ${
                students.length === 0 ? 'border-amber/40 bg-amber/5' : 'border-surface2 text-ink4'
              }`}>
                {sortedAssignments.length === 0 && students.length > 0 ? (
                  `No hay actividades en T${trimestre} P${parcial}. Crea la primera arriba.`
                ) : students.length === 0 ? (
                  <>
                    <div className="text-amber-700 font-semibold mb-1">No hay alumnos para mostrar</div>
                    <div className="text-sm text-ink3">
                      {enrollments.length === 0
                        ? (enrollmentsDiag?.message || 'No hay alumnos matriculados en este curso.')
                        : `Esta materia no tiene alumnos matriculados en su curso. Tienes ${
                            new Set(enrollments.map((e: any) => e.student_id)).size
                          } alumno(s) en otros cursos. Verifica que la materia esté vinculada al curso correcto (Académico → Materias).`}
                    </div>
                    {enrollmentsDiag?.reason && enrollmentsDiag.reason !== 'ok' && (
                      <div className="text-[11px] text-ink4 mt-2">Diagnóstico: <code>{enrollmentsDiag.reason}</code></div>
                    )}
                    {selectedCourseId && (
                      <div className="text-[10px] text-ink4 mt-1">course_id: <code>{selectedCourseId}</code></div>
                    )}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-surface2 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap min-w-max">
                  <thead>
                    {/* Fila de color de categoría */}
                    <tr>
                      <th className="sticky left-0 bg-bg3 z-10" />
                      {(() => {
                        const cols: React.ReactNode[] = []
                        let lastCatId: string | null | undefined = undefined
                        sortedAssignments.forEach((a: any, i: number) => {
                          if (lastCatId !== undefined && a.category_id !== lastCatId && showSubtotal(lastCatId)) {
                            cols.push(<th key={`sub-bar-${i}`} className="px-0 py-0 h-1.5" style={{ backgroundColor: getCatColor(lastCatId) }} />)
                          }
                          cols.push(<th key={a.id} className="px-0 py-0 h-1.5" style={{ backgroundColor: getCatColor(a.category_id) }} />)
                          lastCatId = a.category_id
                        })
                        if (lastCatId !== undefined && showSubtotal(lastCatId)) {
                          cols.push(<th key="sub-bar-last" className="px-0 py-0 h-1.5" style={{ backgroundColor: getCatColor(lastCatId) }} />)
                        }
                        return cols
                      })()}
                      <th className="bg-bg3" />
                    </tr>
                    {/* Fila de títulos */}
                    <tr className="bg-bg3 text-xs uppercase tracking-wider border-b border-surface2">
                      <th className="px-4 py-3 text-left font-bold sticky left-0 bg-bg3 z-10 w-48 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                        Estudiante
                      </th>
                      {(() => {
                        const cols: React.ReactNode[] = []
                        let lastCatId: string | null | undefined = undefined
                        sortedAssignments.forEach((a: any, i: number) => {
                          if (lastCatId !== undefined && a.category_id !== lastCatId && showSubtotal(lastCatId)) {
                            // Insert subtotal header for previous category
                            const prevCat = categories.find((c: any) => c.id === lastCatId)
                            cols.push(
                              <th key={`sub-hdr-${i}`} className="px-2 py-3 text-center min-w-[70px] border-l-2 border-r-2" 
                                style={{ borderColor: getCatColor(lastCatId), backgroundColor: `${getCatColor(lastCatId)}10` }}>
                                <div className="text-[9px] font-bold" style={{ color: getCatColor(lastCatId) }}>
                                  {prevCat ? prevCat.name.split(':').pop()?.trim() : 'Prom.'}
                                </div>
                                <div className="text-[8px] font-normal text-ink4 normal-case tracking-normal">
                                  {prevCat ? `${Number(prevCat.weight_percent).toFixed(0)}%` : ''}
                                </div>
                              </th>
                            )
                          }
                          cols.push(
                            <th key={a.id} className="px-3 py-3 text-center font-medium min-w-[100px] cursor-pointer hover:bg-bg/60 transition-colors"
                              style={{ borderTop: `3px solid ${getCatColor(a.category_id)}` }}
                              onClick={() => openActivityModal(a)}>
                              <div className="truncate w-20 mx-auto font-semibold text-ink2" title={a.title}>{a.title}</div>
                              <div className="text-[9px] font-normal mt-0.5 normal-case tracking-normal" style={{ color: getCatColor(a.category_id) }}>
                                {getCatName(a.category_id)}
                              </div>
                            </th>
                          )
                          lastCatId = a.category_id
                        })
                        // Last category subtotal header
                        if (lastCatId !== undefined && showSubtotal(lastCatId)) {
                          const lastCat = categories.find((c: any) => c.id === lastCatId)
                          cols.push(
                            <th key="sub-hdr-last" className="px-2 py-3 text-center min-w-[70px] border-l-2 border-r-2"
                              style={{ borderColor: getCatColor(lastCatId), backgroundColor: `${getCatColor(lastCatId)}10` }}>
                              <div className="text-[9px] font-bold" style={{ color: getCatColor(lastCatId) }}>
                                {lastCat ? lastCat.name.split(':').pop()?.trim() : 'Prom.'}
                              </div>
                              <div className="text-[8px] font-normal text-ink4 normal-case tracking-normal">
                                {lastCat ? `${Number(lastCat.weight_percent).toFixed(0)}%` : ''}
                              </div>
                            </th>
                          )
                        }
                        return cols
                      })()}
                      <th className="px-3 py-3 text-center font-bold text-ink3 border-l-2 border-surface2 min-w-[70px] bg-bg3">
                        Prom.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface">
                    {students.map((st: any) => {
                      const avg = getWeightedAvg(st.id, sortedAssignments)
                      return (
                        <tr key={st.id} className="hover:bg-bg/40 transition-colors group">
                          <td className="px-4 py-2.5 sticky left-0 bg-surface group-hover:bg-bg/40 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50 transition-colors">
                            <span className="font-medium text-xs text-ink truncate block w-40" title={st.full_name}>{st.full_name}</span>
                          </td>
                          {(() => {
                            const cells: React.ReactNode[] = []
                            let lastCatId: string | null | undefined = undefined
                            sortedAssignments.forEach((a: any, i: number) => {
                              if (lastCatId !== undefined && a.category_id !== lastCatId && showSubtotal(lastCatId)) {
                                // Insert subtotal cell for previous category
                                const prevCatAsgs = sortedAssignments.filter((x: any) => x.category_id === lastCatId)
                                const scores = prevCatAsgs.map((x: any) => getGrade(x.id, st.id)).filter((g: any): g is number => g !== null)
                                const catAvg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
                                cells.push(
                                  <td key={`sub-${i}`} className="px-2 py-2 text-center border-l-2 border-r-2"
                                    style={{ borderColor: getCatColor(lastCatId), backgroundColor: `${getCatColor(lastCatId)}08` }}>
                                    <span className={`text-sm font-bold ${catAvg !== null ? gradeColor(catAvg) : 'text-ink4'}`}>
                                      {catAvg !== null ? catAvg.toFixed(1) : '—'}
                                    </span>
                                  </td>
                                )
                              }
                              const key    = `${a.id}_${st.id}`
                              const isEdit = editingGrades[key] !== undefined
                              const cur    = isEdit ? editingGrades[key] : (getGrade(a.id, st.id) ?? '')
                              const score  = cur !== '' ? Number(cur) : null
                              cells.push(
                                <td key={a.id} className={`px-3 py-2 text-center border-l border-surface/30 ${!isEdit && score !== null ? gradeBg(score) : ''}`}>
                                  <input
                                    type="number" min="0" max="10" step="0.01"
                                    value={cur}
                                    onChange={e => handleGradeChange(a.id, st.id, e.target.value)}
                                    onBlur={() => handleSaveGrade(a.id, st.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                    placeholder="—"
                                    className={`w-16 h-8 text-center text-sm font-bold bg-transparent border-b-2 rounded-none outline-none transition-all
                                      ${isEdit ? 'border-teal text-teal' : score !== null ? `border-transparent ${gradeColor(score)}` : 'border-transparent text-ink4 hover:border-surface2'}`}
                                  />
                                </td>
                              )
                              lastCatId = a.category_id
                            })
                            // Last category subtotal
                            if (lastCatId !== undefined && showSubtotal(lastCatId)) {
                              const lastCatAsgs = sortedAssignments.filter((x: any) => x.category_id === lastCatId)
                              const scores = lastCatAsgs.map((x: any) => getGrade(x.id, st.id)).filter((g: any): g is number => g !== null)
                              const catAvg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
                              cells.push(
                                <td key="sub-last" className="px-2 py-2 text-center border-l-2 border-r-2"
                                  style={{ borderColor: getCatColor(lastCatId), backgroundColor: `${getCatColor(lastCatId)}08` }}>
                                  <span className={`text-sm font-bold ${catAvg !== null ? gradeColor(catAvg) : 'text-ink4'}`}>
                                    {catAvg !== null ? catAvg.toFixed(1) : '—'}
                                  </span>
                                </td>
                              )
                            }
                            return cells
                          })()}
                          <td className={`px-3 py-2 text-center font-bold text-sm border-l-2 border-surface2 ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                            {avg !== null ? avg.toFixed(1) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Fila promedio por tarea */}
                    <tr className="bg-bg3 border-t-2 border-surface2">
                      <td className="px-4 py-2 sticky left-0 bg-bg3 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] border-r border-surface/50">
                        <span className="text-xs font-bold text-ink3 uppercase tracking-wide">Promedio clase</span>
                      </td>
                      {(() => {
                        const cells: React.ReactNode[] = []
                        let lastCatId: string | null | undefined = undefined
                        sortedAssignments.forEach((a: any, i: number) => {
                          if (lastCatId !== undefined && a.category_id !== lastCatId && showSubtotal(lastCatId)) {
                            // Subtotal promedio clase para categoría
                            const prevCatAsgs = sortedAssignments.filter((x: any) => x.category_id === lastCatId)
                            const allScores = students.flatMap((st: any) => {
                              const sc = prevCatAsgs.map((x: any) => getGrade(x.id, st.id)).filter((g: any): g is number => g !== null)
                              return sc.length > 0 ? [sc.reduce((a: number, b: number) => a + b, 0) / sc.length] : []
                            })
                            const classAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null
                            cells.push(
                              <td key={`sub-class-${i}`} className="px-2 py-2 text-center border-l-2 border-r-2"
                                style={{ borderColor: getCatColor(lastCatId), backgroundColor: `${getCatColor(lastCatId)}08` }}>
                                <span className={`text-sm font-bold ${classAvg !== null ? gradeColor(classAvg) : 'text-ink4'}`}>
                                  {classAvg !== null ? classAvg.toFixed(1) : '—'}
                                </span>
                              </td>
                            )
                          }
                          const sc  = students.map((st: any) => getGrade(a.id, st.id)).filter((g): g is number => g !== null)
                          const avg = sc.length > 0 ? sc.reduce((x: number, y: number) => x + y, 0) / sc.length : null
                          cells.push(
                            <td key={a.id} className={`px-3 py-2 text-center font-bold text-sm border-l border-surface/30 ${avg !== null ? gradeColor(avg) : 'text-ink4'}`}>
                              {avg !== null ? avg.toFixed(1) : '—'}
                            </td>
                          )
                          lastCatId = a.category_id
                        })
                        // Last category class subtotal
                        if (lastCatId !== undefined && showSubtotal(lastCatId)) {
                          const lastCatAsgs = sortedAssignments.filter((x: any) => x.category_id === lastCatId)
                          const allScores = students.flatMap((st: any) => {
                            const sc = lastCatAsgs.map((x: any) => getGrade(x.id, st.id)).filter((g: any): g is number => g !== null)
                            return sc.length > 0 ? [sc.reduce((a: number, b: number) => a + b, 0) / sc.length] : []
                          })
                          const classAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null
                          cells.push(
                            <td key="sub-class-last" className="px-2 py-2 text-center border-l-2 border-r-2"
                              style={{ borderColor: getCatColor(lastCatId), backgroundColor: `${getCatColor(lastCatId)}08` }}>
                              <span className={`text-sm font-bold ${classAvg !== null ? gradeColor(classAvg) : 'text-ink4'}`}>
                                {classAvg !== null ? classAvg.toFixed(1) : '—'}
                              </span>
                            </td>
                          )
                        }
                        return cells
                      })()}
                      <td className="px-3 py-2 border-l-2 border-surface2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            </>)}
          </div>
        )
      })()}

      {/* ── MODAL: CATEGORÍAS DE ACTIVIDADES ─────────────────────────────── */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCatModal(false)}>
          <div className="bg-surface rounded-2xl border border-surface2 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-surface2">
              <div>
                <h2 className="font-bold text-lg text-ink">Categorías de Actividades</h2>
                <p className="text-xs text-ink3 mt-0.5">Configuración de porcentajes</p>
              </div>
              <button onClick={() => setShowCatModal(false)} className="text-ink4 hover:text-ink transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Lista de categorías existentes */}
            <div className="p-5 space-y-2 max-h-[300px] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-ink4 text-center py-4">No hay categorías. Crea la primera abajo.</p>
              ) : categories.map((c: any, i: number) => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-surface2">
                  <span className="text-xs text-ink4 w-5 text-right">{i + 1}.</span>
                  <span className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-sm font-medium text-ink truncate">{c.name}</span>
                  <span className="text-sm font-semibold text-ink3">{Number(c.weight_percent).toFixed(0)}%</span>
                  <button onClick={() => openEditCat(c)} className="text-ink4 hover:text-violet transition-colors">
                    <Settings size={13} />
                  </button>
                  <button onClick={() => deleteCat(c.id)} className="text-ink4 hover:text-rose-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {categories.length > 0 && (
                <div className={`text-xs font-semibold text-right pr-2 ${Math.abs(categories.reduce((s: number, c: any) => s + Number(c.weight_percent), 0) - 100) < 0.01 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  Total: {categories.reduce((s: number, c: any) => s + Number(c.weight_percent), 0).toFixed(0)}%
                </div>
              )}
            </div>

            {/* Formulario añadir/editar */}
            <div className="p-5 border-t border-surface2 space-y-3">
              <h3 className="text-sm font-bold text-ink">{editCat ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <div className="flex flex-wrap gap-3">
                <input value={catName} onChange={e => setCatName(e.target.value)}
                  placeholder="Ej: Formativa: Tarea"
                  className="flex-1 min-w-[180px] bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="1" value={catWeight}
                    onChange={e => setCatWeight(e.target.value)}
                    className="w-20 bg-bg border border-surface2 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-violet text-center" />
                  <span className="text-sm text-ink3">%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink3">Color:</span>
                {CAT_COLORS.map(c => (
                  <button key={c} onClick={() => setCatColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${catColor === c ? 'ring-2 ring-offset-2 ring-violet scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={saveCat}
                  className="bg-violet hover:bg-violet2 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2">
                  <Plus size={14} /> {editCat ? 'Guardar' : 'Añadir'}
                </button>
                {editCat && (
                  <button onClick={openNewCat}
                    className="text-sm text-ink3 hover:text-ink transition-colors">
                    Cancelar edición
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: DETALLE / EDITAR ACTIVIDAD ────────────────────────── */}
      {editActivity && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditActivity(null)}>
          <div className="bg-surface rounded-2xl border border-surface2 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-surface2 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: getCatColor(actCatId) }} />
                  <h2 className="font-bold text-lg text-ink truncate">{getCatName(actCatId)}</h2>
                </div>
                <p className="text-xs text-ink3 mt-0.5">
                  Creada el {new Date(editActivity.created_at).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}T{editActivity.trimestre} P{editActivity.parcial}
                </p>
              </div>
              <button onClick={() => setEditActivity(null)} className="text-ink4 hover:text-ink transition-colors flex-shrink-0 ml-3">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-surface2 px-5 flex-shrink-0">
              {(['general', 'descripcion', 'adjuntos', 'estudiantes'] as const).map(tab => (
                <button key={tab} onClick={async () => {
                  setActTab(tab)
                  if (tab === 'estudiantes' && editActivity?.id) {
                    setLoadingActSubs(true)
                    try {
                      const res = await fetch(`/api/alumno/submissions?assignment_id=${editActivity.id}`)
                      const data = await res.json()
                      setActSubmissions(data.submissions || [])
                    } catch { setActSubmissions([]) }
                    finally { setLoadingActSubs(false) }
                  }
                }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-all capitalize
                    ${actTab === tab ? 'border-violet text-violet' : 'border-transparent text-ink3 hover:text-ink'}`}>
                  {tab === 'descripcion' ? 'Descripción' : tab === 'estudiantes' ? 'Entregas' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-5 overflow-y-auto flex-1">
              {/* ── Tab General ── */}
              {actTab === 'general' && (
                <div className="space-y-4">
                  <div className="flex gap-5">
                    {/* Left - form fields */}
                    <div className="flex-1 space-y-3">
                      {categories.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-ink3 w-32 text-right flex-shrink-0">Tipo de actividad</label>
                          <select value={actCatId} onChange={e => setActCatId(e.target.value)}
                            className="flex-1 bg-bg border border-surface2 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-violet"
                            style={actCatId ? { borderLeftColor: getCatColor(actCatId), borderLeftWidth: 3 } : {}}>
                            <option value="">Sin categoría</option>
                            {categories.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-ink3 w-32 text-right flex-shrink-0">Nombre</label>
                        <input value={actTitle} onChange={e => setActTitle(e.target.value)}
                          className="flex-1 bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-ink3 w-32 text-right flex-shrink-0">Fecha Inicio</label>
                        <input type="date" value={actStartDate} onChange={e => setActStartDate(e.target.value)}
                          className="flex-1 bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-ink3 w-32 text-right flex-shrink-0">Fecha Entrega</label>
                        <input type="date" value={actDueDate} onChange={e => setActDueDate(e.target.value)}
                          className="flex-1 bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-ink3 w-32 text-right flex-shrink-0">Hora Entrega</label>
                        <input type="time" value={actDueTime} onChange={e => setActDueTime(e.target.value)}
                          className="w-32 bg-bg border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet" />
                      </div>
                    </div>
                    {/* Right - days remaining badge */}
                    {actDueDate && (
                      <div className="flex flex-col items-center justify-start pt-6 flex-shrink-0">
                        {(() => {
                          const days = getDaysRemaining(actDueDate)
                          if (days === null) return null
                          return (
                            <div className={`flex flex-col items-center p-4 rounded-2xl border-2 ${days > 0 ? 'border-teal/30 bg-teal/5' : days === 0 ? 'border-amber-400/30 bg-amber-50' : 'border-rose-400/30 bg-rose-50'}`}>
                              <span className={`text-3xl font-black ${days > 0 ? 'text-teal' : days === 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                                {Math.abs(days)}
                              </span>
                              <span className="text-[10px] text-ink3 mt-1 font-medium">
                                {days > 0 ? 'Días disponibles' : days === 0 ? 'Vence hoy' : 'Días vencido'}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab Descripción ── */}
              {actTab === 'descripcion' && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-ink">Descripción de la actividad</label>
                  <textarea value={actDesc} onChange={e => setActDesc(e.target.value)}
                    rows={8}
                    placeholder="Escribe las instrucciones, objetivos y detalles de la actividad..."
                    className="w-full bg-bg border border-surface2 rounded-xl px-4 py-3 text-sm text-ink outline-none focus:border-violet resize-none leading-relaxed" />
                </div>
              )}

              {/* ── Tab Adjuntos ── */}
              {actTab === 'adjuntos' && (() => {

                async function handleUploadFiles() {
                  if (!actNewFiles.length) return
                  setUploadingAtt(true)
                  const uploaded: string[] = []
                  try {
                    for (const file of actNewFiles) {
                      const ext = file.name.split('.').pop()
                      const fileName = `assignment-${editActivity.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                      const { error } = await supabase.storage.from('submissions').upload(fileName, file)
                      if (error) throw new Error(error.message)
                      const { data: { publicUrl } } = supabase.storage.from('submissions').getPublicUrl(fileName)
                      uploaded.push(publicUrl)
                    }
                    const merged = [...actAttachments, ...uploaded]
                    // Save to the assignment via API (store in description metadata or dedicated field)
                    await fetch('/api/docente/assignment-attachments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ assignment_id: editActivity.id, file_urls: merged })
                    })
                    setActAttachments(merged)
                    setActNewFiles([])
                    
                    // Update the parent assignments state so it persists when reopening the modal
                    setAssignments(prev => prev.map(a => 
                      a.id === editActivity.id ? { ...a, attachment_urls: merged } : a
                    ))

                    toast.success(`${uploaded.length} archivo(s) subido(s) correctamente`)
                  } catch (err: any) {
                    toast.error(err.message)
                  } finally {
                    setUploadingAtt(false)
                  }
                }

                async function handleDeleteAttachment(url: string) {
                  const merged = actAttachments.filter(u => u !== url)
                  try {
                    await fetch('/api/docente/assignment-attachments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ assignment_id: editActivity.id, file_urls: merged })
                    })
                    setActAttachments(merged)
                    // Update parent state
                    setAssignments(prev => prev.map(a => 
                      a.id === editActivity.id ? { ...a, attachment_urls: merged } : a
                    ))
                    toast.success('Archivo eliminado')
                  } catch (err: any) {
                    toast.error('Error al eliminar archivo')
                  }
                }

                return (
                  <div className="space-y-4">
                    {/* Dropzone */}
                    <label className="border-2 border-dashed border-surface2 hover:border-violet/50 transition-colors rounded-2xl p-8 text-center cursor-pointer block group">
                      <div className="text-ink4 mb-3 group-hover:text-violet transition-colors">
                        <Upload size={32} className="mx-auto" />
                      </div>
                      <p className="text-sm text-ink3 mb-1">Arrastra archivos aquí o haz clic para seleccionar</p>
                      <p className="text-xs text-ink4">PDF, imágenes, documentos — máx 10 MB por archivo</p>
                      <input type="file" multiple className="hidden"
                        accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.zip"
                        onChange={e => {
                          const files = Array.from(e.target.files || [])
                          setActNewFiles(prev => [...prev, ...files])
                          e.target.value = ''
                        }}
                      />
                    </label>

                    {/* Pending uploads (not yet saved) */}
                    {actNewFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-ink4 uppercase tracking-wider">Pendientes de subir ({actNewFiles.length})</p>
                        {actNewFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl">
                            <span className="text-sm flex-1 truncate text-ink">{f.name}</span>
                            <span className="text-xs text-ink4">{(f.size / 1024).toFixed(0)} KB</span>
                            <button type="button" onClick={() => setActNewFiles(prev => prev.filter((_, j) => j !== i))}
                              className="text-ink4 hover:text-rose-500 transition-colors">
                              <X size={14}/>
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={handleUploadFiles} disabled={uploadingAtt}
                          className="w-full py-2.5 bg-violet text-white rounded-xl font-bold text-sm hover:bg-violet2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                          {uploadingAtt ? 'Subiendo...' : <><Upload size={16}/> Subir {actNewFiles.length} archivo(s)</>}
                        </button>
                      </div>
                    )}

                    {/* Already uploaded files */}
                    {actAttachments.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-ink4 uppercase tracking-wider">Archivos adjuntos ({actAttachments.length})</p>
                        {actAttachments.map((url, i) => {
                          const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `Archivo ${i+1}`)
                          return (
                            <div key={i} className="bg-bg border border-surface2 rounded-2xl p-4 space-y-3 shadow-sm">
                              <div className="flex items-center gap-3">
                                <Paperclip size={14} className="text-violet flex-shrink-0"/>
                                <span className="text-sm flex-1 truncate font-medium text-ink">{name}</span>
                                <button type="button"
                                  onClick={() => handleDeleteAttachment(url)}
                                  className="text-ink4 hover:text-rose-500 transition-colors p-1"
                                  title="Eliminar archivo">
                                  <X size={16}/>
                                </button>
                              </div>
                              <FilePreview url={url} name={name} />
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {actAttachments.length === 0 && actNewFiles.length === 0 && (
                      <p className="text-xs text-ink4 text-center pt-2">Aún no hay archivos adjuntos en esta tarea.</p>
                    )}
                  </div>
                )
              })()}

              {/* ── Tab Estudiantes ── */}
              {actTab === 'estudiantes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink">Entregas de estudiantes</h3>
                    <span className="text-xs text-ink3">
                      {actSubmissions.length}/{students.length} entregaron
                    </span>
                  </div>

                  {loadingActSubs ? (
                    <p className="text-sm text-ink4 text-center py-6 animate-pulse">Cargando entregas...</p>
                  ) : (
                    <div className="border border-surface2 rounded-xl divide-y divide-surface overflow-hidden">
                      {students.length === 0 ? (
                        <p className="text-sm text-ink4 text-center py-6">No hay alumnos matriculados.</p>
                      ) : students.map((st: any) => {
                        const grade = getGrade(editActivity.id, st.id)
                        const submission = actSubmissions.find((s: any) => s.student_id === st.id)
                        return (
                          <div key={st.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-bg/40 transition-colors">
                            <div className="flex items-center gap-3">
                              {/* Status icon */}
                              {grade !== null ? (
                                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                  <CheckCircle2 size={12} className="text-white"/>
                                </span>
                              ) : submission ? (
                                <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                  <CheckCircle2 size={12} className="text-white"/>
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-surface2 flex-shrink-0"/>
                              )}

                              <span className="flex-1 text-sm text-ink font-medium truncate">{st.full_name}</span>

                              {/* Badge */}
                              {grade !== null ? (
                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg">{grade.toFixed(1)}</span>
                              ) : submission ? (
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg uppercase tracking-widest">Entregó</span>
                              ) : (
                                <span className="text-[10px] font-black text-ink4 bg-surface2 px-2 py-0.5 rounded-lg uppercase tracking-widest">Pendiente</span>
                              )}
                            </div>

                            {/* Submission details */}
                            {submission && (
                              <div className="ml-8 space-y-1">
                                <p className="text-[10px] text-ink4">
                                  {new Date(submission.submitted_at).toLocaleString('es-ES')}
                                </p>
                                {submission.comment && (
                                  <p className="text-xs text-ink3 italic line-clamp-2 bg-surface px-2 py-1.5 rounded-lg border border-surface2">
                                    "{submission.comment}"
                                  </p>
                                )}
                                {submission.file_url && (
                                  <div className="pt-2">
                                    <FilePreview url={submission.file_url} compact />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-surface2 flex-shrink-0">
              <button onClick={deleteActivity}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors">
                <Trash2 size={14} /> Eliminar
              </button>
              <div className="flex gap-3">
                <button onClick={() => setEditActivity(null)}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-ink3 border border-surface2 hover:bg-surface2 transition-colors">
                  Descartar
                </button>
                <button onClick={saveActivity} disabled={savingAct}
                  className="bg-violet hover:bg-violet2 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-glow disabled:opacity-60">
                  {savingAct ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: COMPORTAMIENTO ──────────────────────────────────────────── */}
      {activeTab === 'comportamiento' && (() => {
        if (loadingBeh) return (
          <div className="p-10 text-center text-ink4">Cargando registros...</div>
        )

        return (
          <div className="space-y-3">
            {students.length === 0 ? (
              <div className="p-10 text-center text-ink4 border border-dashed border-surface2 rounded-2xl">
                No hay alumnos en este curso.
              </div>
            ) : students.map((st: any, idx: number) => {
              const stuBeh   = behaviors.filter((b: any) => b.student_id === st.id)
              const pos      = stuBeh.filter((b: any) => b.type === 'positive').length
              const neg      = stuBeh.filter((b: any) => b.type === 'negative').length
              const rec      = stuBeh.filter((b: any) => b.type === 'recommendation').length
              const isExpand = expandedStudent === st.id

              return (
                <div key={st.id} className="bg-surface rounded-2xl border border-surface2 overflow-hidden transition-all">
                  {/* Fila del alumno */}
                  <button
                    onClick={() => {
                      setExpandedStudent(isExpand ? null : st.id)
                      if (!isExpand) { setNewBehDesc(''); setNewBehType('positive') }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg/40 transition-colors text-left"
                  >
                    <span className="text-xs text-ink4 w-6 text-right flex-shrink-0">{idx + 1}.</span>
                    <span className="flex-1 font-medium text-sm text-ink truncate">{st.full_name}</span>
                    {/* Badges */}
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${pos > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-bg text-ink4'}`}>
                      <ThumbsUp size={11} /> {pos}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${neg > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-bg text-ink4'}`}>
                      <ThumbsDown size={11} /> {neg}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${rec > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-bg text-ink4'}`}>
                      <Star size={11} /> {rec}
                    </span>
                    <ChevronRight size={14} className={`text-ink4 transition-transform flex-shrink-0 ${isExpand ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Panel expandido */}
                  {isExpand && (
                    <div className="border-t border-surface2 p-4 space-y-4 bg-bg/30">
                      {/* Formulario añadir */}
                      <div className="flex items-start gap-3 flex-wrap">
                        <select
                          value={newBehType}
                          onChange={e => setNewBehType(e.target.value as BehaviorType)}
                          className="bg-surface border border-surface2 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-violet flex-shrink-0"
                        >
                          <option value="positive">👍 Positivo</option>
                          <option value="negative">👎 Negativo</option>
                          <option value="recommendation">⭐ Recomendación</option>
                        </select>
                        <input
                          value={newBehDesc}
                          onChange={e => setNewBehDesc(e.target.value)}
                          placeholder="Describe la observación..."
                          className="flex-1 min-w-[200px] bg-surface border border-surface2 rounded-xl px-4 py-2 text-sm text-ink outline-none focus:border-violet"
                        />
                        <button
                          onClick={() => addBehavior(st.id)}
                          disabled={savingBeh}
                          className="bg-violet hover:bg-violet2 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0"
                        >
                          <Plus size={14} /> Añadir
                        </button>
                      </div>

                      {/* Lista de registros */}
                      {stuBeh.length === 0 ? (
                        <p className="text-xs text-ink4 text-center py-2">Sin observaciones registradas.</p>
                      ) : (
                        <div className="space-y-2">
                          {stuBeh.map((b: any) => (
                            <div key={b.id} className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-surface2">
                              <span className="text-base flex-shrink-0">
                                {b.type === 'positive' ? '👍' : b.type === 'negative' ? '👎' : '⭐'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-ink">{b.description || '—'}</p>
                                <p className="text-xs text-ink4 mt-0.5">
                                  {new Date(b.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteBehavior(b.id)}
                                className="text-ink4 hover:text-rose-500 transition-colors flex-shrink-0 mt-0.5"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
