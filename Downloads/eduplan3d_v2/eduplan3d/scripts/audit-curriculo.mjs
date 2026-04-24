// scripts/audit-curriculo.mjs
// Audita la cobertura de curriculo_priorizado por grado × asignatura.
//
// Uso:
//   node scripts/audit-curriculo.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

async function main() {
  const env = loadEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log('\n[audit] Consultando curriculo_priorizado…')

  // Total
  const { count: total, error: e0 } = await supabase
    .from('curriculo_priorizado')
    .select('*', { count: 'exact', head: true })
  if (e0) { console.error('[audit] Error total:', e0.message); process.exit(1) }
  console.log(`[audit] Total filas: ${total}\n`)

  // Pivot via paginación manual (Supabase no tiene GROUP BY en PostgREST)
  const pageSize = 1000
  let from = 0
  const pivot = new Map() // key: `${subnivel}|${grado}|${asignatura}` → count
  const subniveles = new Set()
  const grados = new Set()
  const asignaturas = new Set()

  while (true) {
    const { data, error } = await supabase
      .from('curriculo_priorizado')
      .select('subnivel, grado, asignatura')
      .range(from, from + pageSize - 1)
    if (error) { console.error('[audit] Error page:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    for (const r of data) {
      const key = `${r.subnivel || '-'}|${r.grado || '-'}|${r.asignatura || '-'}`
      pivot.set(key, (pivot.get(key) || 0) + 1)
      subniveles.add(r.subnivel || '-')
      grados.add(r.grado || '-')
      asignaturas.add(r.asignatura || '-')
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  console.log('[audit] Subniveles:', [...subniveles].sort().join(', '))
  console.log('[audit] Grados   :', [...grados].sort().join(', '))
  console.log('[audit] Asignaturas:', [...asignaturas].sort().join(', '))

  console.log('\n[audit] Cobertura (subnivel | grado | asignatura → filas):')
  const rows = [...pivot.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [k, v] of rows) {
    console.log(`  ${k}  →  ${v}`)
  }

  // Matriz esperada vs faltantes
  const expectedSubniveles = ['inicial', 'preparatoria', 'elemental', 'media', 'superior', 'bgu']
  const expectedAsignaturas = ['matematica', 'lengua_literatura', 'ciencias_naturales', 'estudios_sociales', 'ingles', 'educacion_fisica', 'educacion_cultural_artistica']

  console.log('\n[audit] Huecos respecto a matriz esperada:')
  for (const s of expectedSubniveles) {
    for (const a of expectedAsignaturas) {
      const found = [...pivot.keys()].some(k => k.startsWith(`${s}|`) && k.endsWith(`|${a}`))
      if (!found) console.log(`  FALTA: subnivel=${s}, asignatura=${a}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
