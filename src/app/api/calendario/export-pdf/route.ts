// src/app/api/calendario/export-pdf/route.ts
// Export semanal del calendario como HTML imprimible (Ctrl+P → Guardar como PDF).
// Sin dependencias extra. Auto-trigger window.print() al cargar.

import { NextRequest } from 'next/server'
import { listarRango } from '@/lib/actions/calendario'

export const dynamic = 'force-dynamic'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function fmtFecha(s: string): string {
  // s = 'YYYY-MM-DD' → 'DD/MM/YYYY'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  const grupo = url.searchParams.get('grupo')
  const asignatura = url.searchParams.get('asignatura')

  if (!desde || !hasta) {
    return new Response('Faltan parámetros desde/hasta', { status: 400 })
  }

  const entries = await listarRango({
    desde,
    hasta,
    grupo: grupo || null,
    asignatura: asignatura || null,
  })

  // Generar columnas Lun..Dom
  const startDate = new Date(desde + 'T00:00:00')
  const dayCols: { fecha: string; nombre: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dayCols.push({ fecha: `${y}-${m}-${day}`, nombre: `${DIAS[i]} ${day}/${m}` })
  }

  // Agrupar entradas por fecha
  const byDate = new Map<string, typeof entries>()
  for (const e of entries) {
    const arr = byDate.get(e.fecha_inicio) || []
    arr.push(e)
    byDate.set(e.fecha_inicio, arr)
  }

  const filtros: string[] = []
  if (grupo) filtros.push(`Grupo: ${escapeHtml(grupo)}`)
  if (asignatura) filtros.push(`Asignatura: ${escapeHtml(asignatura)}`)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Calendario semanal ${fmtFecha(desde)} - ${fmtFecha(hasta)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; padding: 24px; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; font-size: 11px; }
  th { background: #f3f4f6; font-weight: 600; text-align: left; }
  td { height: 120px; }
  .entry { background: #eff6ff; border-left: 3px solid #2563eb; padding: 4px 6px; margin-bottom: 4px; border-radius: 3px; }
  .entry-title { font-weight: 600; font-size: 11px; }
  .entry-meta { font-size: 10px; color: #555; margin-top: 2px; }
  .empty { color: #999; font-size: 10px; font-style: italic; }
  .footer { margin-top: 16px; font-size: 10px; color: #666; text-align: right; }
  @media print {
    body { padding: 12px; }
    .no-print { display: none; }
    @page { size: landscape; margin: 12mm; }
  }
  .no-print button { padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; margin-bottom: 12px; }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">Imprimir / Guardar como PDF</button>
</div>
<h1>Calendario semanal del docente</h1>
<div class="sub">
  Semana del ${fmtFecha(desde)} al ${fmtFecha(hasta)}
  ${filtros.length ? ` · ${filtros.join(' · ')}` : ''}
</div>
<table>
  <thead>
    <tr>${dayCols.map(c => `<th>${c.nombre}</th>`).join('')}</tr>
  </thead>
  <tbody>
    <tr>
      ${dayCols.map(c => {
        const items = byDate.get(c.fecha) || []
        if (items.length === 0) return `<td><div class="empty">— sin planificaciones —</div></td>`
        return `<td>${items.map(e => {
          const sesArr: any[] = (e.planificacion?.metadata?.sesiones || []) as any[]
          const total = sesArr.length || null
          const ses = e.sesion_numero != null ? sesArr.find((s: any) => s.numero === e.sesion_numero) : null
          const titleShown = ses?.tema || e.planificacion?.title || 'Sin título'
          const sesionBadge = e.sesion_numero != null
            ? `<div style="font-size:9px;background:#7c3aed;color:white;padding:1px 4px;border-radius:3px;display:inline-block;margin-bottom:2px;font-weight:bold;">Sesión ${e.sesion_numero}${total ? '/' + total : ''}</div>`
            : ''
          return `
          <div class="entry">
            ${sesionBadge}
            <div class="entry-title">${escapeHtml(titleShown)}</div>
            <div class="entry-meta">
              ${escapeHtml(e.planificacion?.subject || '')}${e.planificacion?.grade ? ' · ' + escapeHtml(e.planificacion.grade) : ''}
              ${e.grupo ? '<br>Grupo: ' + escapeHtml(e.grupo) : ''}
              ${e.notas ? '<br>' + escapeHtml(e.notas) : ''}
            </div>
          </div>
        `}).join('')}</td>`
      }).join('')}
    </tr>
  </tbody>
</table>
<div class="footer">Generado por EduPlan3D — ${new Date().toLocaleString('es-EC')}</div>
<script>
  setTimeout(() => { try { window.print() } catch (e) {} }, 600);
</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
