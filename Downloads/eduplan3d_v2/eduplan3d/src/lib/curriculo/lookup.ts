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
  if (/ciencias\s+sociales|sociales|estudios\s+sociales/.test(s)) return 'ciencias_sociales'
  if (/ingl[eé]s|english|efl/.test(s)) return 'ingles'
  if (/educaci[oó]n\s+f[ií]sica|ef\b/.test(s)) return 'educacion_fisica'
  if (/educaci[oó]n\s+cultural|arte|cultural/.test(s)) return 'educacion_cultural'
  if (/qu[ií]mica/.test(s)) return 'quimica'
  if (/f[ií]sica/.test(s)) return 'fisica'
  if (/biolog[ií]a/.test(s)) return 'biologia'
  if (/historia/.test(s)) return 'historia'
  if (/filosof[ií]a/.test(s)) return 'filosofia'
  return s.replace(/\s+/g, '_')
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
  const asignatura = normalizeAsignatura(opts.asignatura)
  if (!grado && !asignatura) return ''

  const limit = opts.limit ?? 15

  let query = (supabase as any)
    .from('curriculo_priorizado')
    .select('destreza_codigo, destreza_descripcion, indicador_codigo, indicador_descripcion, contenidos, unidad, bloque_curricular')
    .limit(limit)

  if (grado)      query = query.eq('grado', grado)
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
    '=== CURRÍCULO PRIORIZADO MinEduc (referencia oficial) ===',
    `Grado: ${grado ?? '—'}  ·  Asignatura: ${asignatura ?? '—'}`,
    '',
    'Usa EXCLUSIVAMENTE estos códigos y descripciones de destrezas/indicadores',
    'cuando aplique al tema. NO inventes códigos nuevos.',
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
