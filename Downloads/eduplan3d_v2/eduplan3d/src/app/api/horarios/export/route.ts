// src/app/api/horarios/export/route.ts
// Genera el Excel institucional con openpyxl via Python subprocess
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { HorarioGrid, InstitucionConfig, Docente, HorasPorCurso } from '@/types/horarios'
import { DIAS } from '@/types/horarios'

const execAsync = promisify(exec)

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

  // Serializar datos para el script Python
  const tmpJson = join(tmpdir(), `horario_${Date.now()}.json`)
  const tmpXlsx = join(tmpdir(), `horario_${Date.now()}.xlsx`)

  await writeFile(tmpJson, JSON.stringify({ config, docentes, horasPorCurso, horario, DIAS }))

  const script = `
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

with open(r'${tmpJson}') as f:
    data = json.load(f)

config = data['config']
docentes = data['docentes']
horario = data['horario']
DIAS = data['DIAS']

INST = config['nombre']
ANIO = config['anio']
JORNADA = config['jornada']
cursos = config['cursos']
horarios = config['horarios']
tutores = config.get('tutores', {})

def get_doc(mata):
    for d in docentes:
        if mata in d['materias']:
            return d['titulo'] + ' ' + d['nombre']
    return '—'

def thin():
    s = Side(style='thin', color='000000')
    return Border(left=s, right=s, top=s, bottom=s)

def sc(cell, bold=False, size=10, fg='000000', bg=None, ha='center', va='center', wrap=True):
    cell.font = Font(name='Times New Roman', bold=bold, size=size, color=fg)
    cell.alignment = Alignment(horizontal=ha, vertical=va, wrap_text=wrap)
    if bg:
        cell.fill = PatternFill('solid', start_color=bg, end_color=bg)
    cell.border = thin()

wb = Workbook()

# ── HOJA 1: HORARIOS POR CURSO ────────────────────────────
ws = wb.active
ws.title = 'HORARIO POR CURSO'
ws.column_dimensions['A'].width = 6
ws.column_dimensions['B'].width = 14
for col in ['C','D','E','F','G']:
    ws.column_dimensions[col].width = 17

row = 1
for curso in cursos:
    # Encabezado
    ws.merge_cells(f'A{row}:G{row}')
    sc(ws.cell(row, 1, INST), bold=True, size=11, fg='FFFFFF', bg='1F3864')
    ws.row_dimensions[row].height = 18
    row += 1
    ws.merge_cells(f'A{row}:G{row}')
    sc(ws.cell(row, 1, f'DISTRIBUTIVO DE HORARIO — {JORNADA}  AÑO LECTIVO {ANIO}'), bold=True, size=10, fg='FFFFFF', bg='1F3864')
    ws.row_dimensions[row].height = 15
    row += 1
    ws.merge_cells(f'A{row}:G{row}')
    sc(ws.cell(row, 1, curso), bold=True, size=14, bg='D6E4F7')
    ws.row_dimensions[row].height = 24
    row += 1
    # Días
    sc(ws.cell(row, 1, 'N°'), bold=True, size=11, fg='FFFFFF', bg='2E5090')
    sc(ws.cell(row, 2, 'Horario'), bold=True, size=11, fg='FFFFFF', bg='2E5090')
    for i, dia in enumerate(DIAS):
        sc(ws.cell(row, 3+i, dia), bold=True, size=11, fg='FFFFFF', bg='2E5090')
    ws.row_dimensions[row].height = 18
    row += 1
    # Períodos
    for pi, hora in enumerate(horarios):
        num = 'R' if pi == 4 else str(pi+1)
        bg_p = 'E2EFDA' if pi == 4 else 'EAF0FB'
        sc(ws.cell(row, 1, num if pi != 4 else ''), size=9, bg=bg_p)
        sc(ws.cell(row, 2, hora), size=9, bg=bg_p)
        if pi == 4:
            ws.merge_cells(f'C{row}:G{row}')
            sc(ws.cell(row, 3, 'R E C E S O'), bold=True, size=11, bg='E2EFDA')
            ws.row_dimensions[row].height = 16
        else:
            for di, dia in enumerate(DIAS):
                mat = horario.get(curso, {}).get(dia, [''] * len(horarios))
                mat = mat[pi] if pi < len(mat) else ''
                bg = 'FFFF00' if mat == 'ACOMPAÑAMIENTO' else ('F7FAFF' if pi % 2 == 0 else 'FFFFFF')
                sc(ws.cell(row, 3+di, mat or ''), size=9, bg=bg)
            ws.row_dimensions[row].height = 20
        row += 1
    # Tutor
    ws.merge_cells(f'A{row}:B{row}')
    sc(ws.cell(row, 1, 'TUTOR:'), bold=True, size=9, bg='FFF2CC')
    ws.merge_cells(f'C{row}:G{row}')
    sc(ws.cell(row, 3, tutores.get(curso, '—')), size=9, bg='FFF2CC', ha='left')
    ws.row_dimensions[row].height = 16
    row += 2

# ── HOJA 2: HORARIO POR DOCENTE ──────────────────────────
ws2 = wb.create_sheet('HORARIO DOCENTE')
ws2.column_dimensions['A'].width = 28
ws2.column_dimensions['B'].width = 14
for col in ['C','D','E','F','G']:
    ws2.column_dimensions[col].width = 20

# Invertir horario
doc_h = {}
for curso, dias in horario.items():
    for dia, pers in dias.items():
        for pi, mat in enumerate(pers):
            if not mat or mat in ('RECESO', 'ACOMPAÑAMIENTO'):
                continue
            doc = get_doc(mat)
            if doc == '—': continue
            if doc not in doc_h:
                doc_h[doc] = {d: [''] * len(horarios) for d in DIAS}
            cur = doc_h[doc][dia][pi]
            entry = f'{mat} ({curso})'
            doc_h[doc][dia][pi] = (cur + '\\n' + entry).strip('\\n') if cur else entry

row2 = 1
ws2.merge_cells(f'A{row2}:G{row2}')
sc(ws2.cell(row2, 1, INST), bold=True, size=11, fg='FFFFFF', bg='1F3864')
ws2.row_dimensions[row2].height = 18
row2 += 1
ws2.merge_cells(f'A{row2}:G{row2}')
sc(ws2.cell(row2, 1, f'HORARIO POR DOCENTE — {JORNADA}  AÑO LECTIVO {ANIO}'), bold=True, size=10, fg='FFFFFF', bg='1F3864')
ws2.row_dimensions[row2].height = 15
row2 += 2

for doc_name, dias in sorted(doc_h.items()):
    ws2.merge_cells(f'A{row2}:G{row2}')
    sc(ws2.cell(row2, 1, f'Docente: {doc_name}'), bold=True, size=11, fg='FFFFFF', bg='2E5090')
    ws2.row_dimensions[row2].height = 18
    row2 += 1
    sc(ws2.cell(row2, 1, 'N°'), bold=True, size=10, fg='FFFFFF', bg='2E5090')
    sc(ws2.cell(row2, 2, 'Horario'), bold=True, size=10, fg='FFFFFF', bg='2E5090')
    for i, dia in enumerate(DIAS):
        sc(ws2.cell(row2, 3+i, dia), bold=True, size=10, fg='FFFFFF', bg='2E5090')
    ws2.row_dimensions[row2].height = 16
    row2 += 1
    for pi, hora in enumerate(horarios):
        bg_p = 'E2EFDA' if pi == 4 else 'EAF0FB'
        sc(ws2.cell(row2, 1, '' if pi == 4 else str(pi+1)), size=9, bg=bg_p)
        sc(ws2.cell(row2, 2, hora), size=9, bg=bg_p)
        if pi == 4:
            ws2.merge_cells(f'C{row2}:G{row2}')
            sc(ws2.cell(row2, 3, 'RECESO'), bold=True, size=10, bg='E2EFDA')
            ws2.row_dimensions[row2].height = 14
        else:
            for di, dia in enumerate(DIAS):
                txt = dias.get(dia, [''] * len(horarios))[pi] if pi < len(horarios) else ''
                bg = 'F7FAFF' if pi % 2 == 0 else 'FFFFFF'
                c = ws2.cell(row2, 3+di, txt or '')
                sc(c, size=9, bg=bg)
            ws2.row_dimensions[row2].height = 28
        row2 += 1
    row2 += 1

# ── HOJA 3: DISTRIBUTIVO ─────────────────────────────────
ws3 = wb.create_sheet('DISTRIBUTIVO')
ws3.column_dimensions['A'].width = 5
ws3.column_dimensions['B'].width = 30
ws3.column_dimensions['C'].width = 22
ws3.column_dimensions['D'].width = 35

r3 = 1
ws3.merge_cells(f'A{r3}:D{r3}')
sc(ws3.cell(r3, 1, INST), bold=True, size=12, fg='FFFFFF', bg='1F3864')
ws3.row_dimensions[r3].height = 20; r3 += 1
ws3.merge_cells(f'A{r3}:D{r3}')
sc(ws3.cell(r3, 1, f'DISTRIBUTIVO DEL DOCENTE — AÑO LECTIVO {ANIO} — {JORNADA}'), bold=True, size=11, fg='FFFFFF', bg='1F3864')
ws3.row_dimensions[r3].height = 16; r3 += 2
for h, txt in enumerate(['N°','Docente','Materia','Grados'], 1):
    sc(ws3.cell(r3, h, txt), bold=True, size=10, fg='FFFFFF', bg='2E5090')
ws3.row_dimensions[r3].height = 16; r3 += 1

seen = set()
n = 1
for d in docentes:
    for mat in d['materias']:
        if (d['nombre'], mat) in seen: continue
        seen.add((d['nombre'], mat))
        grados = [c for c in cursos if mat in (data['horasPorCurso'].get(c, {}))]
        bg = 'F7FAFF' if n % 2 == 0 else 'FFFFFF'
        sc(ws3.cell(r3, 1, n), size=9, bg=bg)
        sc(ws3.cell(r3, 2, f"{d['titulo']} {d['nombre']}"), size=9, bg=bg, ha='left')
        sc(ws3.cell(r3, 3, mat), size=9, bg=bg)
        sc(ws3.cell(r3, 4, ', '.join(grados)), size=9, bg=bg, ha='left')
        ws3.row_dimensions[r3].height = 18
        r3 += 1; n += 1

wb.save(r'${tmpXlsx}')
print('OK')
`

  const scriptPath = join(tmpdir(), `gen_horario_${Date.now()}.py`)
  await writeFile(scriptPath, script)

  try {
    await execAsync(`python3 ${scriptPath}`)
    const xlsx = await readFile(tmpXlsx)

    // Limpiar temporales
    await Promise.allSettled([unlink(tmpJson), unlink(tmpXlsx), unlink(scriptPath)])

    return new NextResponse(xlsx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="HORARIO_${config.anio.replace(/\s/g,'')}.xlsx"`,
      },
    })
  } catch (err: any) {
    await Promise.allSettled([unlink(tmpJson), unlink(scriptPath)])
    console.error('[horarios/export]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
