import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import type { HorarioGrid, InstitucionConfig, Docente, HorasPorCurso } from '@/types/horarios'
import { DIAS } from '@/types/horarios'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { config, docentes, horasPorCurso, horario } = await req.json() as {
    config: InstitucionConfig
    docentes: Docente[]
    horasPorCurso: HorasPorCurso
    horario: HorarioGrid
  }

  const { nombre: INST, anio: ANIO, jornada: JORNADA, cursos, horarios } = config
  const tutores = config.tutores || {}

  function getDoc(mata: string) {
    for (const d of docentes) {
      if (d.materias.includes(mata)) {
        return d.titulo + ' ' + d.nombre
      }
    }
    return '—'
  }

  const wb = new ExcelJS.Workbook()
  
  function sc(cell: ExcelJS.Cell, bold = false, size = 10, fg = '000000', bg?: string, ha: 'left' | 'center' | 'right' = 'center', va: 'top' | 'middle' | 'bottom' = 'middle', wrap = true) {
    cell.font = { name: 'Times New Roman', bold, size, color: { argb: fg === 'FFFFFF' ? 'FFFFFFFF' : `FF${fg.replace('#','')}` } }
    cell.alignment = { horizontal: ha, vertical: va, wrapText: wrap }
    if (bg) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg.replace('#','')}` } }
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  }

  // ── HOJA 1: HORARIOS POR CURSO ────────────────────────────
  const ws1 = wb.addWorksheet('HORARIO POR CURSO')
  ws1.getColumn(1).width = 6
  ws1.getColumn(2).width = 14
  for (let i = 3; i <= 7; i++) ws1.getColumn(i).width = 17

  let row = 1
  for (const curso of cursos) {
    ws1.mergeCells(`A${row}:G${row}`)
    sc(ws1.getCell(`A${row}`), true, 11, 'FFFFFF', '1F3864')
    ws1.getCell(`A${row}`).value = INST
    ws1.getRow(row).height = 18
    row++

    ws1.mergeCells(`A${row}:G${row}`)
    sc(ws1.getCell(`A${row}`), true, 10, 'FFFFFF', '1F3864')
    ws1.getCell(`A${row}`).value = `DISTRIBUTIVO DE HORARIO — ${JORNADA}  AÑO LECTIVO ${ANIO}`
    ws1.getRow(row).height = 15
    row++

    ws1.mergeCells(`A${row}:G${row}`)
    sc(ws1.getCell(`A${row}`), true, 14, '000000', 'D6E4F7')
    ws1.getCell(`A${row}`).value = curso
    ws1.getRow(row).height = 24
    row++

    sc(ws1.getCell(row, 1), true, 11, 'FFFFFF', '2E5090'); ws1.getCell(row, 1).value = 'N°'
    sc(ws1.getCell(row, 2), true, 11, 'FFFFFF', '2E5090'); ws1.getCell(row, 2).value = 'Horario'
    DIAS.forEach((dia, i) => {
      sc(ws1.getCell(row, 3 + i), true, 11, 'FFFFFF', '2E5090')
      ws1.getCell(row, 3 + i).value = dia
    })
    ws1.getRow(row).height = 18
    row++

    const recesos = config.recesos || [4]
    let classNum1 = 0
    horarios.forEach((hora, pi) => {
      const isReceso = recesos.includes(pi)
      if (!isReceso) classNum1++
      const bg_p = isReceso ? 'E2EFDA' : 'EAF0FB'

      sc(ws1.getCell(row, 1), false, 9, '000000', bg_p); ws1.getCell(row, 1).value = isReceso ? 'R' : classNum1
      sc(ws1.getCell(row, 2), false, 9, '000000', bg_p); ws1.getCell(row, 2).value = hora

      if (isReceso) {
        ws1.mergeCells(`C${row}:G${row}`)
        sc(ws1.getCell(row, 3), true, 11, '000000', 'E2EFDA')
        ws1.getCell(row, 3).value = 'R E C E S O'
        ws1.getRow(row).height = 16
      } else {
        DIAS.forEach((dia, di) => {
          const mat = horario[curso]?.[dia]?.[pi] || ''
          const bg = mat === 'ACOMPAÑAMIENTO' ? 'FFFF00' : (pi % 2 === 0 ? 'F7FAFF' : 'FFFFFF')
          sc(ws1.getCell(row, 3 + di), false, 9, '000000', bg)
          ws1.getCell(row, 3 + di).value = mat
        })
        ws1.getRow(row).height = 20
      }
      row++
    })

    ws1.mergeCells(`A${row}:B${row}`)
    sc(ws1.getCell(`A${row}`), true, 9, '000000', 'FFF2CC'); ws1.getCell(`A${row}`).value = 'TUTOR:'
    ws1.mergeCells(`C${row}:G${row}`)
    sc(ws1.getCell(`C${row}`), false, 9, '000000', 'FFF2CC', 'left'); ws1.getCell(`C${row}`).value = tutores[curso] || '—'
    ws1.getRow(row).height = 16
    row += 2
  }

  // ── HOJA 2: HORARIO POR DOCENTE ──────────────────────────
  const ws2 = wb.addWorksheet('HORARIO DOCENTE')
  ws2.getColumn(1).width = 28
  ws2.getColumn(2).width = 14
  for (let i = 3; i <= 7; i++) ws2.getColumn(i).width = 20

  const doc_h: Record<string, Record<string, string[]>> = {}
  Object.entries(horario).forEach(([curso, dias]) => {
    Object.entries(dias).forEach(([dia, pers]) => {
      pers.forEach((mat, pi) => {
        if (!mat || mat === 'RECESO' || mat === 'ACOMPAÑAMIENTO') return
        const docName = getDoc(mat)
        if (docName === '—') return
        
        if (!doc_h[docName]) {
          doc_h[docName] = {}
          DIAS.forEach(d => doc_h[docName][d] = Array(horarios.length).fill(''))
        }
        const cur = doc_h[docName][dia][pi]
        const entry = `${mat} (${curso})`
        doc_h[docName][dia][pi] = cur ? cur + '\n' + entry : entry
      })
    })
  })

  let row2 = 1
  ws2.mergeCells(`A${row2}:G${row2}`)
  sc(ws2.getCell(`A${row2}`), true, 11, 'FFFFFF', '1F3864'); ws2.getCell(`A${row2}`).value = INST
  ws2.getRow(row2).height = 18; row2++
  
  ws2.mergeCells(`A${row2}:G${row2}`)
  sc(ws2.getCell(`A${row2}`), true, 10, 'FFFFFF', '1F3864'); ws2.getCell(`A${row2}`).value = `HORARIO POR DOCENTE — ${JORNADA}  AÑO LECTIVO ${ANIO}`
  ws2.getRow(row2).height = 15; row2 += 2

  Object.entries(doc_h).sort((a, b) => a[0].localeCompare(b[0])).forEach(([doc_name, dias]) => {
    ws2.mergeCells(`A${row2}:G${row2}`)
    sc(ws2.getCell(`A${row2}`), true, 11, 'FFFFFF', '2E5090'); ws2.getCell(`A${row2}`).value = `Docente: ${doc_name}`
    ws2.getRow(row2).height = 18; row2++

    sc(ws2.getCell(row2, 1), true, 10, 'FFFFFF', '2E5090'); ws2.getCell(row2, 1).value = 'N°'
    sc(ws2.getCell(row2, 2), true, 10, 'FFFFFF', '2E5090'); ws2.getCell(row2, 2).value = 'Horario'
    DIAS.forEach((dia, i) => {
      sc(ws2.getCell(row2, 3 + i), true, 10, 'FFFFFF', '2E5090')
      ws2.getCell(row2, 3 + i).value = dia
    })
    ws2.getRow(row2).height = 16; row2++

    const recesos = config.recesos || [4]
    let classNum2 = 0
    horarios.forEach((hora, pi) => {
      const isReceso = recesos.includes(pi)
      if (!isReceso) classNum2++
      const bg_p = isReceso ? 'E2EFDA' : 'EAF0FB'

      sc(ws2.getCell(row2, 1), false, 9, '000000', bg_p); ws2.getCell(row2, 1).value = isReceso ? 'R' : classNum2
      sc(ws2.getCell(row2, 2), false, 9, '000000', bg_p); ws2.getCell(row2, 2).value = hora

      if (isReceso) {
        ws2.mergeCells(`C${row2}:G${row2}`)
        sc(ws2.getCell(row2, 3), true, 10, '000000', 'E2EFDA')
        ws2.getCell(row2, 3).value = 'RECESO'
        ws2.getRow(row2).height = 14
      } else {
        DIAS.forEach((dia, di) => {
          const txt = dias[dia]?.[pi] || ''
          const bg = pi % 2 === 0 ? 'F7FAFF' : 'FFFFFF'
          sc(ws2.getCell(row2, 3 + di), false, 9, '000000', bg)
          ws2.getCell(row2, 3 + di).value = txt
        })
        ws2.getRow(row2).height = 28
      }
      row2++
    })
    row2++
  })

  // ── HOJA 3: DISTRIBUTIVO ─────────────────────────────────
  const ws3 = wb.addWorksheet('DISTRIBUTIVO')
  ws3.getColumn(1).width = 5
  ws3.getColumn(2).width = 30
  ws3.getColumn(3).width = 22
  ws3.getColumn(4).width = 35

  let r3 = 1
  ws3.mergeCells(`A${r3}:D${r3}`)
  sc(ws3.getCell(`A${r3}`), true, 12, 'FFFFFF', '1F3864'); ws3.getCell(`A${r3}`).value = INST
  ws3.getRow(r3).height = 20; r3++
  
  ws3.mergeCells(`A${r3}:D${r3}`)
  sc(ws3.getCell(`A${r3}`), true, 11, 'FFFFFF', '1F3864')
  ws3.getCell(`A${r3}`).value = `DISTRIBUTIVO DEL DOCENTE — AÑO LECTIVO ${ANIO} — ${JORNADA}`
  ws3.getRow(r3).height = 16; r3 += 2

  const headers = ['N°', 'Docente', 'Materia', 'Grados']
  headers.forEach((h, i) => {
    sc(ws3.getCell(r3, i + 1), true, 10, 'FFFFFF', '2E5090')
    ws3.getCell(r3, i + 1).value = h
  })
  ws3.getRow(r3).height = 16; r3++

  const seen = new Set<string>()
  let n = 1
  for (const d of docentes) {
    for (const mat of d.materias) {
      const key = `${d.nombre}|${mat}`
      if (seen.has(key)) continue
      seen.add(key)

      const grados = cursos.filter(c => horasPorCurso[c] && horasPorCurso[c][mat] > 0)
      if (grados.length === 0) continue

      const bg = n % 2 === 0 ? 'F7FAFF' : 'FFFFFF'
      
      sc(ws3.getCell(r3, 1), false, 9, '000000', bg); ws3.getCell(r3, 1).value = n
      sc(ws3.getCell(r3, 2), false, 9, '000000', bg, 'left'); ws3.getCell(r3, 2).value = `${d.titulo} ${d.nombre}`
      sc(ws3.getCell(r3, 3), false, 9, '000000', bg); ws3.getCell(r3, 3).value = mat
      sc(ws3.getCell(r3, 4), false, 9, '000000', bg, 'left'); ws3.getCell(r3, 4).value = grados.join(', ')
      
      ws3.getRow(r3).height = 18
      r3++; n++
    }
  }

  try {
    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="HORARIO_${config.anio.replace(/\s/g,'')}.xlsx"`,
      },
    })
  } catch (err: any) {
    console.error('[horarios/export]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
