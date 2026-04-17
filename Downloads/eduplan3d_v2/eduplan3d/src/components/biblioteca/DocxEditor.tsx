'use client'
// src/components/biblioteca/DocxEditor.tsx
// Editor tipo Word para planificaciones DOCX — TipTap + mammoth + html-docx-js

import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  X, Bold, Italic, UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link2, ImageIcon,
  Table2, Undo2, Redo2, Save, Download,
  Heading1, Heading2, Heading3, Minus,
  Plus, Loader2
} from 'lucide-react'

interface DocxEditorProps {
  fileUrl: string
  fileName: string
  storagePath: string
  docId: string
  onClose: () => void
  onSaved: () => void
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function TBtn({
  onClick, active = false, disabled = false, title, children
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-all ${
        active
          ? 'bg-violet2 text-white'
          : disabled
          ? 'text-ink4 cursor-not-allowed opacity-40'
          : 'text-ink3 hover:bg-[rgba(0,0,0,0.07)] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function TSep() {
  return <div className="w-px h-5 bg-[rgba(0,0,0,0.1)] mx-0.5" />
}

// ── Main Editor ───────────────────────────────────────────────────────────────
export function DocxEditor({ fileUrl, fileName, storagePath, docId, onClose, onSaved }: DocxEditorProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-violet2 underline' } }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[600px] px-12 py-10 text-ink leading-relaxed',
      },
      handlePaste(view, event) {
        // Allow paste of images from clipboard
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find(i => i.type.startsWith('image/'))
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (file) insertImageFile(file)
          return true
        }
        return false
      },
    },
  })

  // ── Load DOCX and convert ─────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    loadDocx()
  }, [editor])

  async function loadDocx() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(fileUrl)
      if (!res.ok) throw new Error(`No se pudo cargar el archivo (${res.status})`)
      const arrayBuffer = await res.arrayBuffer()

      // Dynamic import mammoth (avoids SSR issues)
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.convertToHtml({ arrayBuffer })

      if (result.messages.length > 0) {
        console.warn('Mammoth warnings:', result.messages)
      }

      editor?.commands.setContent(result.value || '<p>Documento vacío</p>')
    } catch (err: any) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Insert image from file ─────────────────────────────────────────────────
  const insertImageFile = useCallback(async (file: File) => {
    const t = toast.loading('Subiendo imagen...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const ext  = file.name.split('.').pop() || 'png'
      const path = `planificacion_images/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('submissions').upload(path, file, { contentType: file.type })
      if (error) throw error

      const url = supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
      editor?.chain().focus().setImage({ src: url }).run()
      toast.success('Imagen insertada', { id: t })
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }, [editor, supabase])

  // ── Insert link ────────────────────────────────────────────────────────────
  function handleInsertLink() {
    const prev = editor?.getAttributes('link').href || ''
    const url  = window.prompt('URL del enlace:', prev)
    if (url === null) return
    if (url === '') {
      editor?.chain().focus().unsetLink().run()
    } else {
      editor?.chain().focus().setLink({ href: url }).run()
    }
  }

  // ── Insert table ───────────────────────────────────────────────────────────
  function handleInsertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  // ── Save: export as DOCX and upload ───────────────────────────────────────
  async function handleSave() {
    if (!editor) return
    setSaving(true)
    const t = toast.loading('Guardando planificación...')
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ccc; padding: 6px 8px; }
          th { background: #f0f0f0; font-weight: bold; }
          h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3 { font-size: 13pt; }
        </style>
      </head><body>${editor.getHTML()}</body></html>`

      // Dynamic import html-docx-js (browser-only)
      const htmlDocx = (await import('html-docx-js/dist/html-docx')).default
      const blob: Blob = htmlDocx.asBlob(html)

      // Upload to a NEW path (avoids RLS overwrite restriction — bucket only allows INSERT)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_')
      const newPath = `planificacion_docs/${user.id}/${Date.now()}_${baseName}.docx`

      const { error: uploadErr } = await supabase.storage
        .from('submissions')
        .upload(newPath, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      if (uploadErr) throw new Error('Error al subir: ' + uploadErr.message)

      // Update DB record with new path + file size
      const { error: dbErr } = await (supabase as any)
        .from('planificacion_docs')
        .update({
          storage_path: newPath,
          file_size: blob.size,
          file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        .eq('id', docId)
      if (dbErr) throw new Error('Error al actualizar registro: ' + dbErr.message)

      // Clean up old file silently (ignore errors)
      supabase.storage.from('submissions').remove([storagePath]).catch(() => {})

      toast.success('¡Planificación guardada! ✓', { id: t })
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message, { id: t })
    } finally {
      setSaving(false)
    }
  }

  // ── Download locally ───────────────────────────────────────────────────────
  async function handleDownload() {
    if (!editor) return
    const t = toast.loading('Generando archivo...')
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ccc; padding: 6px 8px; }
          th { background: #f0f0f0; }
        </style>
      </head><body>${editor.getHTML()}</body></html>`
      const htmlDocx = (await import('html-docx-js/dist/html-docx')).default
      const blob: Blob = htmlDocx.asBlob(html)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = fileName.replace(/\.[^.]+$/, '') + '_editado.docx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Descargado', { id: t })
    } catch (err: any) {
      toast.error(err.message, { id: t })
    }
  }

  if (!editor) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#f3f3f3] animate-fade-in">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-[rgba(0,0,0,0.1)] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">📝</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink truncate max-w-[300px]">{fileName}</p>
            <p className="text-[10px] text-ink4">Editor de Planificación</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-bg border border-[rgba(0,0,0,0.1)] text-ink3 hover:text-ink hover:border-[rgba(0,0,0,0.2)] transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-violet2 text-white hover:bg-violet shadow-sm transition-colors disabled:opacity-40"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
              : <><Save className="w-3.5 h-3.5" /> Guardar</>
            }
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink3 hover:bg-[rgba(0,0,0,0.07)] hover:text-ink transition-colors"
            title="Cerrar editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Formatting toolbar ───────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 bg-white border-b border-[rgba(0,0,0,0.08)] flex-shrink-0 flex-wrap">
        {/* Undo / Redo */}
        <TBtn onClick={() => editor.chain().focus().undo().run()} title="Deshacer (Ctrl+Z)" disabled={!editor.can().undo()}>
          <Undo2 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} title="Rehacer (Ctrl+Y)" disabled={!editor.can().redo()}>
          <Redo2 className="w-3.5 h-3.5" />
        </TBtn>

        <TSep />

        {/* Headings */}
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1">
          <Heading1 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2">
          <Heading2 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3">
          <Heading3 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Párrafo normal">
          <span className="text-[10px] font-bold">T</span>
        </TBtn>

        <TSep />

        {/* Text formatting */}
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado (Ctrl+U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
          <Strikethrough className="w-3.5 h-3.5" />
        </TBtn>

        <TSep />

        {/* Alignment */}
        <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinear izquierda">
          <AlignLeft className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrar">
          <AlignCenter className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinear derecha">
          <AlignRight className="w-3.5 h-3.5" />
        </TBtn>

        <TSep />

        {/* Lists */}
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista con viñetas">
          <List className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </TBtn>

        <TSep />

        {/* Link */}
        <TBtn onClick={handleInsertLink} active={editor.isActive('link')} title="Insertar enlace">
          <Link2 className="w-3.5 h-3.5" />
        </TBtn>

        {/* Image */}
        <TBtn
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = e => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) insertImageFile(file)
            }
            input.click()
          }}
          title="Insertar imagen"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </TBtn>

        {/* Table */}
        <TBtn onClick={handleInsertTable} title="Insertar tabla 3×3">
          <Table2 className="w-3.5 h-3.5" />
        </TBtn>

        {editor.isActive('table') && (
          <>
            <TSep />
            <TBtn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Columna antes">
              <span className="text-[9px] font-bold">+Col←</span>
            </TBtn>
            <TBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Columna después">
              <span className="text-[9px] font-bold">+Col→</span>
            </TBtn>
            <TBtn onClick={() => editor.chain().focus().addRowBefore().run()} title="Fila antes">
              <span className="text-[9px] font-bold">+Fil↑</span>
            </TBtn>
            <TBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Fila después">
              <span className="text-[9px] font-bold">+Fil↓</span>
            </TBtn>
            <TBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Eliminar fila">
              <Minus className="w-3 h-3" />
            </TBtn>
          </>
        )}

        <TSep />
        <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea divisoria">
          <Minus className="w-3.5 h-3.5" />
        </TBtn>
      </div>

      {/* ── Editor area ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-ink3">
            <Loader2 className="w-10 h-10 animate-spin text-violet2" />
            <p className="text-sm font-medium">Cargando documento...</p>
            <p className="text-xs text-ink4">Convirtiendo DOCX a editor...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-rose-500">
            <p className="text-lg">⚠️</p>
            <p className="text-sm font-semibold">Error al cargar el documento</p>
            <p className="text-xs text-ink4 max-w-xs text-center">{loadError}</p>
            <button onClick={loadDocx} className="btn-primary text-xs px-4 py-2 mt-2">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="max-w-[850px] mx-auto my-6 bg-white shadow-lg rounded-sm border border-[rgba(0,0,0,0.08)]">
            {/* Page content */}
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {/* ── Status bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white border-t border-[rgba(0,0,0,0.08)] text-[10px] text-ink4 flex-shrink-0">
        <span>
          {editor.storage.characterCount?.characters?.() ?? editor.getText().length} caracteres
          · {editor.getText().split(/\s+/).filter(Boolean).length} palabras
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Listo para editar
        </span>
      </div>
    </div>
  )
}
