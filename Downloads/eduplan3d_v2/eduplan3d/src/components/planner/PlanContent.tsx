// src/components/planner/PlanContent.tsx
'use client'

import { useState } from 'react'
import { Pencil, Eye, Save, X, Link2 } from 'lucide-react'
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

  function insertLink() {
    const url = prompt('URL del enlace:')
    if (!url) return
    const label = prompt('Texto del enlace:', url)
    const link = `[${label || url}](${url})`
    setEditContent(prev => prev + '\n' + link)
  }

  return (
    <div className="bg-white text-black rounded-xl shadow-lg border print:shadow-none print:border-none print:rounded-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 print:hidden">
        <div className="flex items-center gap-2">
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
              <button
                onClick={insertLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Link2 size={13} /> Insertar enlace
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Eye size={13} /> Vista previa
            </button>
          )}
          <CopyButton text={content} />
          <PrintButton />
        </div>
      </div>

      {/* Content */}
      <div className="p-8 print:p-4">
        {editing ? (
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full min-h-[600px] p-4 text-sm font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 resize-y leading-relaxed"
            placeholder="Edita el contenido en formato Markdown..."
          />
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  )
}
