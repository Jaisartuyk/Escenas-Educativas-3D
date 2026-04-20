import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { teacherOwnsSubject } from '@/lib/auth/ownership'

// GET /api/docente/behavior?subjectId=X
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('subjectId')
  if (!subjectId) return NextResponse.json({ error: 'Missing subjectId' }, { status: 400 })

  const owns = await teacherOwnsSubject(user.id, subjectId)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta materia' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('behavior_records' as any)
    .select('id, student_id, type, description, date')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/docente/behavior  → insertar registro
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { subject_id, student_id, type, description, date } = body

  if (!subject_id) return NextResponse.json({ error: 'Missing subject_id' }, { status: 400 })

  const owns = await teacherOwnsSubject(user.id, subject_id)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre esta materia' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('behavior_records' as any)
    .insert({ subject_id, student_id, type, description, date })
    .select('id, student_id, type, description, date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/docente/behavior?id=X
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Cargar el registro para verificar ownership vía subject
  const admin = createAdminClient()
  const { data: rec } = await admin
    .from('behavior_records' as any)
    .select('subject_id')
    .eq('id', id)
    .single()
  const subjectId = (rec as any)?.subject_id
  if (!subjectId) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

  const owns = await teacherOwnsSubject(user.id, subjectId)
  if (!owns) return NextResponse.json({ error: 'No tienes permiso sobre este registro' }, { status: 403 })

  const { error } = await admin
    .from('behavior_records' as any)
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
