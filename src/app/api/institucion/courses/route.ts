// src/app/api/institucion/courses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CourseRow = {
  id: string
  institution_id: string
  name: string
  parallel: string | null
  level: string | null
  shift: string | null
}

function normalizeCourseToken(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanCourseName(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function cleanParallel(value: string | null | undefined): string | null {
  const cleaned = cleanCourseName(value)
  return cleaned ? cleaned.toUpperCase() : null
}

function removeParallelSuffix(name: string, parallel: string | null): string {
  if (!parallel) return name
  const normalizedParallel = normalizeCourseToken(parallel)
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name.trim()
  const lastPart = normalizeCourseToken(parts[parts.length - 1])
  if (lastPart !== normalizedParallel) return name.trim()
  return parts.slice(0, -1).join(' ').trim()
}

function canonicalizeCourseInput(name: string, parallel: string | null) {
  const cleanedParallel = cleanParallel(parallel)
  const strippedName = removeParallelSuffix(cleanCourseName(name), cleanedParallel)
  const cleanedName = cleanCourseName(strippedName || name)
  return {
    name: cleanedName,
    parallel: cleanedParallel,
    normalizedName: normalizeCourseToken(cleanedName),
    normalizedParallel: normalizeCourseToken(cleanedParallel),
  }
}

function buildCourseDisplayName(name: string, parallel: string | null | undefined): string {
  return parallel ? `${name} ${parallel}`.trim() : name
}

function removeCourseReferencesFromScheduleSlot(slotValue: any, displayName: string) {
  if (!slotValue || typeof slotValue !== 'object' || Array.isArray(slotValue)) return slotValue

  const next = { ...slotValue }

  if (next.config && Array.isArray(next.config.cursos)) {
    next.config = {
      ...next.config,
      cursos: next.config.cursos.filter((courseName: string) => courseName !== displayName),
    }
  }

  if (next.horasPorCurso && typeof next.horasPorCurso === 'object') {
    next.horasPorCurso = { ...next.horasPorCurso }
    delete next.horasPorCurso[displayName]
  }

  if (next.docentePorCurso && typeof next.docentePorCurso === 'object') {
    next.docentePorCurso = { ...next.docentePorCurso }
    delete next.docentePorCurso[displayName]
  }

  if (next.horario && typeof next.horario === 'object') {
    next.horario = { ...next.horario }
    delete next.horario[displayName]
  }

  return next
}

function cleanupCourseReferencesFromSettings(settings: any, displayName: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings

  const nextSettings = { ...settings }
  for (const [key, value] of Object.entries(nextSettings)) {
    if (key === 'horarios' || key.startsWith('horarios_')) {
      nextSettings[key] = removeCourseReferencesFromScheduleSlot(value, displayName)
    }
  }

  return nextSettings
}

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

/** Verifica que el usuario tenga acceso administrativo a la institución */
async function hasInstitutionCourseAccess(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles' as any)
    .select('role')
    .eq('id', userId)
    .single()
  const role = (data as any)?.role
  return ['admin', 'assistant', 'secretary', 'rector'].includes(role)
}

async function findCourseConflict(
  institutionId: string,
  normalizedName: string,
  normalizedParallel: string,
  excludeId?: string,
): Promise<CourseRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('courses' as any)
    .select('id, institution_id, name, parallel, level, shift')
    .eq('institution_id', institutionId)

  const rows = ((data as any[]) || []) as CourseRow[]
  return rows.find((course) => {
    if (excludeId && course.id === excludeId) return false
    return (
      normalizeCourseToken(course.name) === normalizedName &&
      normalizeCourseToken(course.parallel) === normalizedParallel
    )
  }) || null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, parallel, level, shift } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Falta el nombre del curso' }, { status: 400 })

  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  if (!(await hasInstitutionCourseAccess(user.id))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const normalized = canonicalizeCourseInput(name, parallel)
  if (!normalized.name) {
    return NextResponse.json({ error: 'El nombre del curso es inválido' }, { status: 400 })
  }

  const conflict = await findCourseConflict(
    institution_id,
    normalized.normalizedName,
    normalized.normalizedParallel,
  )
  if (conflict) {
    return NextResponse.json(
      { error: `Ya existe el curso ${buildCourseDisplayName(conflict.name, conflict.parallel)}.` },
      { status: 409 },
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('courses' as any)
    .insert({
      institution_id,
      name: normalized.name,
      parallel: normalized.parallel,
      level: level ?? null,
      shift: shift ?? null,
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
  const { id, name, parallel, level, shift } = body
  if (!id) return NextResponse.json({ error: 'Falta el id del curso' }, { status: 400 })

  const institution_id = await getVerifiedInstitutionId(user.id)
  if (!institution_id) return NextResponse.json({ error: 'Sin institución asignada' }, { status: 403 })

  if (!(await hasInstitutionCourseAccess(user.id))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: course } = await admin
    .from('courses' as any)
    .select('id, institution_id, name, parallel, level, shift')
    .eq('id', id)
    .single()

  const existingCourse = course as any as CourseRow | null
  if (!existingCourse || existingCourse.institution_id !== institution_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const normalized = canonicalizeCourseInput(
    name !== undefined ? name : existingCourse.name,
    parallel !== undefined ? parallel : existingCourse.parallel,
  )
  if (!normalized.name) {
    return NextResponse.json({ error: 'El nombre del curso es inválido' }, { status: 400 })
  }

  const conflict = await findCourseConflict(
    institution_id,
    normalized.normalizedName,
    normalized.normalizedParallel,
    id,
  )
  if (conflict) {
    return NextResponse.json(
      { error: `Ya existe el curso ${buildCourseDisplayName(conflict.name, conflict.parallel)}.` },
      { status: 409 },
    )
  }

  const updates: any = {}
  if (name !== undefined || parallel !== undefined) {
    updates.name = normalized.name
    updates.parallel = normalized.parallel
  }
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

  if (!(await hasInstitutionCourseAccess(user.id))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: course } = await admin
    .from('courses' as any)
    .select('id, institution_id, name, parallel')
    .eq('id', courseId)
    .single()

  const existingCourse = course as any as Pick<CourseRow, 'id' | 'institution_id' | 'name' | 'parallel'> | null
  if (!existingCourse || existingCourse.institution_id !== institution_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const displayName = buildCourseDisplayName(existingCourse.name, existingCourse.parallel)

  const { data: institution } = await admin
    .from('institutions' as any)
    .select('settings')
    .eq('id', institution_id)
    .single()

  const currentSettings = (institution as any)?.settings || {}
  const cleanedSettings = cleanupCourseReferencesFromSettings(currentSettings, displayName)

  const { error: settingsError } = await admin
    .from('institutions' as any)
    .update({ settings: cleanedSettings })
    .eq('id', institution_id)

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const { error } = await admin
    .from('courses' as any)
    .delete()
    .eq('id', courseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
