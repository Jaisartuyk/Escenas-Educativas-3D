import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  // Verificar que sea estudiante
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'student') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { attendance_id, text, file_url } = await req.json()
  
  if (!attendance_id || !text) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verificar que la asistencia pertenezca al usuario local
  const { data: att } = await admin.from('attendance' as any).select('student_id').eq('id', attendance_id).single()
  if (!att || att.student_id !== user.id) {
    return NextResponse.json({ error: 'Asistencia no encontrada o no pertenece al usualio' }, { status: 404 })
  }

  const updates: any = {
    justification_text: text,
    justification_status: 'pending' // Siempre arranca pendiente para revisión
  }
  
  if (file_url) {
    updates.justification_file_url = file_url
  }

  const { data, error } = await admin
    .from('attendance' as any)
    .update(updates)
    .eq('id', attendance_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
