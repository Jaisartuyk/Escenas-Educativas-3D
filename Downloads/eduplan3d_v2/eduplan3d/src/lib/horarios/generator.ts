// src/lib/horarios/generator.ts
import type { HorarioGrid, HorasPorCurso, Docente, InstitucionConfig, Dia } from '@/types/horarios'
import { DIAS, getCursoStructure } from '@/types/horarios'

export function getDocForMateria(
  materia: string,
  docentes: Docente[],
  jornada: string = '',
  nivel?: string,
  docentePorCurso?: Record<string, Record<string, string>>,
  curso?: string
): string {
  // Use exact DB match if available
  if (docentePorCurso && curso) {
    if (docentePorCurso[curso] && docentePorCurso[curso][materia] !== undefined) {
      return docentePorCurso[curso][materia]
    }
    // Strict mode: if the subject is not in DB (e.g. custom UI subject), it has no teacher
    return '—'
  }

  // Fallback for old setups that don't have docentePorCurso
  const d = docentes.find(d => 
    d.materias && d.materias.includes(materia) && 
    (!jornada || !d.jornada || d.jornada === 'AMBAS' || d.jornada === jornada) &&
    (!nivel || !d.nivel || d.nivel === 'AMBOS' || d.nivel === nivel)
  )
  return d ? `${d.titulo} ${d.nombre}`.trim() : '—'
}

/**
 * Genera horario usando BACKTRACKING con best-effort partial.
 *
 * Estrategia:
 * 1. Construye la lista de clases a colocar (una entrada por hora de cada
 *    materia en cada curso). Cada entrada conoce sus días permitidos,
 *    períodos válidos y docente asignado.
 * 2. Ordena las entradas por dificultad (MCV = Most Constrained Variable):
 *    materias con pocos días permitidos primero, luego agrupadas por
 *    curso-materia para respetar el límite de 2h/día.
 * 3. Backtracking recursivo: intenta colocar cada entrada en un slot válido.
 *    Si la recursión falla (ninguna asignación subsiguiente funciona),
 *    deshace y prueba otro slot. Si ningún slot funciona, intenta saltar
 *    esta entrada (best-effort) y continúa.
 * 4. Snapshot: durante la exploración guarda la mejor solución parcial vista
 *    (mayor número de clases colocadas). Si el backtracking completo no
 *    termina dentro del presupuesto de iteraciones, se devuelve la mejor
 *    parcial encontrada — garantiza progreso vs la versión greedy.
 * 5. Pasada final marca huecos al fin del día como SALIDA.
 */
export function generarHorario(
  config: InstitucionConfig,
  docentes: Docente[],
  horasPorCurso: HorasPorCurso,
  docentePorCurso?: Record<string, Record<string, string>>
): HorarioGrid {
  const { cursos } = config
  const useAcomp = config.acompanamiento !== false

  // ─── Inicializar horario con recesos y ACOMPAÑAMIENTO ───
  function initHorario(): HorarioGrid {
    const h: HorarioGrid = {}
    cursos.forEach(c => {
      const { nPeriodos: np, recesos } = getCursoStructure(config, c)
      h[c] = {} as Record<Dia, string[]>
      DIAS.forEach(d => {
        h[c][d] = Array(np).fill('')
        recesos.forEach(r => { if (r < np) h[c][d][r] = 'RECESO' })
      })
      if (useAcomp) h[c]['Lunes'][0] = 'ACOMPAÑAMIENTO'
    })
    return h
  }

  // ─── Construir lista de entradas (una por hora-clase a colocar) ───
  type Entry = {
    curso: string
    materia: string
    doc: string
    diasPermitidos: Dia[]
    validPeriods: number[]
    horasLabels: string[]
  }
  const entries: Entry[] = []
  cursos.forEach(c => {
    const { nPeriodos: np, horarios: horasLabels, recesos } = getCursoStructure(config, c)
    const validPeriods = Array.from({ length: np }, (_, i) => i).filter(i => !recesos.includes(i))
    const hm = horasPorCurso[c] ?? {}
    Object.entries(hm)
      .filter(([, h]) => h > 0)
      // Orden interno: materias con más horas primero (mejora heurística de
      // colocación temprana cuando hay empates de dificultad)
      .sort(([, a], [, b]) => b - a)
      .forEach(([materia, horas]) => {
        const doc = getDocForMateria(materia, docentes, config.jornada, config.nivel, docentePorCurso, c)
        const restringidos = config.diasPorMateria?.[materia]
        const diasPermitidos: Dia[] = (restringidos && restringidos.length > 0) ? restringidos : DIAS
        for (let i = 0; i < horas; i++) {
          entries.push({ curso: c, materia, doc, diasPermitidos, validPeriods, horasLabels })
        }
      })
  })

  // MCV: menos días permitidos = más difícil, va primero.
  // Para igualdad, agrupa por curso-materia (sirve al límite 2h/día).
  entries.sort((a, b) => {
    if (a.diasPermitidos.length !== b.diasPermitidos.length) {
      return a.diasPermitidos.length - b.diasPermitidos.length
    }
    const ak = `${a.curso}|${a.materia}`
    const bk = `${b.curso}|${b.materia}`
    return ak.localeCompare(bk)
  })

  // ─── Estado mutable del backtracking ───
  const horario = initHorario()
  const docBusy: Record<string, Set<string>> = {} // "dia|horaLabel" → Set<docente>
  const usoPorDia: Record<string, number> = {}    // "curso|materia|dia" → count
  let placedCount = 0

  // Snapshot de mejor parcial
  let bestHorario: HorarioGrid | null = null
  let bestPlaced = -1
  function snapshot() {
    if (placedCount > bestPlaced) {
      bestPlaced = placedCount
      bestHorario = JSON.parse(JSON.stringify(horario))
    }
  }

  const MAX_ITERATIONS = 200000
  let iterations = 0

  function canPlace(e: Entry, d: Dia, p: number): boolean {
    if (horario[e.curso][d][p]) return false // ocupado (materia/RECESO/ACOMP)
    if (useAcomp && d === 'Lunes' && p === 0) return false
    const kDia = `${e.curso}|${e.materia}|${d}`
    if ((usoPorDia[kDia] ?? 0) >= 2) return false
    if (e.doc !== '—') {
      const label = e.horasLabels[p] ?? String(p)
      const set = docBusy[`${d}|${label}`]
      if (set && set.has(e.doc)) return false
    }
    return true
  }
  function doPlace(e: Entry, d: Dia, p: number) {
    horario[e.curso][d][p] = e.materia
    const kDia = `${e.curso}|${e.materia}|${d}`
    usoPorDia[kDia] = (usoPorDia[kDia] ?? 0) + 1
    if (e.doc !== '—') {
      const label = e.horasLabels[p] ?? String(p)
      const bk = `${d}|${label}`
      if (!docBusy[bk]) docBusy[bk] = new Set()
      docBusy[bk].add(e.doc)
    }
    placedCount++
  }
  function undoPlace(e: Entry, d: Dia, p: number) {
    horario[e.curso][d][p] = ''
    const kDia = `${e.curso}|${e.materia}|${d}`
    usoPorDia[kDia] = (usoPorDia[kDia] ?? 0) - 1
    if (e.doc !== '—') {
      const label = e.horasLabels[p] ?? String(p)
      docBusy[`${d}|${label}`]?.delete(e.doc)
    }
    placedCount--
  }

  // Backtracking real con branch-and-bound: explora todos los subárboles
  // hasta encontrar óptimo o agotar el presupuesto. Snapshot captura mejor
  // parcial. Corto circuito: si bestPlaced alcanza entries.length terminamos.
  // Pruning: si el máximo alcanzable desde aquí no supera bestPlaced, corta.
  function backtrack(idx: number): void {
    if (iterations++ > MAX_ITERATIONS) return
    snapshot()
    if (bestPlaced === entries.length) return
    if (idx >= entries.length) return
    // Podado: aunque coloquemos todas las entradas restantes, ¿superamos el best?
    const maxPossible = placedCount + (entries.length - idx)
    if (maxPossible <= bestPlaced) return

    const e = entries[idx]
    // Construir candidatos válidos
    const candidates: { d: Dia; p: number }[] = []
    for (const d of e.diasPermitidos) {
      for (const p of e.validPeriods) {
        if (canPlace(e, d, p)) candidates.push({ d, p })
      }
    }
    // Heurística: empaca en períodos tempranos, reparte entre días
    candidates.sort((a, b) => {
      if (a.p !== b.p) return a.p - b.p
      return DIAS.indexOf(a.d) - DIAS.indexOf(b.d)
    })

    // Explora cada candidato
    for (const { d, p } of candidates) {
      doPlace(e, d, p)
      backtrack(idx + 1)
      undoPlace(e, d, p)
      if (iterations > MAX_ITERATIONS) return
      if (bestPlaced === entries.length) return
    }

    // También explora saltar esta entrada (best-effort partial): permite
    // encontrar soluciones donde una entrada imposible se omite pero el
    // resto se coloca. Snapshot capturará el mejor subárbol.
    backtrack(idx + 1)
  }

  backtrack(0)

  // Usa la mejor parcial si el backtracking no completó
  const result = bestHorario ?? horario

  // ─── Pasada final: marcar huecos al fin del día como SALIDA ───
  cursos.forEach(c => {
    const { nPeriodos: np } = getCursoStructure(config, c)
    DIAS.forEach(d => {
      const row = result[c][d]
      let lastClass = -1
      for (let p = np - 1; p >= 0; p--) {
        const v = row[p]
        if (v && v !== 'RECESO' && v !== '') { lastClass = p; break }
      }
      for (let p = lastClass + 1; p < np; p++) row[p] = 'SALIDA'
    })
  })

  if (placedCount < entries.length || bestPlaced < entries.length) {
    console.warn(`[horarios] backtracking colocó ${bestPlaced}/${entries.length} clases (iteraciones: ${iterations})`)
  }

  return result
}

/**
 * Detecta conflictos de docentes cuando los cursos comparten la misma
 * estructura de períodos (compara por índice). Mantenido por compat.
 * Para configs con cursosCustom (estructura distinta por curso), usar
 * `detectConflictosPorHora` que compara por hora real.
 */
export function detectConflictos(
  horario: HorarioGrid,
  docentes: Docente[],
  nPeriodos: number,
  jornada: string = '',
  nivel?: string,
  docentePorCurso?: Record<string, Record<string, string>>
): { curso: string; dia: Dia; periodo: number; materia: string; docente: string }[] {
  const conflictos: { curso: string; dia: Dia; periodo: number; materia: string; docente: string }[] = []
  const cursos = Object.keys(horario)

  DIAS.forEach(d => {
    for (let p = 0; p < nPeriodos; p++) {
      const ocupado: Record<string, string[]> = {}
      cursos.forEach(c => {
        const m = horario[c]?.[d]?.[p]
        if (!m || m === 'RECESO' || m === 'ACOMPAÑAMIENTO' || m === 'SALIDA') return
        const doc = getDocForMateria(m, docentes, jornada, nivel, docentePorCurso, c)
        if (doc === '—') return
        if (!ocupado[doc]) ocupado[doc] = []
        ocupado[doc].push(c)
      })
      Object.entries(ocupado).forEach(([doc, cs]) => {
        if (cs.length > 1) {
          cs.forEach(c => {
            conflictos.push({ curso: c, dia: d, periodo: p, materia: horario[c][d][p], docente: doc })
          })
        }
      })
    }
  })

  return conflictos
}

/**
 * Detecta cruces docentes comparando por HORA REAL (label del período) en vez
 * de índice. Necesario cuando distintos cursos tienen estructuras de horario
 * distintas (via cursosCustom): dos cursos pueden chocar en hora real aunque
 * estén en índices de período distintos.
 *
 * Requiere `config` para resolver la estructura (horarios/recesos) de cada
 * curso via `getCursoStructure`.
 */
export function detectConflictosPorHora(
  horario: HorarioGrid,
  config: InstitucionConfig,
  docentes: Docente[],
  docentePorCurso?: Record<string, Record<string, string>>
): { curso: string; dia: Dia; periodo: number; materia: string; docente: string; horaLabel: string }[] {
  const conflictos: { curso: string; dia: Dia; periodo: number; materia: string; docente: string; horaLabel: string }[] = []
  const cursos = Object.keys(horario)

  // Agrupar slots ocupados por (dia, horaLabel) → { doc → [{curso, periodo, materia}] }
  const buckets: Record<string, Record<string, { curso: string; periodo: number; materia: string }[]>> = {}

  cursos.forEach(c => {
    const { nPeriodos: np, horarios: horas } = getCursoStructure(config, c)
    DIAS.forEach(d => {
      for (let p = 0; p < np; p++) {
        const m = horario[c]?.[d]?.[p]
        if (!m || m === 'RECESO' || m === 'ACOMPAÑAMIENTO' || m === 'SALIDA') continue
        const doc = getDocForMateria(m, docentes, config.jornada, config.nivel, docentePorCurso, c)
        if (doc === '—') continue
        const label = horas[p] ?? String(p)
        const bKey = `${d}|${label}`
        if (!buckets[bKey]) buckets[bKey] = {}
        if (!buckets[bKey][doc]) buckets[bKey][doc] = []
        buckets[bKey][doc].push({ curso: c, periodo: p, materia: m })
      }
    })
  })

  Object.entries(buckets).forEach(([bKey, perDoc]) => {
    const [dia, label] = bKey.split('|') as [Dia, string]
    Object.entries(perDoc).forEach(([doc, entries]) => {
      if (entries.length > 1) {
        entries.forEach(e => {
          conflictos.push({
            curso: e.curso,
            dia,
            periodo: e.periodo,
            materia: e.materia,
            docente: doc,
            horaLabel: label,
          })
        })
      }
    })
  })

  return conflictos
}
