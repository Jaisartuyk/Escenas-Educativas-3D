// src/lib/horarios/generator.ts
import type { HorarioGrid, HorasPorCurso, Docente, InstitucionConfig, Dia } from '@/types/horarios'
import { DIAS } from '@/types/horarios'

export function getDocForMateria(
  materia: string,
  docentes: Docente[],
  jornada: string = '',
  nivel?: string,
  docentePorCurso?: Record<string, Record<string, string>>,
  curso?: string
): string {
  // Use exact DB match if available
  if (docentePorCurso && curso && docentePorCurso[curso] && docentePorCurso[curso][materia]) {
    return docentePorCurso[curso][materia]
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
  const { cursos, nPeriodos } = config
  const horario: HorarioGrid = {}

  // Inicializar grid vacío
  cursos.forEach(c => {
    horario[c] = {} as Record<Dia, string[]>
    DIAS.forEach(d => { horario[c][d] = Array(nPeriodos).fill('') })
  })

  // Marcar receso y acompañamiento
  const recesos = config.recesos || [4]; // Fallback to 4 for old configs
  cursos.forEach(c => {
    DIAS.forEach(d => { 
      recesos.forEach(r => {
        if (r < nPeriodos) horario[c][d][r] = 'RECESO' 
      })
    })
    horario[c]['Lunes'][0] = 'ACOMPAÑAMIENTO'
  })

  // Rastrear ocupación docente: [dia][periodo] → Set<docente>
  const docOcupado: Record<string, Record<number, Set<string>>> = {}
  DIAS.forEach(d => {
    docOcupado[d] = {}
    for (let p = 0; p < nPeriodos; p++) docOcupado[d][p] = new Set()
  })

  // Generamos todos los slots validos que no son recesos
  const validPeriods = Array.from({ length: nPeriodos }, (_, i) => i).filter(i => !recesos.includes(i))
  cursos.forEach(c => {
    const hm = horasPorCurso[c] ?? {}
    // Ordenar materias: más horas primero para mejorar distribución
    const pool = Object.entries(hm)
      .filter(([, h]) => h > 0)
      .sort(([, a], [, b]) => b - a)

    pool.forEach(([materia, horas]) => {
      const doc = getDocForMateria(materia, docentes, config.jornada, config.nivel, docentePorCurso, c)
      console.log(`Generando para ${c} -> ${materia} (${horas}h) Docente: ${doc}`)
      let colocadas = 0
      let intentos = 0

      // Construir lista de slots disponibles y mezclar
      const available: { d: Dia; p: number }[] = []
      DIAS.forEach(d => {
        validPeriods.forEach(p => {
          // El slot 0 del Lunes está de acompañamiento
          if (d === 'Lunes' && p === 0) return
          if (!horario[c][d][p] && (doc === '—' || !docOcupado[d][p].has(doc))) {
            available.push({ d, p })
          }
        })
      })

      // Fisher-Yates shuffle determinista con seed por materia
      const shuffled = [...available]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor((materia.charCodeAt(0) * 31 + i * 17) % (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      // Distribuir evitando más de 2 horas seguidas de la misma materia por día
      const usoPorDia: Record<string, number> = {}
      DIAS.forEach(d => { usoPorDia[d] = 0 })

      for (const { d, p } of shuffled) {
        if (colocadas >= horas || intentos > 200) break
        intentos++
        if (!horario[c][d][p] && (doc === '—' || !docOcupado[d][p].has(doc)) && usoPorDia[d] < 2) {
          horario[c][d][p] = materia
          if (doc !== '—') docOcupado[d][p].add(doc)
          usoPorDia[d]++
          colocadas++
        }
      }

      // Segunda pasada sin restricción de días si faltan horas
      if (colocadas < horas) {
        for (const { d, p } of shuffled) {
          if (colocadas >= horas) break
          if (!horario[c][d][p] && (doc === '—' || !docOcupado[d][p].has(doc))) {
            horario[c][d][p] = materia
            if (doc !== '—') docOcupado[d][p].add(doc)
            colocadas++
          }
        }
      }
    })
  })

  return horario
}

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
        if (!m || m === 'RECESO' || m === 'ACOMPAÑAMIENTO') return
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
