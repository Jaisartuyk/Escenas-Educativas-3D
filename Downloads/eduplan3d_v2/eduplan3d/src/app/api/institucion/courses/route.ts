// src/app/api/institucion/courses/route.ts
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

/** Verifica que el usuario sea admin/assistant de la institución */
async function isAdminOrAssistant(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles' as any)
    .select('role')
    .eq('id', userId)
    .single()
  const role = (data as any)?.role
  return role === 'admin' || role === 'assistant'
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, parallel, level, shift } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Falta el nombre del curso' }, { status: 400 })

  // institution_id proviene de la BD, no del cliente
  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  if (!(await isAdminOrAssistant(user.id))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('courses' as any)
    .insert({ institution_id, name, parallel, level, shift })
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
  const { id, name, parallel, level, shift } = body
  if (!id) return NextResponse.json({ error: 'Falta el id del curso' }, { status: 400 })

  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  if (!(await isAdminOrAssistant(user.id))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Verificar que el curso pertenece a la institución del usuario
  const { data: course } = await admin
    .from('courses' as any)
    .select('institution_id')
    .eq('id', id)
    .single()

  if ((course as any)?.institution_id !== institution_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (parallel !== undefined) updates.parallel = parallel
  if (level !== undefined) updates.level = level
  if (shift !== undefined) updates.shift = shift

  const { data, error } = await admin
    .from('courses' as any)
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
  const courseId = searchParams.get('id')
  if (!courseId) return NextResponse.json({ error: 'Falta el id del curso' }, { status: 400 })

  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  if (!(await isAdminOrAssistant(user.id))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Verificar que el curso pertenece a la institución del usuario
  const { data: course } = await admin
    .from('courses' as any)
    .select('institution_id')
    .eq('id', courseId)
    .single()

  if ((course as any)?.institution_id !== institution_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error } = await admin
    .from('courses' as any)
    .delete()
    .eq('id', courseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
