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

  // ── Auto-inyección de CURSOS filtrados por nivel+jornada ───────────────────
  const { data: dbCourses } = await admin
    .from('courses' as any)
    .select('id, name, parallel, level, shift')
    .eq('institution_id', instId)
    .order('name', { ascending: true })

  // Filter courses that match the requested nivel+jornada
  const slotNivel   = horariosConfig.config?.nivel   || qNivel   || ''
  const slotJornada = horariosConfig.config?.jornada  || qJornada || ''

  const matchingCourses = (dbCourses as any[] || []).filter((c: any) => {
    // Courses without level/shift defined don't match any specific slot
    if (!c.level || !c.shift) return false
    const levelOk = !slotNivel || c.level === slotNivel
    const shiftOk = !slotJornada || c.shift === 'AMBAS' || c.shift === slotJornada
    return levelOk && shiftOk
  })

  // Replace cursos list with DB courses that match this slot (source of truth)
  if (matchingCourses.length > 0) {
    const dbCourseNames = matchingCourses.map((c: any) => {
      return c.parallel ? `${c.name} ${c.parallel}`.trim() : c.name
    })
    horariosConfig.config.cursos = dbCourseNames
  } else {
    // No matching courses in DB — clear the list
    horariosConfig.config.cursos = []
  }

  // Map course id → display name (only matching courses)
  const courseIdToName: Record<string, string> = {}
  matchingCourses.forEach((c: any) => {
    courseIdToName[c.id] = c.parallel ? `${c.name} ${c.parallel}`.trim() : c.name
  })

  // ── Auto-inyección de MATERIAS + deducción de docentes ────────────────────
  const { data: dbSubjects } = await admin
    .from('subjects' as any)
    .select('name, weekly_hours, course_id, teacher_id')
    .eq('institution_id', instId)

  // Track which teachers teach in which levels/shifts (from ALL courses for deduction)
  const teacherLevels:  Record<string, Set<string>> = {}
  const teacherShifts:  Record<string, Set<string>> = {}
  // Materias ONLY from courses matching this slot (for the horario generator)
  const teacherMaterias: Record<string, Set<string>> = {}

  // Set of matching course IDs for this slot
  const matchingCourseIds = new Set(matchingCourses.map((c: any) => c.id))

  if (dbSubjects && dbCourses) {
    // Build full course map for level/shift lookup
    const allCourseMap: Record<string, any> = {}
    ;(dbCourses as any[]).forEach((c: any) => { allCourseMap[c.id] = c })

    ;(dbSubjects as any[]).forEach((sub: any) => {
      if (!sub.teacher_id) return
      const course = allCourseMap[sub.course_id]
      if (!course) return

      if (!teacherLevels[sub.teacher_id])  teacherLevels[sub.teacher_id]  = new Set()
      if (!teacherShifts[sub.teacher_id])  teacherShifts[sub.teacher_id]  = new Set()

      if (course.level) teacherLevels[sub.teacher_id].add(course.level)
      if (course.shift) teacherShifts[sub.teacher_id].add(course.shift)

      // Only add materias from courses that match this slot
      if (matchingCourseIds.has(sub.course_id)) {
        if (!teacherMaterias[sub.teacher_id]) teacherMaterias[sub.teacher_id] = new Set()
        teacherMaterias[sub.teacher_id].add(sub.name)
      }
    })
  }

  // Deduce jornada/nivel for each teacher from their course assignments
  function deduceJornada(teacherId: string): string {
    const shifts = teacherShifts[teacherId]
    if (!shifts || shifts.size === 0) return 'AMBAS'
    if (shifts.has('AMBAS')) return 'AMBAS'
    if (shifts.has('MATUTINA') && shifts.has('VESPERTINA')) return 'AMBAS'
    if (shifts.has('MATUTINA')) return 'MATUTINA'
    if (shifts.has('VESPERTINA')) return 'VESPERTINA'
    return 'AMBAS'
  }
  function deduceNivel(teacherId: string): string {
    const levels = teacherLevels[teacherId]
    if (!levels || levels.size === 0) return 'AMBOS'
    if (levels.has('Escuela') && levels.has('Colegio')) return 'AMBOS'
    if (levels.has('Escuela')) return 'Escuela'
    if (levels.has('Colegio')) return 'Colegio'
    return 'AMBOS'
  }

  // ── Auto-inyección de DOCENTES reales (DB es fuente de verdad) ──────────
  const { data: dbTeachers } = await admin
    .from('profiles' as any)
    .select('id, full_name')
    .eq('institution_id', instId)
    .eq('role', 'teacher')

  if (dbTeachers && (dbTeachers as any[]).length > 0) {
    // Build docentes list entirely from DB — materias come from subjects table
    horariosConfig.docentes = (dbTeachers as any[]).map((dbT: any) => ({
      id:       dbT.id,
      titulo:   '',
      nombre:   dbT.full_name,
      materias: Array.from(teacherMaterias[dbT.id] || []),
      jornada:  deduceJornada(dbT.id),
      nivel:    deduceNivel(dbT.id),
    }))
  }
  // else: keep docentes from JSONB settings (manually loaded via wizard or SQL)

  // ── Inyectar horas por curso desde DB (fuente de verdad) ─────────────────
  // DB subjects REPLACE saved horasPorCurso — the institution page is the source of truth
  if (dbSubjects && (dbSubjects as any[]).length > 0) {
    const horasPorCurso: Record<string, Record<string, number>> = {}
    const docentePorCurso: Record<string, Record<string, string>> = {}

    // We need a map of teacher_id -> dbTeacherName to resolve it cleanly
    const teacherIdToName: Record<string, string> = {}
    if (dbTeachers) {
      ;(dbTeachers as any[]).forEach(t => teacherIdToName[t.id] = t.full_name)
    }

    ;(dbSubjects as any[]).forEach((sub: any) => {
      const courseName = courseIdToName[sub.course_id]
      if (!courseName) return // skip subjects from non-matching courses

      if (!horasPorCurso[courseName]) horasPorCurso[courseName] = {}
      if (!docentePorCurso[courseName]) docentePorCurso[courseName] = {}

      horasPorCurso[courseName][sub.name] = sub.weekly_hours || 1
      docentePorCurso[courseName][sub.name] = sub.teacher_id ? (teacherIdToName[sub.teacher_id] || '') : '—'
    })

    horariosConfig.horasPorCurso = horasPorCurso
    horariosConfig.docentePorCurso = docentePorCurso
  } else {
    // No subjects in DB for matching courses → clear
    horariosConfig.horasPorCurso = {}
    horariosConfig.docentePorCurso = {}
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
    .select('institution_id, role')
    .eq('id', user.id)
    .single()

  if (!(profile as any)?.institution_id)
    return NextResponse.json({ error: 'Sin institución' }, { status: 400 })

  const userRole = (profile as any)?.role
  if (userRole !== 'admin' && userRole !== 'assistant' && userRole !== 'horarios_only') {
    return NextResponse.json({ error: 'Sin permiso para modificar horarios' }, { status: 403 })
  }

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
        return {
          id: nid,
          institution_id: instId,
          name: c,
          level: bodyNivel || null,
          shift: bodyJornada || null,
        }
      })
      await admin.from('courses' as any).insert(toInsert)
    }

    // ── 2c. Subjects desde config ─────────────────────────────────────
    // Mapa nombre del docente → teacher_id (solo UUIDs reales de profiles)
    const nameToTeacherId: Record<string, string> = {}
    const materiaTeacherGlobal: Record<string, string> = {} // Fallback legacy
    ;(body.docentes || []).forEach((d: any) => {
      if (isValidUUID(d.id)) {
        if (d.nombre) nameToTeacherId[d.nombre.trim()] = d.id
        ;(d.materias || []).forEach((m: string) => { materiaTeacherGlobal[m] = d.id })
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
        
        let exactTeacherId = null
        if (body.docentePorCurso && body.docentePorCurso[cursName] && body.docentePorCurso[cursName][matName]) {
          const tName = body.docentePorCurso[cursName][matName]
          if (tName && tName !== '—') exactTeacherId = nameToTeacherId[tName.trim()] || null
        } else if (!body.docentePorCurso) {
          exactTeacherId = materiaTeacherGlobal[matName] || null
        }

        validSubjectNames[course_id].push(matName)
        subjectsToUpsert.push({
          course_id,
          institution_id: instId,
          name:           matName,
          weekly_hours:   Number(hours),
          teacher_id:     exactTeacherId,
        })
      })
    })

    // Upsert materias con horas > 0
    // Se usa institution_id en el filtro para garantizar aislamiento por institución
    if (subjectsToUpsert.length > 0) {
      for (const sub of subjectsToUpsert) {
        const { data: existing } = await admin
          .from('subjects' as any)
          .select('id')
          .eq('course_id', sub.course_id)
          .eq('name', sub.name)
          .eq('institution_id', instId)
          .maybeSingle()

        if (existing) {
          await admin.from('subjects' as any)
            .update({ weekly_hours: sub.weekly_hours, teacher_id: sub.teacher_id })
            .eq('id', (existing as any).id)
        } else {
          await admin.from('subjects' as any).insert(sub)
        }
      }
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
