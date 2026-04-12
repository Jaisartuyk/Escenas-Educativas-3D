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

/** Build the settings key for a given nivel+jornada slot */
function slotKey(nivel: string, jornada: string): string {
  const n = (nivel || 'colegio').toLowerCase().replace(/\s+/g, '_')
  const j = (jornada || 'matutina').toLowerCase()
  return `horarios_${n}_${j}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const qNivel   = searchParams.get('nivel')   || ''
  const qJornada = searchParams.get('jornada') || ''

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

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
  const allSettings = instData.settings || {}

  // ── If requesting list of saved slots ──────────────────────────────────────
  if (searchParams.get('list') === 'true') {
    const slots: { nivel: string, jornada: string, key: string }[] = []
    Object.keys(allSettings).forEach(k => {
      const match = k.match(/^horarios_(.+)_(matutina|vespertina)$/)
      if (match) {
        slots.push({
          nivel: match[1] === 'escuela' ? 'Escuela' : 'Colegio',
          jornada: match[2].toUpperCase(),
          key: k,
        })
      }
    })
    // Also check legacy 'horarios' key (always, not just when no slots)
    if (allSettings.horarios) {
      const legacy = allSettings.horarios
      const legacyNivel   = legacy.config?.nivel   || 'Colegio'
      const legacyJornada = legacy.config?.jornada  || 'MATUTINA'
      // Only add if there's no new-style slot for the same nivel+jornada
      const alreadyCovered = slots.some(s =>
        s.nivel.toLowerCase() === legacyNivel.toLowerCase() &&
        s.jornada.toUpperCase() === legacyJornada.toUpperCase()
      )
      if (!alreadyCovered) {
        slots.push({
          nivel: legacyNivel,
          jornada: legacyJornada,
          key: 'horarios',
        })
      }
    }
    return NextResponse.json({ slots }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  }

  // ── Load specific slot ──────────────────────────────────────────────────────
  const key = qNivel && qJornada ? slotKey(qNivel, qJornada) : ''

  // Try: specific slot → legacy 'horarios' → empty
  let horariosConfig = key ? allSettings[key] : null
  if (!horariosConfig) {
    // Fallback to legacy 'horarios' if it matches the requested nivel/jornada
    const legacy = allSettings.horarios
    if (legacy) {
      const legacyMatch = !qNivel || !qJornada ||
        (legacy.config?.nivel?.toLowerCase() === qNivel.toLowerCase() &&
         legacy.config?.jornada?.toUpperCase() === qJornada.toUpperCase())
      if (legacyMatch) horariosConfig = legacy
    }
  }
  if (!horariosConfig) {
    horariosConfig = {
      config:        getEmptyConfig(instData.name),
      docentes:      [],
      horasPorCurso: DEFAULT_HORAS,
      horario:       {},
      step:          0,
    }
    // Apply the requested nivel/jornada to the empty config
    if (qNivel) horariosConfig.config.nivel = qNivel
    if (qJornada) horariosConfig.config.jornada = qJornada
  }

  // ── Recopilar configuración de docentes de OTROS slots guardados ──────────
  // Si un docente fue marcado como "Escuela" o "MATUTINA" en otro horario,
  // heredamos esa config para que el filtro de compatibilidad funcione.
  const otherSlotsDocentes: Record<string, { jornada: string; nivel: string; titulo: string; materias: string[] }> = {}
  Object.entries(allSettings).forEach(([k, v]: [string, any]) => {
    if (k === key) return // skip the current slot
    if (!k.startsWith('horarios') || !v?.docentes) return
    ;(v.docentes as any[]).forEach((d: any) => {
      if (!d.id) return
      const prev = otherSlotsDocentes[d.id]
      // Keep the most restrictive setting (specific > AMBAS/AMBOS)
      const pickJornada = (a: string, b: string) => {
        if (!a || a === 'AMBAS') return b || 'AMBAS'
        if (!b || b === 'AMBAS') return a
        return a // both specific, keep first found
      }
      const pickNivel = (a: string, b: string) => {
        if (!a || a === 'AMBOS') return b || 'AMBOS'
        if (!b || b === 'AMBOS') return a
        return a
      }
      otherSlotsDocentes[d.id] = {
        jornada:  prev ? pickJornada(prev.jornada, d.jornada) : (d.jornada || 'AMBAS'),
        nivel:    prev ? pickNivel(prev.nivel, d.nivel) : (d.nivel || 'AMBOS'),
        titulo:   d.titulo || prev?.titulo || '',
        materias: d.materias?.length > 0 ? d.materias : (prev?.materias || []),
      }
    })
  })

  // ── Auto-inyección de DOCENTES reales ──────────────────────────────────────
  const { data: dbTeachers } = await admin
    .from('profiles' as any)
    .select('id, full_name')
    .eq('institution_id', instId)
    .eq('role', 'teacher')

  if (dbTeachers) {
    const existingIds = horariosConfig.docentes.map((d: any) => d.id)

    ;(dbTeachers as any[]).forEach((dbT: any) => {
      if (!existingIds.includes(dbT.id)) {
        // New teacher for this slot — inherit config from other slots if available
        const inherited = otherSlotsDocentes[dbT.id]
        horariosConfig.docentes.push({
          id:       dbT.id,
          titulo:   inherited?.titulo || '',
          nombre:   dbT.full_name,
          materias: inherited?.materias || [],
          jornada:  inherited?.jornada || 'AMBAS',
          nivel:    inherited?.nivel || 'AMBOS',
        })
      } else {
        const idx = horariosConfig.docentes.findIndex((d: any) => d.id === dbT.id)
        if (idx !== -1) {
          horariosConfig.docentes[idx].nombre = dbT.full_name
          // If this docente has default values, inherit from other slots
          const doc = horariosConfig.docentes[idx]
          const inherited = otherSlotsDocentes[dbT.id]
          if (inherited) {
            if (!doc.jornada || doc.jornada === 'AMBAS') doc.jornada = inherited.jornada
            if (!doc.nivel || doc.nivel === 'AMBOS') doc.nivel = inherited.nivel
            if (!doc.titulo && inherited.titulo) doc.titulo = inherited.titulo
            if ((!doc.materias || doc.materias.length === 0) && inherited.materias?.length > 0) {
              doc.materias = inherited.materias
            }
          }
        }
      }
    })
  }

  // ── Auto-inyección de CURSOS reales ──────────────────────────────────────
  const { data: dbCourses } = await admin
    .from('courses' as any)
    .select('id, name, parallel')
    .eq('institution_id', instId)
    .order('name', { ascending: true })

  if (dbCourses && (dbCourses as any[]).length > 0) {
    const dbCourseNames = (dbCourses as any[]).map((c: any) => {
      const label = c.parallel ? `${c.name} ${c.parallel}`.trim() : c.name
      return label
    })
    // Merge: keep existing wizard cursos, add any new DB courses not in list
    const currentCursos: string[] = horariosConfig.config?.cursos || []
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    const normalizedCurrent = currentCursos.map(normalize)

    dbCourseNames.forEach((name: string) => {
      if (!normalizedCurrent.includes(normalize(name))) {
        currentCursos.push(name)
      }
    })
    horariosConfig.config.cursos = currentCursos
  }

  // ── Auto-inyección de MATERIAS reales al horasPorCurso ──────────────────
  const { data: dbSubjects } = await admin
    .from('subjects' as any)
    .select('name, weekly_hours, course_id, teacher_id')
    .eq('institution_id', instId)

  if (dbSubjects && (dbSubjects as any[]).length > 0) {
    // Build a map: course DB name → subject list
    const courseIdToName: Record<string, string> = {}
    if (dbCourses) {
      ;(dbCourses as any[]).forEach((c: any) => {
        courseIdToName[c.id] = c.parallel ? `${c.name} ${c.parallel}`.trim() : c.name
      })
    }

    const horasPorCurso = horariosConfig.horasPorCurso || {}

    ;(dbSubjects as any[]).forEach((sub: any) => {
      const courseName = courseIdToName[sub.course_id]
      if (!courseName) return

      if (!horasPorCurso[courseName]) horasPorCurso[courseName] = {}

      // Only set from DB if the wizard doesn't already have a value for this subject
      if (horasPorCurso[courseName][sub.name] === undefined || horasPorCurso[courseName][sub.name] === 0) {
        horasPorCurso[courseName][sub.name] = sub.weekly_hours || 1
      }

      // Also inject this materia into the docente's list if teacher_id is set
      if (sub.teacher_id) {
        const docIdx = horariosConfig.docentes.findIndex((d: any) => d.id === sub.teacher_id)
        if (docIdx !== -1) {
          const materias: string[] = horariosConfig.docentes[docIdx].materias || []
          if (!materias.includes(sub.name)) {
            materias.push(sub.name)
            horariosConfig.docentes[docIdx].materias = materias
          }
        }
      }
    })

    horariosConfig.horasPorCurso = horasPorCurso
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

  // Determine the slot key from the body's config nivel+jornada
  const bodyNivel = body.config?.nivel || ''
  const bodyJornada = body.config?.jornada || ''
  const saveKey = bodyNivel && bodyJornada ? slotKey(bodyNivel, bodyJornada) : 'horarios'

  const newSettings = {
    ...currentSettings,
    [saveKey]: body,  // save to slot-specific key (e.g. horarios_escuela_matutina)
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

    // ── 2b. Cursos (con deduplicación inteligente) ─────────────────────────
    const { data: existingCourses } = await admin
      .from('courses' as any)
      .select('id, name')
      .eq('institution_id', instId)

    // Normalize: remove accents, extra spaces, lowercase for comparison
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

    const courseMap: Record<string, string> = {}        // exact name → id
    const normalizedMap: Record<string, string> = {}    // normalized name → exact name
    ;(existingCourses as any[] || []).forEach((c: any) => {
      courseMap[c.name] = c.id
      normalizedMap[normalize(c.name)] = c.name
    })

    // Only create courses that don't already exist (checking normalized names)
    const newCourseNames = (body.config?.cursos || []).filter((c: string) => {
      // Skip if exact match exists
      if (courseMap[c]) return false
      // Skip if normalized match exists (e.g. "INICIAL 1" vs "Inicial 1")
      const norm = normalize(c)
      if (normalizedMap[norm]) {
        // Map this config name to the existing course id
        courseMap[c] = courseMap[normalizedMap[norm]]
        return false
      }
      return true
    })
    if (newCourseNames.length > 0) {
      const { randomUUID } = require('crypto')
      const toInsert = newCourseNames.map((c: string) => {
        const nid = randomUUID()
        courseMap[c] = nid
        normalizedMap[normalize(c)] = c
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
    // Mapa course_id → nombres de materias con horas > 0 (los que deben existir)
    const validSubjectNames: Record<string, string[]> = {}

    Object.entries(body.horasPorCurso || {}).forEach(([cursName, materias]) => {
      const course_id = courseMap[cursName]
      if (!course_id) return

      validSubjectNames[course_id] = []

      Object.entries(materias as Record<string, number>).forEach(([matName, hours]) => {
        if (!hours || hours <= 0) return
        validSubjectNames[course_id].push(matName)
        subjectsToUpsert.push({
          course_id,
          institution_id: instId,
          name:           matName,
          weekly_hours:   Number(hours),
          teacher_id:     materiaTeacher[matName] || null,
        })
      })
    })

    // Upsert materias con horas > 0
    if (subjectsToUpsert.length > 0) {
      await admin.from('subjects' as any).upsert(subjectsToUpsert, {
        onConflict:       'course_id,name',
        ignoreDuplicates: false,
      })
    }

    // ── Eliminar materias que bajaron a 0 horas o fueron quitadas ──────────
    const courseIdsInConfig = Object.keys(validSubjectNames)
    if (courseIdsInConfig.length > 0) {
      const { data: existingSubjects } = await admin
        .from('subjects' as any)
        .select('id, course_id, name')
        .in('course_id', courseIdsInConfig)
        .eq('institution_id', instId)

      if (existingSubjects) {
        const idsToDelete = (existingSubjects as any[])
          .filter((s: any) => {
            const valid = validSubjectNames[s.course_id] || []
            return !valid.includes(s.name)
          })
          .map((s: any) => s.id)

        if (idsToDelete.length > 0) {
          await admin.from('subjects' as any)
            .delete()
            .in('id', idsToDelete)
        }
      }
    }

  } catch (err) {
    console.error('[horarios] Error sincronizando tablas relacionales:', err)
  }

  return NextResponse.json({ success: true })
}
