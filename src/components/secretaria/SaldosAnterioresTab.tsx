'use client'

import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, X, Search, AlertTriangle, CheckCircle2, HandCoins,
  Trash2, ChevronDown, Clock, DollarSign, Users, TrendingDown, Download,
} from 'lucide-react'

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n)
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendiente: { label: 'PENDIENTE', bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
  parcial:   { label: 'ABONADO',   bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'   },
  pagado:    { label: 'PAGADO',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
}

const PERIODS = ['2024-2025', '2023-2024', '2022-2023', '2021-2022']

interface HistoricalDebt {
  id: string
  student_id: string
  period: string
  description: string
  type: string
  amount: number
  paid_amount: number
  status: string
  notes?: string
}

interface Props {
  students: { id: string; full_name: string }[]
  institutionId: string
  userRole?: string
}

export function SaldosAnterioresTab({ students, institutionId, userRole }: Props) {
  const canManage = !userRole || ['admin', 'assistant', 'secretary', 'rector'].includes(userRole)
  const [debts, setDebts] = useState<HistoricalDebt[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [abonoDebt, setAbonoDebt] = useState<HistoricalDebt | null>(null)
  const [abonoAmount, setAbonoAmount] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    student_id: '',
    period: '2024-2025',
    description: '',
    type: 'pension',
    amount: '',
    notes: '',
  })

  // Cargar al hacer clic en la pestaña
  const load = async () => {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch('/api/secretaria/historical-debts', { cache: 'no-store' })
      const json = await res.json()
      setDebts(json.data || [])
      setLoaded(true)
    } catch {
      toast.error('Error al cargar saldos anteriores')
    } finally {
      setLoading(false)
    }
  }

  // Mapa de estudiantes
  const studentsById = useMemo(() => {
    const map: Record<string, string> = {}
    students.forEach(s => { map[s.id] = s.full_name })
    return map
  }, [students])

  // Filtrar deudas
  const filtered = useMemo(() => {
    let list = debts
    if (filterPeriod !== 'todos') list = list.filter(d => d.period === filterPeriod)
    if (filterStatus !== 'todos') list = list.filter(d => d.status === filterStatus)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(d => (studentsById[d.student_id] || '').toLowerCase().includes(q) ||
                              d.description.toLowerCase().includes(q))
    }
    return list
  }, [debts, filterPeriod, filterStatus, searchTerm, studentsById])

  // Estadísticas
  const stats = useMemo(() => {
    const totalDeuda = debts.reduce((s, d) => s + (d.amount - d.paid_amount), 0)
    const totalCobrado = debts.reduce((s, d) => s + d.paid_amount, 0)
    const pendientes = debts.filter(d => d.status !== 'pagado').length
    const alumnos = new Set(debts.filter(d => d.status !== 'pagado').map(d => d.student_id)).size
    return { totalDeuda, totalCobrado, pendientes, alumnos }
  }, [debts])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.student_id) return toast.error('Selecciona un alumno')
    if (!form.description.trim()) return toast.error('Escribe una descripción')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Monto inválido')

    setSaving(true)
    try {
      const res = await fetch('/api/secretaria/historical-debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDebts(prev => [json.data, ...prev])
      setForm({ student_id: '', period: '2024-2025', description: '', type: 'pension', amount: '', notes: '' })
      setShowForm(false)
      toast.success('Deuda registrada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAbono = async () => {
    if (!abonoDebt) return
    const amount = Number(abonoAmount)
    const remaining = abonoDebt.amount - abonoDebt.paid_amount
    if (!amount || amount <= 0 || amount > remaining) {
      return toast.error(`Monto inválido. Máximo: ${formatMoney(remaining)}`)
    }
    const t = toast.loading('Registrando abono...')
    try {
      const res = await fetch(`/api/secretaria/historical-debts/${abonoDebt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abono_amount: amount }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDebts(prev => prev.map(d => d.id === abonoDebt.id ? json.data : d))
      toast.success('Abono registrado', { id: t })
      setAbonoDebt(null)
      setAbonoAmount('')
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  const handleDelete = async (id: string) => {
    const t = toast.loading('Eliminando...')
    try {
      const res = await fetch(`/api/secretaria/historical-debts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setDebts(prev => prev.filter(d => d.id !== id))
      setConfirmDelete(null)
      toast.success('Deuda eliminada', { id: t })
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  const exportRows = useMemo(() => {
    return filtered
      .map((debt) => ({
        id: debt.id,
        studentName: studentsById[debt.student_id] || 'Alumno desconocido',
        period: debt.period,
        description: debt.description,
        type: debt.type,
        status: debt.status,
        amount: Number(debt.amount || 0),
        paidAmount: Number(debt.paid_amount || 0),
        remainingAmount: Number(debt.amount || 0) - Number(debt.paid_amount || 0),
        notes: debt.notes || '',
      }))
      .sort((a, b) => {
        const byStudent = a.studentName.localeCompare(b.studentName)
        if (byStudent !== 0) return byStudent
        const byPeriod = b.period.localeCompare(a.period)
        if (byPeriod !== 0) return byPeriod
        return a.description.localeCompare(b.description)
      })
  }, [filtered, studentsById])

  const exportHistoricalExcel = async () => {
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
        { header: 'Indicador', key: 'label', width: 34 },
        { header: 'Valor', key: 'value', width: 24 },
      ]
      summarySheet.addRows([
        { label: 'Fecha de exportación', value: safeDate },
        { label: 'Vista', value: 'Saldos Anteriores' },
        { label: 'Registros exportados', value: exportRows.length },
        { label: 'Período aplicado', value: filterPeriod },
        { label: 'Estado aplicado', value: filterStatus },
        { label: 'Búsqueda aplicada', value: searchTerm.trim() || '(sin filtro)' },
        { label: 'Saldo pendiente (filtrado)', value: exportRows.reduce((sum, row) => sum + row.remainingAmount, 0) },
        { label: 'Total cobrado (filtrado)', value: exportRows.reduce((sum, row) => sum + row.paidAmount, 0) },
      ])
      summarySheet.getRow(1).font = { bold: true }

      const debtsSheet = workbook.addWorksheet('Saldos')
      debtsSheet.columns = [
        { header: 'ID', key: 'id', width: 38 },
        { header: 'Estudiante', key: 'studentName', width: 34 },
        { header: 'Período', key: 'period', width: 16 },
        { header: 'Tipo', key: 'type', width: 14 },
        { header: 'Descripción', key: 'description', width: 42 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Monto', key: 'amount', width: 14 },
        { header: 'Abonado', key: 'paidAmount', width: 14 },
        { header: 'Saldo', key: 'remainingAmount', width: 14 },
        { header: 'Notas', key: 'notes', width: 34 },
      ]

      exportRows.forEach((row) => debtsSheet.addRow(row))
      debtsSheet.getRow(1).font = { bold: true }
      ;['G', 'H', 'I'].forEach((col) => {
        debtsSheet.getColumn(col).numFmt = '$#,##0.00'
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `secretaria_saldos_anteriores_${safeDate}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)

      toast.success('Excel exportado')
    } catch (error) {
      console.error('[secretaria/historical-export-excel]', error)
      toast.error('No se pudo exportar el Excel')
    } finally {
      setExporting(false)
    }
  }

  // Render
  return (
    <div className="space-y-4" ref={el => { if (el && !loaded) load() }}>

      {/* Stats */}
      {loaded && debts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: TrendingDown, label: 'Saldo Pendiente', value: formatMoney(stats.totalDeuda), color: 'text-rose-600', bg: 'bg-rose-50' },
            { icon: DollarSign,   label: 'Total Cobrado',   value: formatMoney(stats.totalCobrado), color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: AlertTriangle,label: 'Deudas activas',  value: String(stats.pendientes), color: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: Users,        label: 'Alumnos con deuda', value: String(stats.alumnos), color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl p-4 border border-surface2 ${bg}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${color} mb-1`}>
                <Icon size={11} /> {label}
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink4" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar alumno o concepto..."
              className="pl-8 pr-3 py-2 text-sm border border-surface2 rounded-xl bg-bg focus:outline-none focus:border-violet-400 w-56"
            />
          </div>
          <div className="relative">
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
              className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-2 text-xs font-medium focus:outline-none cursor-pointer">
              <option value="todos">Todos los períodos</option>
              {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none bg-bg border border-surface2 rounded-lg pl-3 pr-7 py-2 text-xs font-medium focus:outline-none cursor-pointer">
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="parcial">Abonados</option>
              <option value="pagado">Pagados</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink4 pointer-events-none" />
          </div>
          <button
            onClick={exportHistoricalExcel}
            disabled={exporting || !loaded}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-surface2 text-ink3 hover:bg-surface2 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{ backgroundColor: '#7C6DFA' }}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancelar' : 'Registrar Deuda'}
          </button>
        )}
      </div>

      {/* Formulario de nueva deuda */}
      {showForm && (
        <form onSubmit={handleCreate} className="p-5 rounded-2xl border border-violet-200 bg-violet-50/30 space-y-4">
          <h3 className="text-sm font-bold text-violet-700 uppercase tracking-wider">📋 Nueva Deuda Histórica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Alumno *</label>
              <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                className="input-base w-full" required>
                <option value="">Seleccionar alumno...</option>
                {students.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Período Lectivo *</label>
              <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="input-base w-full">
                {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Tipo *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input-base w-full">
                <option value="matricula">Matrícula</option>
                <option value="pension">Pensión</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Descripción *</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ej. Pensión Octubre 2024 - 3RO BÁSICA" className="input-base w-full" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Monto adeudado ($) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" className="input-base w-full" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Notas (opcional)</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones adicionales" className="input-base w-full" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: '#7C6DFA' }}>
              {saving ? 'Guardando...' : <><Plus size={16} /> Registrar Deuda</>}
            </button>
          </div>
        </form>
      )}

      {/* Modal de abono */}
      {abonoDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAbonoDebt(null)}>
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Registrar Abono</h3>
              <button onClick={() => setAbonoDebt(null)}><X size={18} /></button>
            </div>
            <p className="text-sm text-ink3 mb-1">{studentsById[abonoDebt.student_id]}</p>
            <p className="text-xs text-ink4 mb-4">{abonoDebt.description} · {abonoDebt.period}</p>
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-xl bg-surface2/50">
              <div>
                <p className="text-[10px] text-ink4 uppercase font-bold">Deuda total</p>
                <p className="font-bold text-ink">{formatMoney(abonoDebt.amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink4 uppercase font-bold">Saldo pendiente</p>
                <p className="font-bold text-rose-600">{formatMoney(abonoDebt.amount - abonoDebt.paid_amount)}</p>
              </div>
            </div>
            <label className="block text-xs font-semibold text-ink3 uppercase mb-1.5">Monto a abonar ($)</label>
            <input
              type="number" min="0.01" step="0.01"
              max={abonoDebt.amount - abonoDebt.paid_amount}
              value={abonoAmount}
              onChange={e => setAbonoAmount(e.target.value)}
              placeholder={`Máx. ${formatMoney(abonoDebt.amount - abonoDebt.paid_amount)}`}
              className="input-base w-full mb-4"
              autoFocus
            />
            <button onClick={handleAbono}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: '#7C6DFA' }}>
              <HandCoins size={16} /> Aplicar Abono
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-ink4 text-sm">Cargando saldos anteriores...</div>
      )}

      {/* Lista de deudas */}
      {loaded && !loading && (
        filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-violet-50">
              <CheckCircle2 size={28} className="text-violet-400" />
            </div>
            <p className="text-ink3 font-medium">
              {debts.length === 0 ? 'No hay deudas históricas registradas' : 'No hay resultados para este filtro'}
            </p>
            <p className="text-ink4 text-sm mt-1">
              {debts.length === 0 ? 'Usa el botón "Registrar Deuda" para añadir saldos anteriores.' : 'Prueba con otro período o estado.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(debt => {
              const remaining = debt.amount - debt.paid_amount
              const cfg = STATUS_CFG[debt.status] || STATUS_CFG.pendiente
              const progressPct = debt.amount > 0 ? (debt.paid_amount / debt.amount) * 100 : 0
              return (
                <div key={debt.id} className="rounded-2xl border border-surface2 bg-surface p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-ink truncate">
                          {studentsById[debt.student_id] || 'Alumno desconocido'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {debt.status === 'pagado' ? <CheckCircle2 size={10} /> : debt.status === 'parcial' ? <HandCoins size={10} /> : <Clock size={10} />}
                          {cfg.label}
                        </span>
                        <span className="text-[10px] font-semibold text-ink4 bg-surface2 px-2 py-0.5 rounded-full">
                          {debt.period}
                        </span>
                        <span className="text-[10px] text-ink4 capitalize">{debt.type}</span>
                      </div>
                      <p className="text-xs text-ink3 mb-2">{debt.description}</p>
                      {debt.notes && <p className="text-xs text-ink4 italic mb-2">{debt.notes}</p>}

                      {/* Barra de progreso */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${debt.status === 'pagado' ? 'bg-emerald-400' : 'bg-sky-400'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-ink4 whitespace-nowrap">
                          {formatMoney(debt.paid_amount)} / {formatMoney(debt.amount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className={`text-lg font-bold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {remaining > 0 ? `-${formatMoney(remaining)}` : '✓ Pagado'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {canManage && debt.status !== 'pagado' && (
                          <button
                            onClick={() => { setAbonoDebt(debt); setAbonoAmount('') }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                          >
                            <HandCoins size={12} /> Abonar
                          </button>
                        )}
                        {canManage && (
                          confirmDelete === debt.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(debt.id)}
                                className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors">
                                Confirmar
                              </button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-surface2 text-ink3 hover:bg-surface3 transition-colors">
                                No
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(debt.id)}
                              className="p-1.5 rounded-lg text-ink4 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
