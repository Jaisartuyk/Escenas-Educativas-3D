import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id)
    return NextResponse.json({ error: 'No tienes una institución asignada' }, { status: 400 })

  const { data: inst } = await (supabase as any)
    .from('institutions')
    .select('name, settings')
    .eq('id', profile.institution_id)
    .single()

  if (!inst) return NextResponse.json({ error: 'Institución no encontrada' }, { status: 404 })

  // Estado base: JSON blob del wizard (fuente de verdad de la UI)
  const horariosConfig = inst.settings?.horarios || {
    config: getEmptyConfig(inst.name),
    docentes: [],
    horasPorCurso: DEFAULT_HORAS,
    horario: {},
    step: 0,
  }

  // Auto-inyección: docentes con rol 'teacher' en la DB se fusionan al wizard
  // De esta forma los docentes creados en Gestión Académica aparecen automáticamente
  const { data: dbTeachers } = await (supabase as any)
    .from('profiles')
    .select('id, full_name')
    .eq('institution_id', profile.institution_id)
    .eq('role', 'teacher')

  if (dbTeachers) {
    const existingIds = horariosConfig.docentes.map((d: any) => d.id)

    dbTeachers.forEach((dbT: any) => {
      if (!existingIds.includes(dbT.id)) {
        // Docente real aún no aparece en el wizard → inyectar con ID real
        horariosConfig.docentes.push({
          id: dbT.id,
          titulo: '',
          nombre: dbT.full_name,
          materias: [],
          jornada: 'AMBAS',
          nivel: 'AMBOS',
        })
      } else {
        // Sincronizar nombre por si cambió en su perfil
        const idx = horariosConfig.docentes.findIndex((d: any) => d.id === dbT.id)
        if (idx !== -1) horariosConfig.docentes[idx].nombre = dbT.full_name
      }
    })
  }

  return NextResponse.json(
    { ...horariosConfig, directory: inst?.settings?.directory || {} },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
  )
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })

  // ── 1. Guardar JSON blob (fuente de verdad del wizard) ─────────────────────
  const { data: inst } = await (supabase as any)
    .from('institutions')
    .select('settings')
    .eq('id', profile.institution_id)
    .single()

  const newSettings = {
    ...(inst?.settings || {}),
    horarios: body,
  }

  const { error: settingsError } = await (supabase as any)
    .from('institutions')
    .update({ settings: newSettings })
    .eq('id', profile.institution_id)

  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  // ── 2. Sincronizar tablas relacionales (usa adminClient para bypassear RLS) ─
  const admin = createAdminClient()

  try {
    // ── 2a. Upsert schedule_configs ──────────────────────────────────────────
    if (body.config) {
      await admin.from('schedule_configs' as any).upsert(
        {
          institution_id: profile.institution_id,
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

    // ── 2b. Sincronizar cursos ───────────────────────────────────────────────
    const { data: existingCourses } = await admin
      .from('courses' as any)
      .select('id, name')
      .eq('institution_id', profile.institution_id)

    const currentCourseDbMap: Record<string, string> = {}
    ;(existingCourses as any[] || []).forEach((c: any) => {
      currentCourseDbMap[c.name] = c.id
    })

    const cursosConfig: string[] = body.config?.cursos || []
    const currentCourseNames = Object.keys(currentCourseDbMap)
    const newCourseNames = cursosConfig.filter((c) => !currentCourseNames.includes(c))

    if (newCourseNames.length > 0) {
      const { randomUUID } = require('crypto')
      const coursesToInsert = newCourseNames.map((c: string) => {
        const nid = randomUUID()
        currentCourseDbMap[c] = nid
        return {
          id: nid,
          institution_id: profile.institution_id,
          name: c,
        }
      })
      await admin.from('courses' as any).insert(coursesToInsert)
    }

    // ── 2c. Sincronizar subjects desde horasPorCurso ─────────────────────────
    // horasPorCurso = { "8VO": { "MATEMATICA": 5, "LENGUA": 4, ... }, ... }
    // Esta es la fuente correcta: vincula materia + curso + horas en un solo lugar.
    // docentes.materias indica qué docente enseña cada materia (para el teacher_id).

    // Mapa: nombre de materia → profile.id del docente (solo UUIDs reales)
    const materiaToTeacherId: Record<string, string> = {}
    ;(body.docentes || []).forEach((d: any) => {
      if (isValidUUID(d.id)) {
        ;(d.materias || []).forEach((m: string) => {
          materiaToTeacherId[m] = d.id
        })
      }
    })

    // Construir lista de subjects a upsert
    const subjectsToUpsert: any[] = []
    Object.entries(body.horasPorCurso || {}).forEach(([cursName, materias]) => {
      const course_id = currentCourseDbMap[cursName]
      if (!course_id) return // curso aún no creado en DB, ignorar

      Object.entries(materias as Record<string, number>).forEach(([matName, hours]) => {
        if (!hours || hours <= 0) return // materia sin horas asignadas

        subjectsToUpsert.push({
          course_id,
          institution_id: profile.institution_id,
          name:           matName,
          weekly_hours:   Number(hours),
          teacher_id:     materiaToTeacherId[matName] || null,
        })
      })
    })

    if (subjectsToUpsert.length > 0) {
      // onConflict: 'course_id,name' requiere el unique index creado en la migración 0005
      await admin.from('subjects' as any).upsert(subjectsToUpsert, {
        onConflict: 'course_id,name',
        ignoreDuplicates: false,
      })
    }

  } catch (err) {
    console.error('[horarios] Error sincronizando tablas relacionales:', err)
  }

  return NextResponse.json({ success: true })
}
