// src/app/api/attendance/justifications/review/route.ts
// Aprobar o rechazar una justificación de falta/atraso.
// Autorizado para: admin/assistant de la institución O el TUTOR del curso del estudiante.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Action = 'approved' | 'rejected'

function norm(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Devuelve true si `userFullName` figura como tutor de alguno de los cursos
 * listados en `courseNames` dentro del JSONB `institutions.settings`.
 * Soporta el formato { horarios*: { config: { tutores: { "8vo A": "Prof. X" } } } }.
 */
function isTutorOfAnyCourse(
  settings: any,
  userFullName: string,
  courseNames: Array<{ name: string; parallel?: string | null }>
): boolean {
  const userN = norm(userFullName)
  if (!userN || !settings) return false
  const wantedN = new Set<string>()
  for (const c of courseNames) {
    wantedN.add(norm(c.name))
    if (c.parallel) wantedN.add(norm(`${c.name} ${c.parallel}`))
  }

  for (const key of Object.keys(settings)) {
    if (!key.startsWith('horarios')) continue
    const tutores = settings[key]?.config?.tutores
    if (!tutores || typeof tutores !== 'object') continue
    for (const [cursoName, tutorName] of Object.entries(tutores)) {
      if (typeof tutorName !== 'string') continue
      if (norm(tutorName) === userN && wantedN.has(norm(cursoName))) {
        return true
      }
    }
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const attendanceId: string = body?.attendanceId
    const action: Action = body?.action
    if (!attendanceId || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'attendanceId y action son requeridos' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, role, institution_id, institutions(id, settings)')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    // Admin y assistant pueden siempre (dentro de su institución)
    const isAdmin = profile.role === 'admin' || profile.role === 'assistant'

    // Traer el registro de asistencia con el curso del estudiante
    const { data: att } = await admin
      .from('attendance')
      .select('id, student_id, subject_id, institution_id, justification_status')
      .eq('id', attendanceId)
      .single()

    if (!att) return NextResponse.json({ error: 'Justificación no encontrada' }, { status: 404 })
    if (att.institution_id !== profile.institution_id) {
      return NextResponse.json({ error: 'No autorizado para esta institución' }, { status: 403 })
    }

    let authorized = isAdmin
    if (!authorized && profile.role === 'teacher') {
      // Check: ¿el teacher es tutor del curso del estudiante?
      const { data: enrollment } = await admin
        .from('enrollments')
        .select('course:courses(id, name, parallel)')
        .eq('student_id', att.student_id)
        .limit(5)
      const courseNames = ((enrollment || []) as any[])
        .flatMap((e: any) => Array.isArray(e.course) ? e.course : (e.course ? [e.course] : []))
        .filter(Boolean) as Array<{ name: string; parallel?: string | null }>

      const settings = (profile as any).institutions?.settings
      authorized = isTutorOfAnyCourse(settings, profile.full_name || '', courseNames)
    }

    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { error: updErr } = await admin
      .from('attendance')
      .update({ justification_status: action })
      .eq('id', attendanceId)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, attendanceId, action })
  } catch (err: any) {
    console.error('[POST /api/attendance/justifications/review]', err)
    return NextResponse.json({ error: err?.message ?? 'Error' }, { status: 500 })
  }
}
