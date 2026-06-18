// scripts/ingest-curriculo-2025.mjs
// Ingesta de los PDFs del Currículo Priorizado 2025 (MinEduc) a curriculo_priorizado.
//
// Uso:
//   node scripts/ingest-curriculo-2025.mjs                 # dry-run todo el folder
//   node scripts/ingest-curriculo-2025.mjs --commit        # insertar en Supabase
//   node scripts/ingest-curriculo-2025.mjs --file=Elemental.pdf --commit
//
// Convención de nombres (carpeta eduplan3d/curriculo-pdfs/):
//   Preparatoria.pdf, Elemental.pdf, EGB-Media.pdf, Superior.pdf, Bachillerato.pdf
//   priorizado-inicial.pdf, primera-infancia.pdf, alfabetizacion.pdf, adaptaciones-*.pdf

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')

const __dirname = dirname(fileURLToPath(import.meta.url))
const PDF_DIR = join(__dirname, '..', 'curriculo-pdfs')

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  const envText = readFileSync(envPath, 'utf-8')
  const env = {}
  envText.split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
  return env
}

// Mapeo de archivo → subnivel (campo de la tabla)
const FILE_TO_SUBNIVEL = {
  'preparatoria.pdf': 'preparatoria',
  'elemental.pdf': 'elemental',
  'egb-media.pdf': 'media',
  'superior.pdf': 'superior',
  'bachillerato.pdf': 'bgu',
  'priorizado-inicial.pdf': 'inicial',
  'primera-infancia.pdf': 'primera_infancia',
  'alfabetizacion.pdf': 'alfabetizacion',
  'adaptaciones-curriculares-egb-bs-bg.pdf': 'adaptaciones',
}

// Prefijo de código DCD → asignatura
const PREFIX_TO_ASIGNATURA = {
  M: 'matematica',
  LL: 'lengua_literatura',
  CN: 'ciencias_naturales',
  CS: 'estudios_sociales',
  EFL: 'ingles',
  EF: 'educacion_fisica',
  ECA: 'educacion_cultural_artistica',
  CAI: 'inserciones_curriculares',
  ICN: 'inserciones_curriculares',
  // BGU específicas (códigos 1-letra)
  H: 'historia',
  F: 'filosofia',
  B: 'biologia',
  Q: 'quimica',
  EC: 'educacion_ciudadania',
  EG: 'emprendimiento_gestion',
}

function parseArgs() {
  const flags = {}
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue
    const [k, v = 'true'] = a.replace(/^--/, '').split('=')
    flags[k] = v
  }
  return flags
}

// Normaliza texto extraído: une guiones de separación y saltos dentro de párrafo
function normalizeText(raw) {
  return raw
    .replace(/-\r?\n/g, '')        // guión de separación
    .replace(/\r/g, '')
}

// Regex que encuentra códigos EN CUALQUIER POSICIÓN del texto.
// Tolera punto o espacio como separador después del prefijo (ej. "EFL.3.1.2" o "EFL 3.1.2").
// Grupo 1: prefijo CE./I./undefined (tipo)
// Grupo 2: prefijo de asignatura (M, LL, EFL, H, F, etc.)
// Grupo 3-5: subnivel, bloque, número
const ANY_CODE_RE = /\b(CE\.|I\.)?([A-Z]{1,4})[.\s](\d)\.(\d+)\.(\d+)\.?/g

function extractDCDs(text, { subnivel, fuente }) {
  const normalized = normalizeText(text)
  const rows = []

  // Encontrar todas las coincidencias con sus offsets
  const hits = []
  for (const m of normalized.matchAll(ANY_CODE_RE)) {
    const kindPrefix = m[1]
    const prefix = m[2]
    const kind = kindPrefix === 'CE.' ? 'ce' : kindPrefix === 'I.' ? 'ind' : 'dcd'
    const codigo = `${prefix}.${m[3]}.${m[4]}.${m[5]}`
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      kind,
      prefix,
      codigo,
    })
  }

  // Deduplicar códigos DCD (cada DCD aparece varias veces: título + referencias en
  // indicadores). Nos quedamos con la PRIMERA aparición como DCD, que normalmente
  // es el título seguido de su descripción.
  const seen = new Set()
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]
    if (h.kind !== 'dcd') continue
    if (seen.has(h.codigo)) continue
    seen.add(h.codigo)

    // Descripción: desde fin de este hit hasta el inicio del próximo hit (cualquier tipo)
    const next = hits[i + 1]
    const descEnd = next ? next.start : Math.min(h.end + 1000, normalized.length)
    let desc = normalized.slice(h.end, descEnd)
      .replace(/\s+/g, ' ')
      .trim()
    // Limpia un punto inicial si el regex dejó el terminador fuera
    desc = desc.replace(/^\.\s*/, '').slice(0, 1500)

    if (desc.length < 20) continue // muy corto, probablemente basura

    const asignatura = PREFIX_TO_ASIGNATURA[h.prefix] || 'otra'
    rows.push({
      subnivel,
      grado: subnivel, // el PDF priorizado 2025 no desglosa por grado; usar subnivel como placeholder
      asignatura,
      unidad: null,
      destreza_codigo: h.codigo,
      destreza_descripcion: desc,
      fuente,
    })
  }

  return rows
}

async function processPdf(filePath, { commit, supabase }) {
  const baseLower = basename(filePath).toLowerCase()
  const subnivel = FILE_TO_SUBNIVEL[baseLower]
  if (!subnivel) {
    console.log(`  [skip] ${baseLower} → subnivel desconocido`)
    return { rows: 0 }
  }

  const buf = new Uint8Array(readFileSync(filePath))
  const parser = new PDFParse({ data: buf })
  const r = await parser.getText()
  const fullText = r.pages.map(p => p.text).join('\n')

  const rows = extractDCDs(fullText, { subnivel, fuente: baseLower })

  // Distribución por asignatura
  const byAsig = new Map()
  for (const r of rows) byAsig.set(r.asignatura, (byAsig.get(r.asignatura) || 0) + 1)
  console.log(`  ${baseLower}: ${rows.length} DCDs`)
  for (const [a, c] of [...byAsig.entries()].sort()) console.log(`    ${a}: ${c}`)

  if (rows.length === 0) return { rows: 0 }

  if (!commit) return { rows: rows.length }

  // Insertar en lotes
  const batchSize = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from('curriculo_priorizado').insert(batch)
    if (error) {
      console.error(`    [error] lote ${i}:`, error.message)
      return { rows: inserted, error: error.message }
    }
    inserted += batch.length
  }
  console.log(`    ✓ insertadas ${inserted} filas`)
  return { rows: inserted }
}

async function main() {
  const flags = parseArgs()
  const env = loadEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let files
  if (flags.file) {
    files = [flags.file]
  } else {
    files = readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))
  }

  console.log(`\n[ingest-2025] PDFs a procesar: ${files.length}`)
  console.log(`[ingest-2025] Modo: ${flags.commit ? 'COMMIT' : 'DRY-RUN'}\n`)

  if (flags.commit && flags.purge) {
    console.log('[ingest-2025] Purgando tabla curriculo_priorizado…')
    const { error } = await supabase.from('curriculo_priorizado').delete().gte('id', 0)
    if (error) {
      // Si no hay columna id numérica, intenta truncate por fuente
      console.log('  (fallback) borrando todo via .neq destreza_codigo')
      await supabase.from('curriculo_priorizado').delete().neq('destreza_codigo', '___nope___')
    }
  }

  let total = 0
  for (const f of files) {
    const p = join(PDF_DIR, f)
    try {
      const { rows } = await processPdf(p, { commit: !!flags.commit, supabase })
      total += rows
    } catch (e) {
      console.error(`  [error] ${f}:`, e.message)
    }
  }

  console.log(`\n[ingest-2025] Total: ${total} DCDs ${flags.commit ? 'insertadas' : '(dry-run)'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
