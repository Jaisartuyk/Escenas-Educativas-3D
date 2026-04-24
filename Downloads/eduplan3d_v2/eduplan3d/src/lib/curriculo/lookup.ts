// src/lib/curriculo/lookup.ts
// Búsqueda de destrezas/indicadores del Currículo Priorizado MinEduc
// para inyectar al prompt del planificador.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CurriculoRow {
  destreza_codigo: string | null
  destreza_descripcion: string
  indicador_codigo: string | null
  indicador_descripcion: string | null
  contenidos: string | null
  unidad: string | null
  bloque_curricular: string | null
}

/**
 * Normaliza un grado en el formato usado en la DB.
 * Acepta variantes como "4to EGB", "cuarto", "4", "4to_egb" → "4to_egb".
 */
export function normalizeGrado(input?: string | null): string | null {
  if (!input) return null
  const s = input.toLowerCase().trim()
  const palabras: Record<string, string> = {
    primero: '1ro', segundo: '2do', tercero: '3ro', cuarto: '4to',
    quinto: '5to', sexto: '6to', septimo: '7mo', 'séptimo': '7mo',
    octavo: '8vo', noveno: '9no', decimo: '10mo', 'décimo': '10mo',
  }
  let out = s
  for (const [k, v] of Object.entries(palabras)) out = out.replace(k, v)
  // "4to egb" o "4 egb" → "4to_egb"
  out = out.replace(/\s+/g, '_')
  out = out.replace(/^(\d+)(ro|do|to|mo|no|vo)?_?/, (_m, n, suf) => {
    const sufijos: Record<string, string> = {
      '1': 'ro', '2': 'do', '3': 'ro', '4': 'to', '5': 'to',
      '6': 'to', '7': 'mo', '8': 'vo', '9': 'no', '10': 'mo',
    }
    return `${n}${suf || sufijos[n] || 'to'}_`
  })
  if (!/_egb$|_bgu$|preparatoria/.test(out)) {
    // Por defecto asumimos EGB si no viene especificado
    if (/^\d+(ro|do|to|mo|no|vo)_$/.test(out)) out = out + 'egb'
  }
  return out.replace(/_$/, '')
}

export function normalizeAsignatura(input?: string | null): string | null {
  if (!input) return null
  const s = input.toLowerCase().trim()
  if (/matem/.test(s)) return 'matematica'
  if (/lengua|literatura/.test(s)) return 'lengua_literatura'
  if (/ciencias\s+naturales|natural/.test(s)) return 'ciencias_naturales'
  // Nuestra ingesta usa 'estudios_sociales' (no 'ciencias_sociales')
  if (/ciencias\s+sociales|sociales|estudios\s+sociales/.test(s)) return 'estudios_sociales'
  if (/ingl[eé]s|english|efl/.test(s)) return 'ingles'
  if (/educaci[oó]n\s+f[ií]sica|ef\b/.test(s)) return 'educacion_fisica'
  // Nuestra ingesta usa 'educacion_cultural_artistica'
  if (/educaci[oó]n\s+cultural|arte|cultural|eca\b/.test(s)) return 'educacion_cultural_artistica'
  if (/qu[ií]mica/.test(s)) return 'quimica'
  if (/f[ií]sica/.test(s)) return 'fisica'
  if (/biolog[ií]a/.test(s)) return 'biologia'
  if (/historia/.test(s)) return 'historia'
  if (/filosof[ií]a/.test(s)) return 'filosofia'
  if (/ciudadan/.test(s)) return 'educacion_ciudadania'
  if (/emprend|gesti[oó]n/.test(s)) return 'emprendimiento_gestion'
  return s.replace(/\s+/g, '_')
}

/**
 * Mapea un grado específico al subnivel MinEduc correspondiente.
 * El currículo priorizado se almacena por subnivel (no por grado individual).
 */
export function gradoToSubnivel(grado?: string | null): string | null {
  if (!grado) return null
  const g = grado.toLowerCase()
  if (/inicial/.test(g)) return 'inicial'
  if (/preparatoria|^1ro_egb|^1_egb/.test(g)) return 'preparatoria'
  if (/^(2do|3ro|4to)_egb/.test(g)) return 'elemental'
  if (/^(5to|6to|7mo)_egb/.test(g)) return 'media'
  if (/^(8vo|9no|10mo)_egb/.test(g)) return 'superior'
  if (/bgu|bachillerato/.test(g)) return 'bgu'
  return null
}

/**
 * Busca destrezas e indicadores en el currículo priorizado para un grado+asignatura.
 * Si viene `tema` hace búsqueda full-text adicional.
 * Devuelve un bloque de texto listo para inyectar al prompt (vacío si no hay datos).
 */
export async function fetchCurriculoBlock(
  supabase: SupabaseClient,
  opts: { grado?: string | null; asignatura?: string | null; tema?: string | null; limit?: number }
): Promise<string> {
  const grado = normalizeGrado(opts.grado)
  const subnivel = gradoToSubnivel(grado)
  const asignatura = normalizeAsignatura(opts.asignatura)
  if (!subnivel && !asignatura) return ''

  const limit = opts.limit ?? 25

  let query = (supabase as any)
    .from('curriculo_priorizado')
    .select('destreza_codigo, destreza_descripcion, indicador_codigo, indicador_descripcion, contenidos, unidad, bloque_curricular, subnivel, grado')
    .limit(limit)

  // El currículo priorizado 2025 agrupa por subnivel, no por grado individual
  if (subnivel) query = query.eq('subnivel', subnivel)
  if (asignatura) query = query.eq('asignatura', asignatura)

  if (opts.tema && opts.tema.trim()) {
    // Búsqueda full-text en español (ts_vector está precomputado en el índice)
    const tema = opts.tema.trim().split(/\s+/).slice(0, 6).join(' & ')
    query = query.textSearch(
      'destreza_descripcion',
      tema,
      { config: 'spanish', type: 'websearch' }
    )
  }

  const { data, error } = await query
  if (error || !data || data.length === 0) return ''

  const rows = data as CurriculoRow[]
  const lines: string[] = [
    '=== CURRÍCULO PRIORIZADO MinEduc 2025 (FUENTE OFICIAL — OBLIGATORIA) ===',
    `Subnivel: ${subnivel ?? '—'}  ·  Grado consultado: ${grado ?? '—'}  ·  Asignatura: ${asignatura ?? '—'}`,
    `Total destrezas disponibles para este filtro: ${rows.length}`,
    '',
    'REGLA CRÍTICA: DEBES elegir la destreza para la planificación ÚNICAMENTE',
    'de la lista siguiente. Está PROHIBIDO inventar códigos (ej. CS.2.1.1 con descripción',
    'que no coincida) o usar códigos memorizados de tu entrenamiento. Si ninguna destreza',
    'de la lista encaja con el tema, elige la MÁS CERCANA y explícalo; NO fabriques una nueva.',
    'Copia el código y la descripción TEXTUALMENTE como aparecen abajo.',
    '',
  ]
  rows.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.destreza_codigo ?? '(sin código)'} — ${r.destreza_descripcion}`)
    if (r.indicador_codigo || r.indicador_descripcion) {
      lines.push(`   Indicador ${r.indicador_codigo ?? ''}: ${r.indicador_descripcion ?? ''}`)
    }
    if (r.contenidos) lines.push(`   Contenidos: ${r.contenidos}`)
  })
  lines.push('=== FIN CURRÍCULO ===\n')
  return lines.join('\n')
}
