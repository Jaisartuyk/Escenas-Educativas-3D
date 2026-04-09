'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Check, Clock, AlertCircle } from 'lucide-react'

export function SecretariaClient({ institutionId, students, courses, enrollments, initialPayments }: any) {
  const supabase = createClient()
  const [payments, setPayments] = useState(initialPayments)
  
  // States para nuevo pago
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDueDate, setNewDueDate] = useState('')

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudent || !newAmount || !newDesc) return toast.error('Completa los campos obligatorios')

    const newPayment = {
      id: uuidv4(),
      institution_id: institutionId,
      student_id: selectedStudent,
      amount: parseFloat(newAmount),
      description: newDesc,
      status: 'pendiente',
      due_date: newDueDate || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setPayments([newPayment, ...payments])
    setIsAddingPayment(false)

    // @ts-ignore
    const { error } = await supabase.from('payments').insert(newPayment)
    if (error) {
      toast.error('Error al generar cobro')
      setPayments(payments)
    } else {
      toast.success('Cobro generado correctamente')
    }
  }

  const markAsPaid = async (paymentId: string) => {
    const today = new Date().toISOString().split('T')[0]
    setPayments(payments.map((p:any) => p.id === paymentId ? { ...p, status: 'pagado', paid_date: today } : p))
    
    // @ts-ignore
    await supabase.from('payments').update({ status: 'pagado', paid_date: today }).eq('id', paymentId)
    toast.success('Pago marcado como completado')
  }

  const deletePayment = async (paymentId: string) => {
    setPayments(payments.filter((p:any) => p.id !== paymentId))
    // @ts-ignore
    await supabase.from('payments').delete().eq('id', paymentId)
  }

  return (
    <div className="space-y-6">
      
      {/* Resumen Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-surface2/50 border border-white/5 rounded-2xl p-5">
            <p className="text-ink3 text-xs font-bold uppercase tracking-wider mb-2">Total Estudiantes</p>
            <p className="text-3xl font-display font-medium">{students.length}</p>
         </div>
         <div className="bg-[rgba(38,215,180,0.05)] border border-[rgba(38,215,180,0.2)] rounded-2xl p-5">
            <p className="text-teal text-xs font-bold uppercase tracking-wider mb-2">Cobros Pagados</p>
            <p className="text-3xl font-display font-medium text-white">{payments.filter((p:any) => p.status === 'pagado').length}</p>
         </div>
         <div className="bg-[rgba(255,100,100,0.05)] border border-[rgba(255,100,100,0.2)] rounded-2xl p-5">
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">Pagos Pendientes</p>
            <p className="text-3xl font-display font-medium text-white">{payments.filter((p:any) => p.status === 'pendiente' || p.status === 'atrasado').length}</p>
         </div>
      </div>

      <div className="bg-surface rounded-2xl border border-[rgba(255,255,255,0.05)] overflow-hidden">
        <div className="p-5 border-b border-[rgba(255,255,255,0.05)] flex justify-between items-center">
          <h2 className="font-display font-semibold text-lg">Historial de Cobros y Pensiones</h2>
          <button 
             onClick={() => setIsAddingPayment(!isAddingPayment)}
             className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors px-4 py-2 rounded-xl text-sm flex items-center gap-2"
          >
             <Plus size={16}/> Emitir Cobro
          </button>
        </div>

        {isAddingPayment && (
           <div className="p-5 bg-surface2/50 border-b border-[rgba(255,255,255,0.05)]">
             <form onSubmit={handleCreatePayment} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                   <label className="block text-xs font-medium text-ink4 mb-1">Estudiante</label>
                   <select required value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} className="w-full bg-bg border border-surface rounded-xl px-3 py-2 text-sm">
                      <option value="">Seleccione un alumno...</option>
                      {students.map((s:any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-medium text-ink4 mb-1">Rubro / Concepto</label>
                   <input required placeholder="Ej. Pensión Mayo" value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="w-full bg-bg border border-surface rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                   <label className="block text-xs font-medium text-ink4 mb-1">Monto ($)</label>
                   <input required type="number" step="0.01" min="0" placeholder="0.00" value={newAmount} onChange={e=>setNewAmount(e.target.value)} className="w-full bg-bg border border-surface rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                   <label className="block text-xs font-medium text-ink4 mb-1">Vencimiento</label>
                   <input type="date" value={newDueDate} onChange={e=>setNewDueDate(e.target.value)} className="w-full bg-bg border border-surface rounded-xl px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-5 flex justify-end">
                  <button type="submit" className="bg-violet hover:bg-violet2 transition-colors px-6 py-2 rounded-xl text-sm font-medium">Generar Cobro</button>
                </div>
             </form>
           </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[rgba(255,255,255,0.02)]">
                <th className="px-5 py-3 font-semibold text-ink4">Alumno</th>
                <th className="px-5 py-3 font-semibold text-ink4">Concepto</th>
                <th className="px-5 py-3 font-semibold text-ink4">Monto ($)</th>
                <th className="px-5 py-3 font-semibold text-ink4">Estado</th>
                <th className="px-5 py-3 font-semibold text-ink4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
               {payments.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-5 py-12 text-center text-ink4">No hay registros financieros.</td>
                 </tr>
               ) : payments.map((p:any) => {
                 const student = students.find((s:any) => s.id === p.student_id)
                 
                 let statusBadge = null
                 if (p.status === 'pagado') {
                   statusBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider bg-[rgba(38,215,180,0.1)] text-teal border border-[rgba(38,215,180,0.2)]"><Check size={12}/> PAGADO</span>
                 } else if (p.status === 'pendiente') {
                   statusBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider bg-[rgba(255,255,255,0.05)] text-ink2 border border-[rgba(255,255,255,0.1)]"><Clock size={12}/> PENDIENTE</span>
                 } else {
                   statusBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider bg-[rgba(255,100,100,0.1)] text-red-400 border border-[rgba(255,100,100,0.2)]"><AlertCircle size={12}/> ATRASADO</span>
                 }

                 return (
                   <tr key={p.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group">
                     <td className="px-5 py-4 font-medium">{student?.full_name || 'Desconocido'}</td>
                     <td className="px-5 py-4 text-ink2">{p.description} <br/><span className="text-[10px] text-ink4">Vence: {p.due_date || 'Sin fecha'}</span></td>
                     <td className="px-5 py-4 font-display font-semibold">${p.amount}</td>
                     <td className="px-5 py-4">{statusBadge}</td>
                     <td className="px-5 py-4">
                        {p.status !== 'pagado' && (
                           <button onClick={() => markAsPaid(p.id)} className="text-teal hover:text-white text-xs font-semibold mr-3 transition-colors">Cobrar</button>
                        )}
                        <button onClick={() => deletePayment(p.id)} className="text-ink4 hover:text-red-400 text-xs font-medium transition-colors">Eliminar</button>
                     </td>
                   </tr>
                 )
               })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
