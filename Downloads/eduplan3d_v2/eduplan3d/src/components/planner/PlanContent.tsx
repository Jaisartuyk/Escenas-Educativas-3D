// src/components/planner/PlanContent.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Pencil, Eye, Save, X, Link2, Bold, Italic, Heading1, Heading2, Heading3,
  List, Table, Minus, Columns, AlignLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { MarkdownRenderer } from './MarkdownRenderer'
import { CopyButton } from './CopyButton'
import { PrintButton } from './PrintButton'

interface Props {
  planId: string
  initialContent: string
}

export function PlanContent({ planId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent)
  const [editContent, setEditContent] = useState(initialContent)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [splitView, setSplitView] = useState(true) // side-by-side by default
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/planificaciones/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setContent(editContent)
      setEditing(false)
      toast.success('Planificacion actualizada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setEditContent(content)
    setEditing(false)
  }

  // ── Insert helpers ──────────────────────────────────────────────────────
  const insertAtCursor = useCallback((before: string, after: string = '', placeholder: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = editContent.slice(start, end) || placeholder
    const newText = editContent.slice(0, start) + before + selected + after + editContent.slice(end)
    setEditContent(newText)
    // restore focus & cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus()
      const cursorPos = start + before.length + selected.length + after.length
      ta.setSelectionRange(cursorPos, cursorPos)
    })
  }, [editContent])

  function insertLink() {
    const url = prompt('URL del enlace:')
    if (!url) return
    const label = prompt('Texto del enlace:', url)
    insertAtCursor(`[${label || url}](${url})`)
  }

  function insertTable() {
    const cols = prompt('Numero de columnas:', '3')
    const numCols = Math.max(2, Math.min(8, parseInt(cols || '3')))
    const header = '| ' + Array.from({ length: numCols }, (_, i) => `Columna ${i + 1}`).join(' | ') + ' |'
    const sep = '|' + Array.from({ length: numCols }, () => '---|').join('')
    const row = '| ' + Array.from({ length: numCols }, () => ' ').join(' | ') + ' |'
    insertAtCursor('\n' + header + '\n' + sep + '\n' + row + '\n')
  }

  const toolbarButtons = [
    { icon: Bold, label: 'Negrita', action: () => insertAtCursor('**', '**', 'texto') },
    { icon: Italic, label: 'Cursiva', action: () => insertAtCursor('*', '*', 'texto') },
    { sep: true },
    { icon: Heading1, label: 'Titulo 1', action: () => insertAtCursor('\n# ', '', 'Titulo') },
    { icon: Heading2, label: 'Titulo 2', action: () => insertAtCursor('\n## ', '', 'Subtitulo') },
    { icon: Heading3, label: 'Titulo 3', action: () => insertAtCursor('\n### ', '', 'Seccion') },
    { sep: true },
    { icon: List, label: 'Lista', action: () => insertAtCursor('\n- ', '', 'Elemento') },
    { icon: Table, label: 'Tabla', action: insertTable },
    { icon: Minus, label: 'Linea', action: () => insertAtCursor('\n---\n') },
    { icon: Link2, label: 'Enlace', action: insertLink },
  ]

  return (
    <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 print:hidden flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            >
              <Pencil size={13} /> Editar
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Save size={13} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X size={13} /> Cancelar
              </button>

              {/* Formatting toolbar */}
              <div className="h-5 w-px bg-gray-300 mx-1" />
              {toolbarButtons.map((btn, i) =>
                'sep' in btn ? (
                  <div key={`sep-${i}`} className="h-5 w-px bg-gray-200 mx-0.5" />
                ) : (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    title={btn.label}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-violet-700 transition-colors"
                  >
                    <btn.icon size={14} />
                  </button>
                )
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {editing && (
            <>
              <button
                onClick={() => setSplitView(!splitView)}
                title={splitView ? 'Solo editor' : 'Vista dividida'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  splitView ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {splitView ? <Columns size={13} /> : <AlignLeft size={13} />}
                {splitView ? 'Dividida' : 'Solo editor'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Eye size={13} /> Vista previa
              </button>
            </>
          )}
          <CopyButton text={content} />
          <PrintButton />
        </div>
      </div>

      {/* Content */}
      <div className="print:p-4">
        {editing ? (
          <div className={`${splitView ? 'grid grid-cols-2 divide-x divide-gray-200' : ''}`}>
            {/* Editor pane */}
            <div className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2 px-1">
                Editor Markdown
              </div>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full min-h-[700px] p-4 text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 resize-y leading-relaxed"
                placeholder="Edita el contenido en formato Markdown..."
              />
            </div>

            {/* Live preview pane */}
            {splitView && (
              <div className="p-4 overflow-y-auto max-h-[800px]">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2 px-1">
                  Vista previa en tiempo real
                </div>
                <div className="border border-gray-200 rounded-lg p-6 bg-white min-h-[700px]">
                  <MarkdownRenderer content={editContent} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  )
}
