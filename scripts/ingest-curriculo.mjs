// scripts/ingest-curriculo.mjs
// Ingesta del Currículo Priorizado MinEduc a la tabla public.curriculo_priorizado.
//
// Uso:
//   node scripts/ingest-curriculo.mjs <ruta-pdf> --grado=4to_egb --asignatura=matematica --subnivel=elemental
//
// Flujo:
//   1) Extrae texto del PDF con pdf-parse.
//   2) Detecta destrezas (códigos tipo M.2.1.1) e indicadores (I.M.2.1.1.).
//   3) Inserta filas en curriculo_priorizado via service role.
//
// Nota: la heurística de parseo es conservadora. Revisa la consola antes de
// ejecutar con --commit. Sin --commit solo hace dry-run.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

function parseArgs() {
  const args = process.argv.slice(2)
  const pdfPath = args.find(a => !a.startsWith('--'))
  const flags = Object.fromEntries(
    args.filter(a => a.startsWith('--')).map(a => {
      const [k, v = 'true'] = a.replace(/^--/, '').split('=')
      return [k, v]
    })
  )
  return { pdfPath, flags }
}

// Heurística de extracción: busca códigos de destrezas MinEduc
// Ejemplos: M.2.1.1., LL.3.2.4., CN.4.1.3., CS.5.2.1., EFL.B1.1.1.
const DESTREZA_CODE_RE = /\b([A-Z]{1,4})\.(\d)\.(\d+)\.(\d+)\.?/g
const INDICADOR_CODE_RE = /\bI\.([A-Z]{1,4})\.(\d)\.(\d+)\.(\d+)\.?/g

function extractDestrezas(text) {
  const rows = []
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^([A-Z]{1,4}\.\d\.\d+\.\d+\.?)\s+(.+)/)
    if (m) {
      // Intenta concatenar líneas de descripción siguientes hasta tope en blanco o nuevo código
      let desc = m[2]
      let j = i + 1
      while (j < lines.length && !/^[A-Z]{1,4}\.\d\.\d+\.\d+/.test(lines[j]) && desc.length < 600) {
        desc += ' ' + lines[j]
        j++
      }
      rows.push({
        destreza_codigo: m[1].replace(/\.$/, ''),
        destreza_descripcion: desc.trim(),
      })
    }
  }
  return rows
}

async function main() {
  const { pdfPath, flags } = parseArgs()
  if (!pdfPath) {
    console.error('Uso: node scripts/ingest-curriculo.mjs <pdf> --grado=4to_egb --asignatura=matematica --subnivel=elemental [--unidad=...] [--commit]')
    process.exit(1)
  }
  const { grado, asignatura, subnivel, unidad = null, commit } = flags
  if (!grado || !asignatura || !subnivel) {
    console.error('Faltan flags obligatorias: --grado, --asignatura, --subnivel')
    process.exit(1)
  }

  const env = loadEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log(`\n[ingest] Leyendo ${pdfPath} …`)
  const buffer = readFileSync(pdfPath)
  const pdf = await pdfParse(buffer)
  console.log(`[ingest] Páginas: ${pdf.numpages}, caracteres: ${pdf.text.length}`)

  const destrezas = extractDestrezas(pdf.text)
  console.log(`[ingest] Destrezas detectadas: ${destrezas.length}`)
  if (destrezas.length === 0) {
    console.log('[ingest] Nada que insertar. Muestro primeros 500 chars del PDF para diagnóstico:')
    console.log(pdf.text.slice(0, 500))
    return
  }

  console.log('\n[ingest] Primeras 5 filas:')
  destrezas.slice(0, 5).forEach(r => console.log(`  ${r.destreza_codigo} → ${r.destreza_descripcion.slice(0, 100)}…`))

  if (!commit) {
    console.log('\n[ingest] DRY RUN — usa --commit para insertar en Supabase.')
    return
  }

  const rows = destrezas.map(d => ({
    subnivel,
    grado,
    asignatura,
    unidad,
    destreza_codigo: d.destreza_codigo,
    destreza_descripcion: d.destreza_descripcion,
    fuente: pdfPath,
  }))

  const { error, count } = await supabase
    .from('curriculo_priorizado')
    .insert(rows, { count: 'exact' })

  if (error) {
    console.error('[ingest] Error al insertar:', error.message)
    process.exit(1)
  }
  console.log(`[ingest] ✓ Insertadas ${count ?? rows.length} filas.`)
}

main().catch(e => { console.error(e); process.exit(1) })
