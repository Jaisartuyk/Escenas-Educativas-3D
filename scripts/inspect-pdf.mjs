// scripts/inspect-pdf.mjs — muestra primeros N chars + detecta patrones DCD
// Uso: node scripts/inspect-pdf.mjs curriculo-pdfs/Elemental.pdf [chars]

import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const path = process.argv[2]
const chars = parseInt(process.argv[3] || '3000', 10)
if (!path) { console.error('Uso: node scripts/inspect-pdf.mjs <pdf> [chars]'); process.exit(1) }

const buf = readFileSync(path)
const pdf = await pdfParse(buf)
console.log(`Páginas: ${pdf.numpages}, chars: ${pdf.text.length}`)

// Conteo de DCDs tipo X.Y.Z.W
const dcdRe = /\b([A-Z]{1,4})\.(\d)\.(\d+)\.(\d+)\.?/g
const matches = [...pdf.text.matchAll(dcdRe)]
console.log(`Coincidencias regex DCD: ${matches.length}`)
const prefixes = new Map()
for (const m of matches) prefixes.set(m[1], (prefixes.get(m[1]) || 0) + 1)
console.log('Prefijos únicos:', [...prefixes.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20))

console.log('\n=== Primeros ' + chars + ' chars ===')
console.log(pdf.text.slice(0, chars))
console.log('\n=== Chars 5000-8000 ===')
console.log(pdf.text.slice(5000, 8000))
