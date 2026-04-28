'use client'
// src/components/planificaciones/PlanEditorClient.tsx
// Editor rich-text para planificaciones manuales del docente.
// - Stack: @tiptap/react + StarterKit + Table + Image + Placeholder
// - Auto-guardado debounced (cada 1.5s tras parar de tipear)
// - Header del documento con logo de la institución
// - Plantilla MinEduc inicial cuando el documento está vacío

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Placeholder } from '@tiptap/extension-placeholder'
import {
  ChevronLeft, Save, CheckCircle2, Clock, Bold, Italic, List, ListOrdered,
  Heading1, Heading2, Heading3, Table as TableIcon, Undo2, Redo2,
  Eye, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  savePlanificacionManual,
  setPlanificacionManualStatus,
  type PlanManualStatus,
  type PlanManualType,
} from '@/lib/actions/planificaciones-manuales'

type PlanData = {
  id: string
  title: string
  subjectName: string
  courseName: string
  status: PlanManualStatus
  type: PlanManualType
  unitNumber: number | null
  contentJson: any
  updatedAt: string
}

const AUTOSAVE_DEBOUNCE_MS = 1500

export function PlanEditorClient({
  plan,
  institutionName,
  logoUrl,
  teacherName,
}: {
  plan: PlanData
  institutionName: string
  logoUrl: string | null
  teacherName: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<PlanManualStatus>(plan.status)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string>(plan.updatedAt)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Plantilla MinEduc inicial (HTML) cuando el documento está vacío.
  const initialTemplate = useMemo(() => buildMinEducTemplate({
    institutionName,
    logoUrl,
    teacherName,
    subjectName: plan.subjectName,
    courseName: plan.courseName,
    type: plan.type,
    unitNumber: plan.unitNumber,
  }), [institutionName, logoUrl, teacherName, plan.subjectName, plan.courseName, plan.type, plan.unitNumber])

  // Determina el contenido inicial: si hay JSON guardado, úsalo; si no, plantilla.
  const initialContent: any = useMemo(() => {
    if (plan.contentJson && typeof plan.contentJson === 'object' && Object.keys(plan.contentJson).length > 0) {
      return plan.contentJson
    }
    return initialTemplate
  }, [plan.contentJson, initialTemplate])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Empieza a escribir tu planificación…',
      }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'plan-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'plan-editor-prose focus:outline-none min-h-[640px] px-8 py-8 bg-white',
      },
    },
    onUpdate: ({ editor }) => {
      // Auto-save debounced
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        triggerSave(editor.getJSON(), editor.getHTML())
      }, AUTOSAVE_DEBOUNCE_MS)
    },
  })

  // Save handler
  const triggerSave = useCallback(async (json: any, html: string) => {
    setSavingState('saving')
    // Hard timeout: si el server action no responde en 12s, salir de
    // "Guardando…" y mostrar error en vez de quedar colgado.
    let timedOut = false
    const watchdog = setTimeout(() => {
      timedOut = true
      setSavingState('error')
      toast.error('Tiempo agotado al guardar. Revisa tu conexión.')
    }, 12000)
    try {
      // Normalizar el JSON: TipTap/ProseMirror puede devolver objetos con
      // prototype null que Next.js Server Actions no acepta serializar.
      // JSON.parse(JSON.stringify(...)) garantiza Object.prototype plano.
      const safeJson = JSON.parse(JSON.stringify(json))
      const r = await savePlanificacionManual({
        id: plan.id,
        contentJson: safeJson,
        contentHtml: html,
      })
      clearTimeout(watchdog)
      if (timedOut) return
      if (r.ok) {
        setSavingState('saved')
        setLastSavedAt(new Date().toISOString())
        setTimeout(() => setSavingState('idle'), 1500)
      } else {
        setSavingState('error')
        toast.error('Error al guardar: ' + (r.error || 'desconocido'))
      }
    } catch (err: any) {
      clearTimeout(watchdog)
      if (timedOut) return
      setSavingState('error')
      toast.error('Error al guardar: ' + (err?.message || 'desconocido'))
      console.error('[planificaciones save]', err)
    }
  }, [plan.id])

  // Guardar inmediatamente al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (editor && !editor.isDestroyed) {
        // Best effort: no podemos esperar la promesa al unmount.
        // Mismo motivo que en triggerSave: normalizar el JSON.
        try {
          const safeJson = JSON.parse(JSON.stringify(editor.getJSON()))
          savePlanificacionManual({
            id: plan.id,
            contentJson: safeJson,
            contentHtml: editor.getHTML(),
          }).catch(() => {})
        } catch {
          // ignore — best effort
        }
      }
    }
  }, [editor, plan.id])

  // Toggle publicar / borrador
  async function handleStatusToggle() {
    const next: PlanManualStatus = status === 'borrador' ? 'publicada' : 'borrador'
    if (next === 'publicada') {
      const ok = confirm('¿Publicar esta planificación? El rector y administración podrán verla.')
      if (!ok) return
    }
    const r = await setPlanificacionManualStatus({ id: plan.id, status: next })
    if (!r.ok) {
      toast.error('Error: ' + (r.error || ''))
      return
    }
    setStatus(next)
    toast.success(next === 'publicada' ? 'Planificación publicada' : 'Marcada como borrador')
  }

  if (!editor) {
    return <div className="p-10 text-center text-ink3">Cargando editor…</div>
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-12">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <Link
          href="/dashboard/planificaciones"
          className="inline-flex items-center gap-1 text-sm text-ink3 hover:text-violet"
        >
          <ChevronLeft size={14} /> Volver
        </Link>
        <div className="flex items-center gap-2">
          {/* Indicador de guardado */}
          <SaveIndicator state={savingState} lastSavedAt={lastSavedAt} />
          {/* Toggle status */}
          <button
            onClick={handleStatusToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              status === 'publicada'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            {status === 'publicada'
              ? <><CheckCircle2 size={12} /> Publicada · click para volver a borrador</>
              : <><Clock size={12} /> Borrador · click para publicar</>}
          </button>
        </div>
      </div>

      {/* ── Header doc (no editable) ──────────────────────────────────────── */}
      <div className="mb-3">
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          {plan.title}
        </h1>
        <p className="text-ink3 text-sm mt-1">
          {plan.subjectName} · {plan.courseName}
        </p>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <Toolbar editor={editor} />

      {/* ── Documento (header institucional + editor) ────────────────────── */}
      <div className="plan-doc-wrap bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
        {/* Header institucional NO editable, igual que libretas. Se imprime
            con el documento. */}
        <div className="plan-doc-header px-8 pt-8 pb-4 print:px-3 print:pt-3 print:pb-2">
          <div className="flex items-center gap-4 border-b-2 border-black pb-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="w-16 h-16 object-contain print:w-14 print:h-14"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-ink4 flex items-center justify-center text-[9px] text-ink4 text-center px-1">
                Logo
              </div>
            )}
            <div className="flex-1 text-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
                {institutionName.toUpperCase()}
              </h2>
              <p className="text-[10px] font-semibold tracking-widest text-ink3 mt-0.5 uppercase">
                Planificación Microcurricular
              </p>
              <p className="text-[10px] font-semibold tracking-wider text-ink3 mt-1">
                {plan.subjectName} · {plan.courseName}
              </p>
            </div>
            <div className="w-16" /> {/* spacer simétrico */}
          </div>
        </div>

        {/* Editor TipTap (ahora sin border/shadow propio, lo da el wrap) */}
        <EditorContent editor={editor} />
      </div>

      {/* Estilos */}
      <style jsx global>{`
        /* Header institucional NO editable */
        .plan-doc-header {
          background: white;
        }
        @media print {
          /* Mantener el header visible al imprimir */
          .plan-doc-wrap { border: none !important; box-shadow: none !important; }
          .plan-doc-header { padding: 0 !important; margin-bottom: 8px; }
        }
        .plan-editor-prose {
          font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111;
          line-height: 1.55;
          font-size: 14px;
        }
        .plan-editor-prose h1 { font-size: 22px; font-weight: 700; color: #4c1d95; margin: 1em 0 .4em; }
        .plan-editor-prose h2 { font-size: 18px; font-weight: 700; color: #4c1d95; margin: .9em 0 .3em; }
        .plan-editor-prose h3 { font-size: 15px; font-weight: 700; color: #4c1d95; margin: .8em 0 .3em; }
        .plan-editor-prose p { margin: .5em 0; }
        .plan-editor-prose strong { color: #4c1d95; }
        .plan-editor-prose ul, .plan-editor-prose ol { margin: .5em 0; padding-left: 1.4em; }
        .plan-editor-prose li { margin: 3px 0; }
        .plan-editor-prose .plan-table {
          border-collapse: collapse;
          width: 100%;
          margin: 14px 0;
          font-size: 13px;
        }
        .plan-editor-prose .plan-table th,
        .plan-editor-prose .plan-table td {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: top;
          min-width: 80px;
        }
        .plan-editor-prose .plan-table th {
          background: #f3f4f6;
          font-weight: 700;
          text-align: left;
        }
        .plan-editor-prose .plan-header-table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .plan-editor-prose .plan-header-table td {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: middle;
        }
        .plan-editor-prose .ProseMirror-selectednode {
          outline: 2px solid #7c3aed;
        }
        .plan-editor-prose [data-placeholder]::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function SaveIndicator({
  state,
  lastSavedAt,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: string
}) {
  if (state === 'saving') {
    return (
      <span className="text-[11px] text-ink3 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Guardando…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="text-[11px] text-emerald-600 flex items-center gap-1">
        <CheckCircle2 size={11} /> Guardado
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="text-[11px] text-rose-600 flex items-center gap-1">
        ⚠ Error al guardar
      </span>
    )
  }
  // idle
  return (
    <span className="text-[11px] text-ink4 flex items-center gap-1">
      <Save size={11} /> Última edición {timeAgo(lastSavedAt)}
    </span>
  )
}

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: any }) {
  const Btn = ({
    onClick, active, title, children,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-violet text-white'
          : 'text-ink3 hover:bg-violet/10 hover:text-violet'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 mb-3 p-2 rounded-xl bg-white border border-line shadow-sm">
      <Btn onClick={() => editor.chain().focus().undo().run()} title="Deshacer (Ctrl+Z)">
        <Undo2 size={14} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="Rehacer (Ctrl+Y)">
        <Redo2 size={14} />
      </Btn>
      <span className="w-px h-5 bg-line mx-1" />
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Título 1"
      >
        <Heading1 size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Título 2"
      >
        <Heading2 size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Título 3"
      >
        <Heading3 size={14} />
      </Btn>
      <span className="w-px h-5 bg-line mx-1" />
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Negrita (Ctrl+B)"
      >
        <Bold size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Cursiva (Ctrl+I)"
      >
        <Italic size={14} />
      </Btn>
      <span className="w-px h-5 bg-line mx-1" />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Lista con viñetas"
      >
        <List size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        <ListOrdered size={14} />
      </Btn>
      <span className="w-px h-5 bg-line mx-1" />
      <Btn
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title="Insertar tabla"
      >
        <TableIcon size={14} />
      </Btn>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Plantilla MinEduc inicial — TipTap recibe HTML que parsea automáticamente.
// Esta plantilla replica la estructura mostrada por el docente: encabezado con
// logo + datos institucionales + tabla microcurricular.
function buildMinEducTemplate({
  institutionName, logoUrl, teacherName, subjectName, courseName, type, unitNumber,
}: {
  institutionName: string
  logoUrl: string | null
  teacherName: string
  subjectName: string
  courseName: string
  type: PlanManualType
  unitNumber?: number | null
}): string {
  if (institutionName.toUpperCase().includes('LETAMENDI') && type === 'semanal') {
    return buildLetamendiWeeklyTemplate({
      teacherName,
      subjectName,
      courseName,
      unitNumber,
    })
  }

  // Nota: el encabezado institucional con logo + nombre de la institución
  // se renderiza FUERA del editor (header fijo no editable). La plantilla
  // empieza directamente con la tabla de datos del docente para evitar
  // duplicar el banner.

  const unitRow = type !== 'anual' && unitNumber
    ? `<tr><td><strong>N. de Unidad</strong></td><td>${unitNumber}</td><td><strong>Título de Unidad</strong></td><td></td></tr>`
    : ''

  return `
<table class="plan-table">
  <tbody>
    <tr><td><strong>Nombre del Docente</strong></td><td>${escapeHtml(teacherName)}</td><td><strong>Fecha</strong></td><td></td></tr>
    <tr><td><strong>Área</strong></td><td>${escapeHtml(subjectName)}</td><td><strong>Grado</strong></td><td>${escapeHtml(courseName)}</td></tr>
    <tr><td><strong>Asignatura</strong></td><td>${escapeHtml(subjectName)}</td><td><strong>Año lectivo</strong></td><td></td></tr>
    ${unitRow}
  </tbody>
</table>

<h2>Objetivos</h2>
<p>Escribe aquí los objetivos de aprendizaje del periodo…</p>

<h2>Criterios de evaluación</h2>
<p>Define los criterios MinEduc que orientarán la evaluación…</p>

<h2>Planificación microcurricular</h2>
<table class="plan-table">
  <thead>
    <tr>
      <th>Destrezas con criterios de desempeño</th>
      <th>Indicadores de evaluación</th>
      <th>Recursos</th>
      <th>Orientaciones metodológicas</th>
      <th>Orientaciones para la evaluación</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
    <tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
  </tbody>
</table>

<h2>Estudiantes con necesidades educativas específicas</h2>
<table class="plan-table">
  <thead>
    <tr>
      <th>Destrezas con criterios de desempeño</th>
      <th>Indicadores de evaluación</th>
      <th>Recursos</th>
      <th>Orientaciones metodológicas</th>
      <th>Orientaciones para la evaluación</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
  </tbody>
</table>
  `.trim()
}

function buildLetamendiWeeklyTemplate({
  teacherName,
  subjectName,
  courseName,
  unitNumber,
}: {
  teacherName: string
  subjectName: string
  courseName: string
  unitNumber?: number | null
}): string {
  const unidad = unitNumber ?? 1

  return `
<table class="plan-table">
  <tbody>
    <tr><td colspan="4"><strong>Datos informativos</strong></td></tr>
    <tr><td><strong>Área/Asignatura</strong></td><td>${escapeHtml(subjectName)}</td><td><strong>Grado/curso</strong></td><td>${escapeHtml(courseName)}</td></tr>
    <tr><td><strong>Docente(s)</strong></td><td>${escapeHtml(teacherName)}</td><td><strong>Año lectivo</strong></td><td>2026 - 2027</td></tr>
    <tr><td><strong>Tiempo</strong></td><td>9 semanas</td><td><strong>Fecha de inicio</strong></td><td></td></tr>
    <tr><td><strong>Nivel educativo</strong></td><td></td><td><strong>Fecha de finalización</strong></td><td></td></tr>
    <tr><td><strong>Título de la Unidad Didáctica ${unidad}</strong></td><td colspan="3"></td></tr>
    <tr><td><strong>Objetivo de la Unidad</strong></td><td colspan="3"></td></tr>
    <tr><td><strong>Criterios de Evaluación</strong></td><td colspan="3"></td></tr>
  </tbody>
</table>

<table class="plan-table">
  <thead>
    <tr>
      <th>Periodo / Fecha</th>
      <th>Destrezas con criterio de desempeño ¿Qué van a aprender?</th>
      <th>Actividades de aprendizaje / Estrategias metodológicas ¿Cómo van a aprender?</th>
      <th>Recursos / Materiales</th>
      <th>Indicadores de evaluación ¿Qué y cómo evaluar?</th>
      <th>Técnicas e instrumentos de evaluación ¿Qué y cómo evaluar?</th>
    </tr>
  </thead>
  <tbody>
    ${Array.from({ length: 9 }, (_, idx) => `
      <tr>
        <td><strong>Semana ${idx + 1}</strong><p>Desde:</p><p>Hasta:</p></td>
        <td><p></p></td>
        <td><p></p></td>
        <td><p></p></td>
        <td><p></p></td>
        <td><p>Técnicas:</p><p>Instrumentos:</p></td>
      </tr>
    `).join('')}
  </tbody>
</table>

<h3>Adaptación curricular</h3>
<p><strong>Estudiantes con necesidades educativas específicas:</strong></p>
<table class="plan-table">
  <tbody>
    <tr><td><strong>Tipo de NEE</strong></td></tr>
  </tbody>
</table>

<table class="plan-table">
  <thead>
    <tr>
      <th>Destrezas con criterio de desempeño</th>
      <th>Indicadores de evaluación</th>
      <th>Estrategias metodológicas</th>
      <th>Recursos</th>
      <th>Técnicas e instrumentos de evaluación</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
  </tbody>
</table>

<table class="plan-table">
  <tbody>
    <tr>
      <td><strong>Elaborado:</strong></td>
      <td><strong>Revisado:</strong></td>
      <td><strong>Aprobado:</strong></td>
    </tr>
    <tr>
      <td><strong>Cargo:</strong></td>
      <td><strong>Cargo:</strong></td>
      <td><strong>Cargo:</strong></td>
    </tr>
    <tr>
      <td><strong>Firma:</strong></td>
      <td><strong>Firma:</strong></td>
      <td><strong>Firma:</strong></td>
    </tr>
    <tr>
      <td><strong>Fecha:</strong></td>
      <td><strong>Fecha:</strong></td>
      <td><strong>Fecha:</strong></td>
    </tr>
  </tbody>
</table>
  `.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
