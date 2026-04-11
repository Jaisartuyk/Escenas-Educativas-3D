// src/components/planner/PlanContent.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Pencil, Save, X, Plus, Trash2, Link2, Type, Table as TableIcon, List } from 'lucide-react'
import toast from 'react-hot-toast'
import { MarkdownRenderer } from './MarkdownRenderer'
import { CopyButton } from './CopyButton'
import { PrintButton } from './PrintButton'

/* ═══════════════════════════════════════════════════════════════════════
   TYPES — Each element of the planificación is a typed node
   ═══════════════════════════════════════════════════════════════════════ */
type NodeType = 'heading' | 'table' | 'paragraph' | 'list' | 'separator'

interface HeadingNode {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
}

interface TableNode {
  type: 'table'
  headers: string[]
  rows: string[][]
}

interface ParagraphNode {
  type: 'paragraph'
  text: string
}

interface ListNode {
  type: 'list'
  items: string[]
}

interface SeparatorNode {
  type: 'separator'
}

type DocNode = HeadingNode | TableNode | ParagraphNode | ListNode | SeparatorNode

/* ═══════════════════════════════════════════════════════════════════════
   PARSER — Convert markdown text → DocNode[]
   ═══════════════════════════════════════════════════════════════════════ */
function parseMarkdownToNodes(md: string): DocNode[] {
  const lines = md.split('\n')
  const nodes: DocNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line — skip
    if (trimmed === '') { i++; continue }

    // Separator ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      nodes.push({ type: 'separator' })
      i++; continue
    }

    // Heading
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (hMatch) {
      nodes.push({
        type: 'heading',
        level: hMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: hMatch[2].trim(),
      })
      i++; continue
    }

    // Table (starts with |)
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      // Parse table
      const dataRows = tableLines.filter(l => !/^\|[\s\-:|]+\|$/.test(l))
      if (dataRows.length > 0) {
        const parseRow = (line: string): string[] =>
          line.split('|').slice(1, -1).map(c => c.trim())
        const headers = parseRow(dataRows[0])
        const rows = dataRows.slice(1).map(parseRow)
        nodes.push({ type: 'table', headers, rows })
      }
      continue
    }

    // List items
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const lt = lines[i].trim()
        if (/^[-*]\s/.test(lt)) {
          items.push(lt.replace(/^[-*]\s+/, ''))
          i++
        } else if (/^\d+\.\s/.test(lt)) {
          items.push(lt.replace(/^\d+\.\s+/, ''))
          i++
        } else break
      }
      nodes.push({ type: 'list', items })
      continue
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = []
    while (i < lines.length) {
      const lt = lines[i].trim()
      if (lt === '' || lt.startsWith('#') || lt.startsWith('|') ||
          /^(-{3,}|\*{3,}|_{3,})$/.test(lt) ||
          /^[-*]\s/.test(lt) || /^\d+\.\s/.test(lt)) break
      paraLines.push(lt)
      i++
    }
    if (paraLines.length > 0) {
      nodes.push({ type: 'paragraph', text: paraLines.join('\n') })
    }
  }

  return nodes
}

/* ═══════════════════════════════════════════════════════════════════════
   SERIALIZER — Convert DocNode[] → markdown string
   ═══════════════════════════════════════════════════════════════════════ */
function nodesToMarkdown(nodes: DocNode[]): string {
  return nodes.map(node => {
    switch (node.type) {
      case 'separator':
        return '---'
      case 'heading':
        return '#'.repeat(node.level) + ' ' + node.text
      case 'paragraph':
        return node.text
      case 'list':
        return node.items.map(item => `- ${item}`).join('\n')
      case 'table': {
        const hdr = '| ' + node.headers.join(' | ') + ' |'
        const sep = '|' + node.headers.map(() => '---|').join('')
        const body = node.rows.map(r => '| ' + r.join(' | ') + ' |').join('\n')
        return hdr + '\n' + sep + (body ? '\n' + body : '')
      }
    }
  }).join('\n\n')
}

/* ═══════════════════════════════════════════════════════════════════════
   VISUAL EDITORS — One for each node type
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Heading Editor ─────────────────────────────────────────────────── */
function HeadingEditor({ node, onChange }: { node: HeadingNode, onChange: (n: HeadingNode) => void }) {
  const sizeClasses: Record<number, string> = {
    1: 'text-xl font-bold',
    2: 'text-lg font-bold text-violet-700',
    3: 'text-base font-bold',
    4: 'text-sm font-bold',
    5: 'text-sm font-semibold',
    6: 'text-xs font-semibold uppercase',
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={node.level}
        onChange={e => onChange({ ...node, level: parseInt(e.target.value) as any })}
        className="px-2 py-1.5 border border-violet-300 rounded-lg text-xs bg-white text-violet-700 font-bold focus:outline-none focus:ring-2 focus:ring-violet-300"
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
        <option value={4}>H4</option>
      </select>
      <input
        type="text"
        value={node.text}
        onChange={e => onChange({ ...node, text: e.target.value })}
        className={`flex-1 px-3 py-2 border-2 border-violet-200 rounded-lg bg-white focus:border-violet-400 focus:outline-none ${sizeClasses[node.level] || 'text-sm'}`}
      />
    </div>
  )
}

/* ── Table Editor ───────────────────────────────────────────────────── */
function TableEditor({ node, onChange }: { node: TableNode, onChange: (n: TableNode) => void }) {
  const updateHeader = (ci: number, val: string) => {
    const h = [...node.headers]
    h[ci] = val
    onChange({ ...node, headers: h })
  }
  const updateCell = (ri: number, ci: number, val: string) => {
    const rows = node.rows.map(r => [...r])
    // Ensure row has enough cells
    while (rows[ri].length < node.headers.length) rows[ri].push('')
    rows[ri][ci] = val
    onChange({ ...node, rows })
  }
  const addRow = () => {
    onChange({ ...node, rows: [...node.rows, node.headers.map(() => '')] })
  }
  const removeRow = (ri: number) => {
    onChange({ ...node, rows: node.rows.filter((_, i) => i !== ri) })
  }
  const addCol = () => {
    onChange({
      ...node,
      headers: [...node.headers, 'Nueva columna'],
      rows: node.rows.map(r => [...r, '']),
    })
  }
  const removeCol = (ci: number) => {
    if (node.headers.length <= 1) return
    onChange({
      ...node,
      headers: node.headers.filter((_, i) => i !== ci),
      rows: node.rows.map(r => r.filter((_, i) => i !== ci)),
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse border border-gray-300 rounded-lg">
        <thead>
          <tr className="bg-violet-50">
            {node.headers.map((h, ci) => (
              <th key={ci} className="border border-gray-300 p-0 relative group">
                <input
                  type="text"
                  value={h}
                  onChange={e => updateHeader(ci, e.target.value)}
                  className="w-full px-2 py-2 text-xs font-bold text-gray-800 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 min-w-[100px]"
                />
                {node.headers.length > 1 && (
                  <button
                    onClick={() => removeCol(ci)}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Eliminar columna"
                  >×</button>
                )}
              </th>
            ))}
            <th className="border border-gray-300 w-8 bg-violet-50">
              <button
                onClick={addCol}
                className="w-full h-full py-2 text-violet-500 hover:text-violet-700 text-sm font-bold"
                title="Agregar columna"
              >+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {node.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {node.headers.map((_, ci) => (
                <td key={ci} className="border border-gray-300 p-0">
                  <textarea
                    value={row[ci] || ''}
                    onChange={e => updateCell(ri, ci, e.target.value)}
                    rows={Math.max(1, Math.ceil((row[ci] || '').length / 40))}
                    className="w-full px-2 py-1.5 text-xs text-gray-700 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none min-w-[100px]"
                  />
                </td>
              ))}
              <td className="border border-gray-300 w-8 text-center">
                <button
                  onClick={() => removeRow(ri)}
                  className="text-red-400 hover:text-red-600 text-sm"
                  title="Eliminar fila"
                >×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="mt-2 flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
      >
        <Plus size={10} /> Agregar fila
      </button>
    </div>
  )
}

/* ── Paragraph Editor ───────────────────────────────────────────────── */
function ParagraphEditor({ node, onChange }: { node: ParagraphNode, onChange: (n: ParagraphNode) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [node.text])

  return (
    <textarea
      ref={ref}
      value={node.text}
      onChange={e => {
        onChange({ ...node, text: e.target.value })
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
      }}
      className="w-full px-3 py-2 text-sm text-gray-700 bg-white border-2 border-gray-200 rounded-lg focus:border-violet-300 focus:outline-none resize-none leading-relaxed"
      style={{ minHeight: '40px' }}
    />
  )
}

/* ── List Editor ────────────────────────────────────────────────────── */
function ListEditor({ node, onChange }: { node: ListNode, onChange: (n: ListNode) => void }) {
  const updateItem = (i: number, val: string) => {
    const items = [...node.items]
    items[i] = val
    onChange({ ...node, items })
  }
  const addItem = () => onChange({ ...node, items: [...node.items, ''] })
  const removeItem = (i: number) => onChange({ ...node, items: node.items.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-1.5">
      {node.items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 w-2 h-2 bg-gray-400 rounded-full flex-shrink-0" />
          <input
            type="text"
            value={item}
            onChange={e => updateItem(i, e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm text-gray-700 border-2 border-gray-200 rounded-lg focus:border-violet-300 focus:outline-none bg-white"
          />
          <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 mt-1.5 text-sm">×</button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
      >
        <Plus size={10} /> Agregar elemento
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   VISUAL NODE — Renders the right editor or formatted view per node
   ═══════════════════════════════════════════════════════════════════════ */
function VisualNode({
  node,
  index,
  editMode,
  isEditing,
  anyEditing,
  onStartEdit,
  onUpdate,
  onDelete,
}: {
  node: DocNode
  index: number
  editMode: boolean
  isEditing: boolean
  anyEditing: boolean
  onStartEdit: () => void
  onUpdate: (n: DocNode) => void
  onDelete: () => void
}) {
  if (node.type === 'separator') {
    if (editMode && isEditing) {
      return (
        <div className="py-2 border-2 border-violet-200 rounded-lg px-4 bg-violet-50/30 flex items-center justify-between">
          <hr className="flex-1 border-gray-300" />
          <button onClick={onDelete} className="ml-3 text-red-400 hover:text-red-600 text-xs">
            <Trash2 size={12} />
          </button>
        </div>
      )
    }
    return (
      <div
        onClick={editMode && !anyEditing ? onStartEdit : undefined}
        className={editMode && !anyEditing ? 'cursor-pointer hover:bg-violet-50/40 rounded-lg px-4 py-1 group' : 'px-4 py-1'}
      >
        <hr className="border-gray-200 my-3" />
      </div>
    )
  }

  // Editing mode — show visual editor
  if (editMode && isEditing) {
    return (
      <div className="border-2 border-violet-200 bg-violet-50/20 rounded-xl p-4 transition-all relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-violet-400 font-bold">
            {node.type === 'heading' ? 'Título' :
             node.type === 'table' ? 'Tabla' :
             node.type === 'list' ? 'Lista' : 'Texto'}
          </span>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>

        {node.type === 'heading' && (
          <HeadingEditor node={node} onChange={n => onUpdate(n)} />
        )}
        {node.type === 'table' && (
          <TableEditor node={node} onChange={n => onUpdate(n)} />
        )}
        {node.type === 'paragraph' && (
          <ParagraphEditor node={node} onChange={n => onUpdate(n)} />
        )}
        {node.type === 'list' && (
          <ListEditor node={node} onChange={n => onUpdate(n)} />
        )}
      </div>
    )
  }

  // Normal view (formatted) — click to edit
  const nodeMd = nodesToMarkdown([node])
  return (
    <div
      onClick={editMode && !anyEditing ? onStartEdit : undefined}
      className={`group relative rounded-lg transition-all ${
        editMode && !anyEditing
          ? 'cursor-pointer hover:bg-violet-50/40 hover:ring-2 hover:ring-violet-200 px-4 py-2'
          : editMode ? 'opacity-50 px-4 py-2' : 'px-0 py-0'
      }`}
    >
      {editMode && !anyEditing && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-violet-100 text-violet-600 px-2 py-0.5 rounded text-[10px] font-semibold z-10">
          <Pencil size={9} /> Editar
        </div>
      )}
      <MarkdownRenderer content={nodeMd} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
interface Props {
  planId: string
  initialContent: string
}

export function PlanContent({ planId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent)
  const [nodes, setNodes] = useState<DocNode[]>(() => parseMarkdownToNodes(initialContent))
  const [editMode, setEditMode] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSaveAll() {
    setSaving(true)
    try {
      const fullMd = nodesToMarkdown(nodes)
      const res = await fetch(`/api/planificaciones/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullMd }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setContent(fullMd)
      setEditMode(false)
      setEditingIdx(null)
      toast.success('Planificación actualizada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setNodes(parseMarkdownToNodes(content))
    setEditMode(false)
    setEditingIdx(null)
  }

  function handleUpdate(idx: number, node: DocNode) {
    setNodes(prev => prev.map((n, i) => i === idx ? node : n))
  }

  function handleDelete(idx: number) {
    if (!confirm('¿Eliminar esta sección?')) return
    setNodes(prev => prev.filter((_, i) => i !== idx))
    setEditingIdx(null)
  }

  function addElement(type: 'heading' | 'paragraph' | 'table' | 'list' | 'separator', afterIdx?: number) {
    let newNode: DocNode
    switch (type) {
      case 'heading':
        newNode = { type: 'heading', level: 2, text: 'Nueva sección' }; break
      case 'paragraph':
        newNode = { type: 'paragraph', text: 'Escribe aquí...' }; break
      case 'table':
        newNode = { type: 'table', headers: ['Columna 1', 'Columna 2', 'Columna 3'], rows: [['', '', '']] }; break
      case 'list':
        newNode = { type: 'list', items: ['Elemento 1'] }; break
      case 'separator':
        newNode = { type: 'separator' }; break
    }
    const insertAt = afterIdx !== undefined ? afterIdx + 1 : nodes.length
    const updated = [...nodes]
    updated.splice(insertAt, 0, newNode)
    setNodes(updated)
    setEditingIdx(insertAt)
  }

  return (
    <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 print:hidden flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            >
              <Pencil size={14} /> Editar planificación
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                <Save size={14} /> {saving ? 'Guardando...' : 'Guardar todo'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X size={14} /> Cancelar
              </button>

              {/* Insert elements */}
              <div className="h-5 w-px bg-gray-300 mx-1" />
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Agregar:</span>
              <button onClick={() => addElement('heading', editingIdx ?? undefined)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                title="Agregar título">
                <Type size={12} /> Título
              </button>
              <button onClick={() => addElement('paragraph', editingIdx ?? undefined)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                title="Agregar texto">
                <Pencil size={12} /> Texto
              </button>
              <button onClick={() => addElement('table', editingIdx ?? undefined)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                title="Agregar tabla">
                <TableIcon size={12} /> Tabla
              </button>
              <button onClick={() => addElement('list', editingIdx ?? undefined)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                title="Agregar lista">
                <List size={12} /> Lista
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={content} />
          <PrintButton />
        </div>
      </div>

      {/* Editing hint */}
      {editMode && editingIdx === null && (
        <div className="mx-5 mt-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700 flex items-center gap-2">
          <Pencil size={12} />
          <span><strong>Modo edición:</strong> Haz clic en cualquier sección para editarla directamente. Cuando termines, presiona &quot;Guardar todo&quot;.</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6 print:p-4">
        {editMode ? (
          <div className="space-y-2">
            {nodes.map((node, idx) => (
              <VisualNode
                key={idx}
                node={node}
                index={idx}
                editMode
                isEditing={editingIdx === idx}
                anyEditing={editingIdx !== null}
                onStartEdit={() => setEditingIdx(idx)}
                onUpdate={(n) => handleUpdate(idx, n)}
                onDelete={() => handleDelete(idx)}
              />
            ))}
            {nodes.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No hay contenido. Usa los botones de arriba para agregar elementos.
              </div>
            )}
          </div>
        ) : (
          <div className="px-2">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>

      {/* Done editing block button */}
      {editMode && editingIdx !== null && (
        <div className="px-5 pb-4 print:hidden">
          <button
            onClick={() => setEditingIdx(null)}
            className="w-full py-2 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
          >
            ✓ Listo — clic en otra sección para seguir editando
          </button>
        </div>
      )}
    </div>
  )
}
