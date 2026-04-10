import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmptyConfig, DEFAULT_HORAS } from '@/types/horarios'

export const dynamic = 'force-dynamic'

/** Valida que un string sea un UUID real (profile.id de Supabase).
 *  Los docentes creados manualmente en el wizard usan Date.now().toString()
 *  y NO corresponden a ningún perfil real en la DB. */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export async function GET() {
  // Solo usamos el cliente anon para verificar la sesión del usuario
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Todo lo demás con adminClient para bypassear RLS
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles' as any)
    .select('institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id)
    return NextResponse.json({ error: 'No tienes una institución asignada' }, { status: 400 })

  const instId = (profile as any).institution_id

  const { data: inst } = await admin
    .from('institutions' as any)
    .select('name, settings')
    .eq('id', instId)
    .single()

  if (!inst) return NextResponse.json({ error: 'Institución no encontrada' }, { status: 404 })

  const instData = inst as any

  // Estado base: JSON blob del wizard (fuente de verdad de la UI)
  const horariosConfig = instData.settings?.horarios || {
    config:        getEmptyConfig(instData.name),
    docentes:      [],
    horasPorCurso: DEFAULT_HORAS,
    horario:       {},
    step:          0,
  }

  // Auto-inyección: docentes con rol 'teacher' en la DB se fusionan al wizard
  // Sus IDs reales permiten vincular teacher_id en subjects
  const { data: dbTeachers } = await admin
    .from('profiles' as any)
    .select('id, full_name')
    .eq('institution_id', instId)
    .eq('role', 'teacher')

  if (dbTeachers) {
    const existingIds = horariosConfig.docentes.map((d: any) => d.id)

    ;(dbTeachers as any[]).forEach((dbT: any) => {
      if (!existingIds.includes(dbT.id)) {
        // Docente real que aún no está en el wizard → inyectar con ID real y materias vacías
        horariosConfig.docentes.push({
          id:       dbT.id,
          titulo:   '',
          nombre:   dbT.full_name,
          materias: [],
          jornada:  'AMBAS',
          nivel:    'AMBOS',
        })
      } else {
        // Ya existe → solo actualizar nombre si cambió en su perfil
        const idx = horariosConfig.docentes.findIndex((d: any) => d.id === dbT.id)
        if (idx !== -1) horariosConfig.docentes[idx].nombre = dbT.full_name
      }
    })
  }

  return NextResponse.json(
    { ...horariosConfig, directory: instData.settings?.directory || {} },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  )
}

export async function POST(req: Request) {
  // Solo usamos el cliente anon para verificar la sesión del usuario
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()

  // Todo lo demás con adminClient
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles' as any)
    .select('institution_id')
    .eq('id', user.id)
    .single()

  if (!(profile as any)?.institution_id)
    return NextResponse.json({ error: 'Sin institución' }, { status: 400 })

  const instId = (profile as any).institution_id

  // ── 1. Guardar JSON blob (fuente de verdad del wizard) ──────────────────────
  const { data: inst } = await admin
    .from('institutions' as any)
    .select('settings')
    .eq('id', instId)
    .single()

  const currentSettings = (inst as any)?.settings || {}
  const newSettings = {
    ...currentSettings,
    horarios: body,  // reemplaza solo la llave 'horarios', preserva el resto
  }

  const { error: settingsError } = await admin
    .from('institutions' as any)
    .update({ settings: newSettings })
    .eq('id', instId)

  if (settingsError)
    return NextResponse.json({ error: settingsError.message }, { status: 500 })

  // ── 2. Sincronizar tablas relacionales ──────────────────────────────────────
  try {
    // ── 2a. schedule_configs: recesos, períodos, tutores ────────────────────
    if (body.config) {
      await admin.from('schedule_configs' as any).upsert(
        {
          institution_id: instId,
          nombre:     body.config.nombre    || '',
          anio:       body.config.anio      || '',
          jornada:    body.config.jornada   || 'MATUTINA',
          nivel:      body.config.nivel     || 'Colegio',
          n_periodos: body.config.nPeriodos || 8,
          periodos:   body.config.horarios  || [],
          recesos:    body.config.recesos   || [4],
          tutores:    body.config.tutores   || {},
        },
        { onConflict: 'institution_id' }
      )
    }

    // ── 2b. Cursos ──────────────────────────────────────────────────────────
    const { data: existingCourses } = await admin
      .from('courses' as any)
      .select('id, name')
      .eq('institution_id', instId)

    const courseMap: Record<string, string> = {}
    ;(existingCourses as any[] || []).forEach((c: any) => { courseMap[c.name] = c.id })

    const newCourseNames = (body.config?.cursos || []).filter(
      (c: string) => !courseMap[c]
    )
    if (newCourseNames.length > 0) {
      const { randomUUID } = require('crypto')
      const toInsert = newCourseNames.map((c: string) => {
        const nid = randomUUID()
        courseMap[c] = nid
        return { id: nid, institution_id: instId, name: c }
      })
      await admin.from('courses' as any).insert(toInsert)
    }

    // ── 2c. Subjects desde horasPorCurso ─────────────────────────────────────
    // Mapa materia → teacher_id (solo UUIDs reales de profiles)
    const materiaTeacher: Record<string, string> = {}
    ;(body.docentes || []).forEach((d: any) => {
      if (isValidUUID(d.id)) {
        ;(d.materias || []).forEach((m: string) => { materiaTeacher[m] = d.id })
      }
    })

    const subjectsToUpsert: any[] = []
    Object.entries(body.horasPorCurso || {}).forEach(([cursName, materias]) => {
      const course_id = courseMap[cursName]
      if (!course_id) return

      Object.entries(materias as Record<string, number>).forEach(([matName, hours]) => {
        if (!hours || hours <= 0) return
        subjectsToUpsert.push({
          course_id,
          institution_id: instId,
          name:           matName,
          weekly_hours:   Number(hours),
          teacher_id:     materiaTeacher[matName] || null,
        })
      })
    })

    if (subjectsToUpsert.length > 0) {
      await admin.from('subjects' as any).upsert(subjectsToUpsert, {
        onConflict:       'course_id,name',
        ignoreDuplicates: false,
      })
    }

  } catch (err) {
    console.error('[horarios] Error sincronizando tablas relacionales:', err)
  }

  return NextResponse.json({ success: true })
}
