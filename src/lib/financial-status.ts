import { SupabaseClient } from '@supabase/supabase-js'

export async function checkStudentDebt(admin: SupabaseClient | null, studentId: string): Promise<boolean> {
  if (!admin || !studentId) return false

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: payments } = await admin
    .from('payments')
    .select('id, type, status, due_date')
    .eq('student_id', studentId)
    .in('type', ['pension', 'matricula'])
    .neq('status', 'pagado')

  if (!payments || payments.length === 0) return false

  // Verificamos si algún pago pendiente o parcial ya está vencido
  for (const p of payments) {
    if (p.due_date && p.due_date < todayStr) {
      return true // Tiene deuda atrasada
    }
  }

  return false
}
