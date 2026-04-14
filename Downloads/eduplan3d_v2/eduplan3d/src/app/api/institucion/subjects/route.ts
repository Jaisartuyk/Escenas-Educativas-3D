// src/app/api/institucion/subjects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Devuelve el institution_id verificado del usuario autenticado */
async function getVerifiedInstitutionId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles' as any)
    .select('institution_id')
    .eq('id', userId)
    .single()
  return (data as any)?.institution_id ?? null
}

/** GET /api/institucion/subjects
 *  Catálogo global: nombres distintos de materias de toda la plataforma.
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('subjects' as any)
    .select('name')

  const names: string[] = Array.from(
    new Set((data || []).map((s: any) => s.name as string))
  ).sort()
  return NextResponse.json({ names })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { course_id, name, weekly_hours, teacher_id } = body

  if (!course_id || !name?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // institution_id proviene de la BD, no del cliente
  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  const admin = createAdminClient()

  // Verificar que el curso pertenece a la institución del usuario
  const { data: course } = await admin
    .from('courses' as any)
    .select('institution_id')
    .eq('id', course_id)
    .single()

  if ((course as any)?.institution_id !== institution_id) {
    return NextResponse.json({ error: 'El curso no pertenece a tu institución' }, { status: 403 })
  }

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

  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  const admin = createAdminClient()

  // Verificar que la materia pertenece a la institución del usuario
  const { data: subject } = await admin
    .from('subjects' as any)
    .select('institution_id')
    .eq('id', id)
    .single()

  if ((subject as any)?.institution_id !== institution_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const updates: any = {}
  if (name !== undefined) updates.name = name.trim().toUpperCase()
  if (weekly_hours !== undefined) updates.weekly_hours = weekly_hours
  if ('teacher_id' in body) updates.teacher_id = teacher_id || null

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

  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  const admin = createAdminClient()

  // Verificar que la materia pertenece a la institución del usuario
  const { data: subject } = await admin
    .from('subjects' as any)
    .select('institution_id')
    .eq('id', subjectId)
    .single()

  if ((subject as any)?.institution_id !== institution_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error } = await admin
    .from('subjects' as any)
    .delete()
    .eq('id', subjectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
