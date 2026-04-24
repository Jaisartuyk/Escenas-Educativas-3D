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

  // ─── RNG seedeado simple (Mulberry32) para reinicios determinísticos ───
  function makeRng(seed: number) {
    let s = seed >>> 0
    return () => {
      s = (s + 0x6D2B79F5) >>> 0
      let t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // Snapshot global (persiste entre reinicios)
  let bestHorario: HorarioGrid | null = null
  let bestPlaced = -1
  const totalEntries = entries.length

  // Un intento completo de backtracking con un orden semilleado.
  // Devuelve placed count de este intento (por si quieres medir convergencia).
  function runAttempt(seed: number, iterBudget: number): void {
    const rng = makeRng(seed)
    // Orden MCV + desempate aleatorio seedeado (varía entre reinicios)
    const attemptEntries = entries.slice().sort((a, b) => {
      if (a.diasPermitidos.length !== b.diasPermitidos.length) {
        return a.diasPermitidos.length - b.diasPermitidos.length
      }
      const ak = `${a.curso}|${a.materia}`
      const bk = `${b.curso}|${b.materia}`
      if (ak !== bk) return ak.localeCompare(bk)
      return rng() - 0.5
    })

    // Estado de este intento
    const horario = initHorario()
    const docBusy: Record<string, Set<string>> = {}
    const usoPorDia: Record<string, number> = {}
    let placedCount = 0
    let iterations = 0

    function snapshot() {
      if (placedCount > bestPlaced) {
        bestPlaced = placedCount
        bestHorario = JSON.parse(JSON.stringify(horario))
      }
    }
    function canPlace(e: Entry, d: Dia, p: number): boolean {
      if (horario[e.curso][d][p]) return false
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

    function backtrack(idx: number): void {
      if (iterations++ > iterBudget) return
      snapshot()
      if (bestPlaced === totalEntries) return
      if (idx >= attemptEntries.length) return
      const maxPossible = placedCount + (attemptEntries.length - idx)
      if (maxPossible <= bestPlaced) return

      const e = attemptEntries[idx]
      const candidates: { d: Dia; p: number }[] = []
      for (const d of e.diasPermitidos) {
        for (const p of e.validPeriods) {
          if (canPlace(e, d, p)) candidates.push({ d, p })
        }
      }
      // Heurística: empaca en períodos tempranos (ordena por p asc), y para
      // los días usa un orden aleatorio seedeado para variar la búsqueda
      // entre reinicios (un día que bloqueaba antes se prueba después).
      const diasShuffled = DIAS.slice().sort(() => rng() - 0.5)
      candidates.sort((a, b) => {
        if (a.p !== b.p) return a.p - b.p
        return diasShuffled.indexOf(a.d) - diasShuffled.indexOf(b.d)
      })

      for (const { d, p } of candidates) {
        doPlace(e, d, p)
        backtrack(idx + 1)
        undoPlace(e, d, p)
        if (iterations > iterBudget) return
        if (bestPlaced === totalEntries) return
      }
      // Rama skip (best-effort partial)
      backtrack(idx + 1)
    }

    backtrack(0)
  }

  // ─── Ejecutar múltiples reinicios ───
  // Presupuesto por intento reducido para que quepan varios en total.
  const TOTAL_BUDGET = 600000
  const NUM_ATTEMPTS = 8
  const BUDGET_PER_ATTEMPT = Math.floor(TOTAL_BUDGET / NUM_ATTEMPTS)
  for (let s = 0; s < NUM_ATTEMPTS; s++) {
    runAttempt(s * 1337 + 42, BUDGET_PER_ATTEMPT)
    if (bestPlaced === totalEntries) break // óptimo encontrado
  }

  // Usa la mejor parcial si ningún intento completó
  const result = bestHorario ?? initHorario()

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

  if (bestPlaced < totalEntries) {
    console.warn(`[horarios] backtracking colocó ${bestPlaced}/${totalEntries} clases (${NUM_ATTEMPTS} reinicios, budget ${TOTAL_BUDGET})`)
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
