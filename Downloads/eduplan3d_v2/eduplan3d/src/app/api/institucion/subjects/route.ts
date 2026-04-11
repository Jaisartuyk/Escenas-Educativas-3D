// src/app/api/institucion/subjects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { course_id, institution_id, name, weekly_hours, teacher_id } = body

  if (!course_id || !institution_id || !name?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('subjects' as any)
    .insert({
      course_id,
      institution_id,
      name: name.trim().toUpperCase(),
      weekly_hours: weekly_hours || 1,
      teacher_id: teacher_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, name, weekly_hours, teacher_id } = body

  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const admin = createAdminClient()
  const updates: any = {}
  if (name !== undefined) updates.name = name.trim().toUpperCase()
  if (weekly_hours !== undefined) updates.weekly_hours = weekly_hours
  if (teacher_id !== undefined) updates.teacher_id = teacher_id || null

  const { data, error } = await admin
    .from('subjects' as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('id')
  if (!subjectId) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('subjects' as any)
    .delete()
    .eq('id', subjectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
