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

export function generarHorario(
  config: InstitucionConfig,
  docentes: Docente[],
  horasPorCurso: HorasPorCurso,
  docentePorCurso?: Record<string, Record<string, string>>
): HorarioGrid {
  const { cursos } = config
  const horario: HorarioGrid = {}

  // Inicializar grid vacío (longitud por-curso: respeta override si existe)
  cursos.forEach(c => {
    const { nPeriodos: np } = getCursoStructure(config, c)
    horario[c] = {} as Record<Dia, string[]>
    DIAS.forEach(d => { horario[c][d] = Array(np).fill('') })
  })

  // Marcar receso y acompañamiento (recesos también por-curso)
  cursos.forEach(c => {
    const { nPeriodos: np, recesos } = getCursoStructure(config, c)
    DIAS.forEach(d => {
      recesos.forEach(r => {
        if (r < np) horario[c][d][r] = 'RECESO'
      })
    })
    horario[c]['Lunes'][0] = 'ACOMPAÑAMIENTO'
  })

  // Ocupación docente comparada por HORA REAL (start time) en vez de índice.
  // Clave: `${dia}|${horaLabel}` → Set<docente>. Así un docente que da en dos
  // cursos con estructuras distintas aún se detecta como ocupado correctamente.
  const docOcupado: Record<string, Set<string>> = {}
  const keyOf = (d: Dia, horaLabel: string) => `${d}|${horaLabel}`

  cursos.forEach(c => {
    const hm = horasPorCurso[c] ?? {}
    const { nPeriodos: np, horarios: horasLabels, recesos } = getCursoStructure(config, c)
    const validPeriods = Array.from({ length: np }, (_, i) => i).filter(i => !recesos.includes(i))
    // Ordenar materias: más horas primero para mejorar distribución
    const pool = Object.entries(hm)
      .filter(([, h]) => h > 0)
      .sort(([, a], [, b]) => b - a)

    pool.forEach(([materia, horas]) => {
      const doc = getDocForMateria(materia, docentes, config.jornada, config.nivel, docentePorCurso, c)
      console.log(`Generando para ${c} -> ${materia} (${horas}h) Docente: ${doc}`)
      let colocadas = 0
      let intentos = 0

      // Helper: está el docente ocupado a esta hora real?
      const isDocBusy = (d: Dia, p: number): boolean => {
        if (doc === '—') return false
        const label = horasLabels[p] ?? String(p)
        const set = docOcupado[keyOf(d, label)]
        return !!set && set.has(doc)
      }
      const markDocBusy = (d: Dia, p: number) => {
        if (doc === '—') return
        const label = horasLabels[p] ?? String(p)
        const k = keyOf(d, label)
        if (!docOcupado[k]) docOcupado[k] = new Set()
        docOcupado[k].add(doc)
      }

      // Construir lista de slots disponibles
      const available: { d: Dia; p: number }[] = []
      DIAS.forEach(d => {
        validPeriods.forEach(p => {
          // El slot 0 del Lunes está de acompañamiento
          if (d === 'Lunes' && p === 0) return
          if (!horario[c][d][p] && !isDocBusy(d, p)) {
            available.push({ d, p })
          }
        })
      })

      // Orden determinista: empacar clases en los primeros periodos del dia,
      // repartidas entre los dias (periodo asc, dia asc). Esto deja los huecos
      // naturalmente al final del dia para marcarlos como SALIDA despues.
      const shuffled = [...available].sort((a, b) => {
        if (a.p !== b.p) return a.p - b.p
        return DIAS.indexOf(a.d) - DIAS.indexOf(b.d)
      })

      // Distribuir evitando más de 2 horas seguidas de la misma materia por día
      const usoPorDia: Record<string, number> = {}
      DIAS.forEach(d => { usoPorDia[d] = 0 })

      for (const { d, p } of shuffled) {
        if (colocadas >= horas || intentos > 200) break
        intentos++
        if (!horario[c][d][p] && !isDocBusy(d, p) && usoPorDia[d] < 2) {
          horario[c][d][p] = materia
          markDocBusy(d, p)
          usoPorDia[d]++
          colocadas++
        }
      }

      // Segunda pasada sin restricción de días si faltan horas
      if (colocadas < horas) {
        for (const { d, p } of shuffled) {
          if (colocadas >= horas) break
          if (!horario[c][d][p] && !isDocBusy(d, p)) {
            horario[c][d][p] = materia
            markDocBusy(d, p)
            colocadas++
          }
        }
      }
    })
  })

  // Pasada final: marcar huecos al final del dia como 'SALIDA'.
  // Regla: por cada curso y dia, encontrar el ultimo periodo con clase real
  // (no vacio y no RECESO). Todo lo que venga despues (vacio o RECESO trailing)
  // se marca SALIDA. Asi los niños no vuelven despues de haberse ido.
  cursos.forEach(c => {
    const { nPeriodos: np } = getCursoStructure(config, c)
    DIAS.forEach(d => {
      const row = horario[c][d]
      // Buscar el indice del ultimo periodo con contenido real de clase/actividad
      let lastClass = -1
      for (let p = np - 1; p >= 0; p--) {
        const v = row[p]
        if (v && v !== 'RECESO' && v !== '') {
          lastClass = p
          break
        }
      }
      // Todo despues de lastClass se marca SALIDA (sobreescribe RECESOs finales)
      for (let p = lastClass + 1; p < np; p++) {
        row[p] = 'SALIDA'
      }
    })
  })

  return horario
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
