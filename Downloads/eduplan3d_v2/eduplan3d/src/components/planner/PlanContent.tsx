// src/components/planner/PlanContent.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Save, X, Check, Plus, Trash2, Link2, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { MarkdownRenderer } from './MarkdownRenderer'
import { CopyButton } from './CopyButton'
import { PrintButton } from './PrintButton'

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Block {
  id: string
  md: string  // raw markdown for this block
}

interface Props {
  planId: string
  initialContent: string
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
let _blockId = 0
function uid() { return `b_${++_blockId}_${Date.now()}` }

/** Split full markdown into logical blocks (by ## headings or ---) */
function splitIntoBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let buf: string[] = []

  const flush = () => {
    const text = buf.join('\n').trim()
    if (text) blocks.push({ id: uid(), md: text })
    buf = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // New block on ## heading or --- separator
    if (/^#{1,2}\s/.test(trimmed) || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush()
    }
    buf.push(line)
  }
  flush()
  return blocks
}

/** Merge blocks back into full markdown */
function mergeBlocks(blocks: Block[]): string {
  return blocks.map(b => b.md).join('\n\n')
}

/* ─── Inline Block Editor (textarea that auto-grows) ────────────────── */
function BlockEditor({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
      ref.current.focus()
    }
  }, [value])

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          // auto-grow
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave()
        }}
        className="w-full p-3 text-sm font-mono text-gray-800 bg-white border-2 border-violet-300 rounded-lg outline-none focus:border-violet-500 resize-none leading-relaxed"
        style={{ minHeight: '60px' }}
      />
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <span>Ctrl+Enter para guardar · Esc para cancelar</span>
      </div>
    </div>
  )
}

/* ─── Single Block Component ────────────────────────────────────────── */
function EditableBlock({
  block,
  isEditing,
  onStartEdit,
  onSaveBlock,
  onCancelEdit,
  onDeleteBlock,
  editingBlockId,
}: {
  block: Block
  isEditing: boolean
  onStartEdit: () => void
  onSaveBlock: (newMd: string) => void
  onCancelEdit: () => void
  onDeleteBlock: () => void
  editingBlockId: string | null
}) {
  const [draft, setDraft] = useState(block.md)
  const hasEditingBlock = editingBlockId !== null

  useEffect(() => {
    setDraft(block.md)
  }, [block.md, isEditing])

  if (isEditing) {
    return (
      <div className="relative border-2 border-violet-200 bg-violet-50/30 rounded-xl p-4 transition-all">
        {/* Live preview of this block */}
        <div className="mb-3 pb-3 border-b border-violet-200">
          <div className="text-[10px] uppercase tracking-wider text-violet-400 font-bold mb-2">
            Vista previa del bloque
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <MarkdownRenderer content={draft} />
          </div>
        </div>

        {/* Editor for this block */}
        <div className="text-[10px] uppercase tracking-wider text-violet-400 font-bold mb-2">
          Editando
        </div>
        <BlockEditor
          value={draft}
          onChange={setDraft}
          onSave={() => onSaveBlock(draft)}
          onCancel={onCancelEdit}
        />
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onSaveBlock(draft)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <Check size={13} /> Aplicar
          </button>
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
          >
            <X size={13} /> Cancelar
          </button>
          <button
            onClick={onDeleteBlock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors ml-auto"
          >
            <Trash2 size={13} /> Eliminar bloque
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={!hasEditingBlock ? onStartEdit : undefined}
      className={`group relative rounded-xl p-4 transition-all ${
        !hasEditingBlock
          ? 'cursor-pointer hover:bg-violet-50/40 hover:ring-2 hover:ring-violet-200'
          : 'opacity-60'
      }`}
    >
      {/* Edit hint */}
      {!hasEditingBlock && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-violet-100 text-violet-600 px-2 py-1 rounded-lg text-[10px] font-semibold">
          <Pencil size={10} /> Clic para editar
        </div>
      )}
      <MarkdownRenderer content={block.md} />
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────────────────── */
export function PlanContent({ planId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent)
  const [blocks, setBlocks] = useState<Block[]>(() => splitIntoBlocks(initialContent))
  const [editMode, setEditMode] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Save full content to server
  async function handleSaveAll() {
    setSaving(true)
    try {
      const fullMd = mergeBlocks(blocks)
      const res = await fetch(`/api/planificaciones/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullMd }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setContent(fullMd)
      setEditMode(false)
      setEditingBlockId(null)
      toast.success('Planificación actualizada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setBlocks(splitIntoBlocks(content))
    setEditMode(false)
    setEditingBlockId(null)
  }

  function handleSaveBlock(blockId: string, newMd: string) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, md: newMd } : b))
    setEditingBlockId(null)
  }

  function handleDeleteBlock(blockId: string) {
    if (!confirm('¿Eliminar este bloque?')) return
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    setEditingBlockId(null)
  }

  function handleAddBlock(afterId: string) {
    const idx = blocks.findIndex(b => b.id === afterId)
    const newBlock: Block = { id: uid(), md: '## Nueva sección\n\nEscribe aquí...' }
    const updated = [...blocks]
    updated.splice(idx + 1, 0, newBlock)
    setBlocks(updated)
    setEditingBlockId(newBlock.id)
  }

  function handleInsertLink() {
    if (!editingBlockId) return
    const url = prompt('URL del enlace:')
    if (!url) return
    const label = prompt('Texto del enlace:', url)
    const link = `[${label || url}](${url})`
    setBlocks(prev =>
      prev.map(b => b.id === editingBlockId ? { ...b, md: b.md + '\n' + link } : b)
    )
  }

  return (
    <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 print:hidden flex-wrap gap-2">
        <div className="flex items-center gap-2">
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
              <div className="h-5 w-px bg-gray-300 mx-1" />
              <button
                onClick={handleInsertLink}
                disabled={!editingBlockId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
              >
                <Link2 size={13} /> Insertar enlace
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
      {editMode && !editingBlockId && (
        <div className="mx-5 mt-3 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700 flex items-center gap-2">
          <Pencil size={12} />
          <span><strong>Modo edición:</strong> Haz clic en cualquier sección para editarla. Los cambios se guardan al presionar &quot;Guardar todo&quot;.</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6 print:p-4">
        {editMode ? (
          <div className="space-y-1">
            {blocks.map((block, i) => (
              <div key={block.id}>
                <EditableBlock
                  block={block}
                  isEditing={editingBlockId === block.id}
                  editingBlockId={editingBlockId}
                  onStartEdit={() => setEditingBlockId(block.id)}
                  onSaveBlock={(newMd) => handleSaveBlock(block.id, newMd)}
                  onCancelEdit={() => setEditingBlockId(null)}
                  onDeleteBlock={() => handleDeleteBlock(block.id)}
                />
                {/* Add block button between blocks */}
                {editingBlockId === null && (
                  <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleAddBlock(block.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold text-violet-500 bg-violet-50 hover:bg-violet-100 transition-colors"
                    >
                      <Plus size={10} /> Agregar sección
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-2">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  )
}
