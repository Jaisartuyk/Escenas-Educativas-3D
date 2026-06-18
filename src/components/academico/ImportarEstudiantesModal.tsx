'use client'
// src/components/academico/ImportarEstudiantesModal.tsx
// Importación masiva de estudiantes desde Excel

import { useState, useRef } from 'react'
import { X, Download, Upload, CheckCircle2, AlertTriangle, XCircle, Loader2, FileSpreadsheet, Users } from 'lucide-react'
import { createInstitutionUser } from '@/lib/actions/users'
import toast from 'react-hot-toast'

interface Course { id: string; name: string; parallel?: string }

interface Props {
  institutionId: string
  courses: Course[]
  onClose: () => void
  onDone: () => void
}

interface RowData {
  idx: number
  nombre: string
  cedula: string
  correo: string
  password: string
  curso: string
  // resolved
  courseId: string | null
  status: 'valid' | 'warning' | 'error'
  issues: string[]
}

// ── Download template ──────────────────────────────────────────────────────────
async function downloadTemplate(courses: Course[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Estudiantes')

  // Column definitions
  ws.columns = [
    { header: 'Nombre Completo *', key: 'nombre',   width: 28 },
    { header: 'Cédula *',          key: 'cedula',   width: 16 },
    { header: 'Correo',            key: 'correo',   width: 28 },
    { header: 'Contraseña',        key: 'password', width: 18 },
    { header: 'Curso',             key: 'curso',    width: 16 },
  ]

  // Header style
  const headerRow = ws.getRow(1)
  headerRow.eachCell(cell => {
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C6DFA' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF5B4FD4' } },
    }
  })
  headerRow.height = 24

  // Example rows
  const examples = [
    { nombre: 'Ana María Torres', cedula: '0912345678', correo: 'ana@gmail.com', password: '0912345678', curso: courses[0] ? `${courses[0].name} ${courses[0].parallel || ''}`.trim() : '8vo A' },
    { nombre: 'Luis Fernando Mora', cedula: '0987654321', correo: '', password: '', curso: courses[1] ? `${courses[1].name} ${courses[1].parallel || ''}`.trim() : '9no B' },
  ]
  examples.forEach((ex, i) => {
    const row = ws.addRow(ex)
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF9F8FF' : 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle' }
    })
    row.height = 20
  })

  // Notes sheet
  const notesWs = wb.addWorksheet('Instrucciones')
  notesWs.getColumn(1).width = 70
  const notes = [
    ['📋 INSTRUCCIONES DE IMPORTACIÓN'],
    [''],
    ['Campos OBLIGATORIOS (marcados con *):'],
    ['  • Nombre Completo: Apellidos y nombres completos del estudiante'],
    ['  • Cédula: Número de cédula sin espacios ni guiones'],
    [''],
    ['Campos OPCIONALES:'],
    ['  • Correo: Si se deja vacío se genera uno automático con la cédula'],
    ['  • Contraseña: Si se deja vacío se usa la cédula como contraseña inicial'],
    ['  • Curso: Debe coincidir exactamente con uno de los cursos del sistema'],
    [''],
    ['Cursos disponibles en el sistema:'],
    ...courses.map(c => [`  • ${c.name} ${c.parallel || ''}`.trim()]),
    [''],
    ['ℹ️  No elimines ni renombres las columnas de la hoja "Estudiantes"'],
    ['ℹ️  Puedes agregar tantas filas como necesites debajo de los ejemplos'],
    ['ℹ️  Borra las filas de ejemplo antes de importar'],
  ]
  notes.forEach((row, i) => {
    const r = notesWs.addRow(row)
    if (i === 0) r.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF7C6DFA' } }
  })

  // Export
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_importar_estudiantes.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Parse uploaded Excel ───────────────────────────────────────────────────────
async function parseExcel(file: File, courses: Course[]): Promise<RowData[]> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const buf = await file.arrayBuffer()
  await wb.xlsx.load(buf)

  const ws = wb.worksheets[0]
  const rows: RowData[] = []

  // Build course lookup (case-insensitive, trimmed)
  const courseMap: Record<string, string> = {}
  courses.forEach(c => {
    const key = `${c.name} ${c.parallel || ''}`.trim().toLowerCase()
    courseMap[key] = c.id
    courseMap[c.name.toLowerCase()] = c.id
  })

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return // skip header

    const getCellValue = (col: number): string => {
      const cell = row.getCell(col)
      const v = cell.value
      if (v === null || v === undefined) return ''
      if (typeof v === 'object' && 'text' in v) return String((v as any).text).trim()
      return String(v).trim()
    }

    const nombre   = getCellValue(1)
    const cedula   = getCellValue(2)
    const correo   = getCellValue(3)
    const password = getCellValue(4)
    const curso    = getCellValue(5)

    // Skip blank rows
    if (!nombre && !cedula) return

    const issues: string[] = []
    let status: RowData['status'] = 'valid'

    if (!nombre) { issues.push('Nombre requerido'); status = 'error' }
    if (!cedula) { issues.push('Cédula requerida'); status = 'error' }
    if (correo && !correo.includes('@')) { issues.push('Correo inválido'); status = 'error' }

    if (status !== 'error') {
      if (!correo)   { issues.push('Sin correo → se usará cédula@classnova.local'); if (status === 'valid') status = 'warning' }
      if (!password) { issues.push('Sin contraseña → se usará la cédula'); if (status === 'valid') status = 'warning' }
    }

    const courseId = curso ? (courseMap[curso.toLowerCase()] || null) : null
    if (curso && !courseId) { issues.push(`Curso "${curso}" no encontrado`); if (status === 'valid') status = 'warning' }
    if (!curso)             { issues.push('Sin curso asignado'); if (status === 'valid') status = 'warning' }

    rows.push({ idx: rowNum - 1, nombre, cedula, correo, password, curso, courseId, status, issues })
  })

  return rows
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ImportarEstudiantesModal({ institutionId, courses, onClose, onDone }: Props) {
  const [step, setStep]       = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows]       = useState<RowData[]>([])
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{ ok: number; failed: { nombre: string; error: string }[] }>({ ok: 0, failed: [] })
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const validRows   = rows.filter(r => r.status !== 'error')
  const errorRows   = rows.filter(r => r.status === 'error')
  const warningRows = rows.filter(r => r.status === 'warning')

  async function handleFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) return toast.error('Solo se aceptan archivos .xlsx o .xls')
    setParsing(true)
    try {
      const parsed = await parseExcel(file, courses)
      if (parsed.length === 0) return toast.error('El archivo no tiene filas de datos')
      setRows(parsed)
      setStep('preview')
    } catch (err: any) {
      toast.error('Error al leer el archivo: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    setStep('importing')
    setProgress(0)
    const toImport = validRows
    let ok = 0
    const failed: { nombre: string; error: string }[] = []

    // Process in batches of 4
    const BATCH = 4
    for (let i = 0; i < toImport.length; i += BATCH) {
      const batch = toImport.slice(i, i + BATCH)
      await Promise.all(batch.map(async row => {
        const email    = row.correo  || `${row.cedula}@classnova.local`
        const password = row.password || row.cedula
        const res = await createInstitutionUser({
          full_name:      row.nombre,
          dni:            row.cedula,
          email,
          password,
          role:           'student',
          institution_id: institutionId,
          ...(row.courseId ? { course_id: row.courseId } : {}),
        })
        if (res.error) failed.push({ nombre: row.nombre, error: res.error })
        else ok++
      }))
      setProgress(Math.round(((i + BATCH) / toImport.length) * 100))
    }

    setProgress(100)
    setResults({ ok, failed })
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-[rgba(0,0,0,0.08)] max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-teal" />
            </div>
            <div>
              <h2 className="font-bold text-base">Importar Estudiantes desde Excel</h2>
              <p className="text-[11px] text-ink4">
                {step === 'upload'    && 'Sube tu archivo con la lista de estudiantes'}
                {step === 'preview'   && `${rows.length} filas detectadas · ${validRows.length} válidas · ${errorRows.length} con error`}
                {step === 'importing' && 'Creando cuentas...'}
                {step === 'done'      && `Importación completa: ${results.ok} creados`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg transition-colors text-ink3">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Step 1: Download template */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-violet2/5 border border-violet2/15">
                <div className="w-8 h-8 rounded-full bg-violet2 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">Descarga la plantilla oficial</p>
                  <p className="text-xs text-ink3 mb-3">Incluye instrucciones y los cursos disponibles en tu institución.</p>
                  <button
                    onClick={() => downloadTemplate(courses)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet2 text-white text-xs font-bold hover:bg-violet transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar plantilla .xlsx
                  </button>
                </div>
              </div>

              {/* Step 2: Fill and upload */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-teal/5 border border-teal/15">
                <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">Llénala y súbela aquí</p>
                  <p className="text-xs text-ink3 mb-3">Completa los datos de tus estudiantes y arrastra el archivo.</p>

                  {/* Drop zone */}
                  <div
                    className={`rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                      dragOver ? 'border-teal bg-teal/5' : 'border-[rgba(0,0,0,0.12)] hover:border-teal/50'
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <div className="p-8 text-center">
                      {parsing ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-teal animate-spin" />
                          <p className="text-sm text-ink3">Leyendo archivo...</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto mb-2 text-ink3 opacity-40" />
                          <p className="text-sm font-semibold text-ink2">Arrastra tu Excel aquí</p>
                          <p className="text-xs text-ink4 mt-1">o haz clic para seleccionar · .xlsx / .xls</p>
                        </>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {validRows.filter(r => r.status === 'valid').length} sin problemas
                </span>
                {warningRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {warningRows.length} con advertencias (se importarán igual)
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                    <XCircle className="w-3.5 h-3.5" />
                    {errorRows.length} con error (se omitirán)
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-[rgba(0,0,0,0.07)]">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-bg border-b border-[rgba(0,0,0,0.06)]">
                      <th className="text-left px-3 py-2.5 font-bold text-ink3 uppercase tracking-wider">#</th>
                      <th className="text-left px-3 py-2.5 font-bold text-ink3 uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-3 py-2.5 font-bold text-ink3 uppercase tracking-wider">Cédula</th>
                      <th className="text-left px-3 py-2.5 font-bold text-ink3 uppercase tracking-wider">Correo</th>
                      <th className="text-left px-3 py-2.5 font-bold text-ink3 uppercase tracking-wider">Curso</th>
                      <th className="text-left px-3 py-2.5 font-bold text-ink3 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.idx} className={`border-b border-[rgba(0,0,0,0.04)] ${
                        row.status === 'error'   ? 'bg-rose-50'
                        : row.status === 'warning' ? 'bg-amber-50/50'
                        : 'hover:bg-bg/60'
                      }`}>
                        <td className="px-3 py-2.5 text-ink4 font-mono">{row.idx}</td>
                        <td className="px-3 py-2.5 font-medium text-ink">{row.nombre || <span className="text-rose-400 italic">vacío</span>}</td>
                        <td className="px-3 py-2.5 font-mono text-ink2">{row.cedula || <span className="text-rose-400 italic">vacío</span>}</td>
                        <td className="px-3 py-2.5 text-ink3">{row.correo || <span className="text-ink4 italic">{row.cedula}@classnova.local</span>}</td>
                        <td className="px-3 py-2.5">
                          {row.courseId
                            ? <span className="px-1.5 py-0.5 rounded bg-teal/10 text-teal font-semibold">{row.curso}</span>
                            : row.curso
                              ? <span className="text-amber-600">⚠ {row.curso}</span>
                              : <span className="text-ink4 italic">Sin asignar</span>
                          }
                        </td>
                        <td className="px-3 py-2.5">
                          {row.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {row.status === 'warning' && (
                            <div className="group relative inline-block">
                              <AlertTriangle className="w-4 h-4 text-amber-500 cursor-help" />
                              <div className="absolute left-0 bottom-full mb-1 w-48 bg-ink text-white text-[10px] rounded-lg p-2 hidden group-hover:block z-10 leading-relaxed">
                                {row.issues.join(' · ')}
                              </div>
                            </div>
                          )}
                          {row.status === 'error' && (
                            <div className="group relative inline-block">
                              <XCircle className="w-4 h-4 text-rose-500 cursor-help" />
                              <div className="absolute left-0 bottom-full mb-1 w-48 bg-ink text-white text-[10px] rounded-lg p-2 hidden group-hover:block z-10 leading-relaxed">
                                {row.issues.join(' · ')}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validRows.length === 0 && (
                <div className="text-center py-6 text-rose-500">
                  <XCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-semibold text-sm">No hay filas válidas para importar</p>
                  <p className="text-xs text-ink3 mt-1">Corrige los errores en el Excel y vuelve a subir</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="w-16 h-16 rounded-full bg-violet2/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet2 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg mb-1">Creando cuentas...</p>
                <p className="text-sm text-ink3">Por favor espera, no cierres esta ventana</p>
              </div>
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-xs text-ink3 mb-2">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet2 to-teal rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="space-y-5">
              {/* Success banner */}
              <div className="flex items-center gap-4 p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-emerald-700 text-lg">{results.ok} estudiante{results.ok !== 1 ? 's' : ''} creado{results.ok !== 1 ? 's' : ''} exitosamente</p>
                  <p className="text-sm text-emerald-600">Las cuentas ya están activas y los alumnos pueden ingresar al sistema.</p>
                </div>
              </div>

              {/* Failed rows */}
              {results.failed.length > 0 && (
                <div className="rounded-xl border border-rose-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border-b border-rose-100">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <p className="text-sm font-bold text-rose-700">{results.failed.length} no pudieron crearse</p>
                  </div>
                  <div className="divide-y divide-rose-50">
                    {results.failed.map((f, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 px-4 py-3 bg-white">
                        <p className="text-sm font-medium text-ink">{f.nombre}</p>
                        <p className="text-xs text-rose-500 text-right flex-shrink-0">{f.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer buttons ── */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-[rgba(0,0,0,0.06)] bg-bg/50 flex-shrink-0">
          {step === 'upload' && (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink3 hover:text-ink hover:bg-bg transition-colors">Cancelar</button>
              <p className="text-xs text-ink4">Paso 1 de 2</p>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('upload'); setRows([]) }} className="px-4 py-2 rounded-lg text-sm text-ink3 hover:text-ink hover:bg-bg transition-colors">
                ← Cambiar archivo
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal/90 transition-colors disabled:opacity-40"
              >
                <Users className="w-4 h-4" />
                Crear {validRows.length} estudiante{validRows.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={() => { onDone(); onClose() }} className="ml-auto btn-primary px-6 py-2.5 text-sm">
              Listo ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
