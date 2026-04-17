'use client'

import { useState } from 'react'
import { FileText, ExternalLink, Eye, EyeOff } from 'lucide-react'

interface Props {
  url: string
  name?: string
  compact?: boolean
}

export function FilePreview({ url, name, compact = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  
  const lower = url.toLowerCase()
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(lower)
  const isPdf = /\.pdf/i.test(lower)
  const isOffice = /\.(docx?|xlsx?|pptx?|odt|ods|odp)/i.test(lower)

  // URL for Microsoft Office Online Viewer
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

  return (
    <div className="flex flex-col gap-2 w-full max-w-2xl">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen) }}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all border ${
            isOpen
              ? 'bg-violet-100 text-violet-700 border-violet-200 shadow-sm'
              : 'bg-surface text-ink3 border-surface2 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 shadow-sm'
          }`}
        >
          {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
          {isOpen ? 'Ocultar vista previa' : 'Ver archivo'}
        </button>
        <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors border border-indigo-100 shadow-sm">
          <ExternalLink size={14} className="flex-shrink-0" />
          <span>{compact ? 'Abrir' : 'Abrir en pestaña nueva'}</span>
        </a>
      </div>

      {/* Collapsible Preview */}
      {isOpen && (
        <div className="animate-fade-in mt-1">
          {isImage ? (
            <a href={url} target="_blank" rel="noreferrer" className="block max-w-xs overflow-hidden rounded-xl border border-surface2 hover:shadow-md transition-shadow">
              <img src={url} alt="Vista previa" className="w-full h-auto object-contain max-h-[300px]" />
            </a>
          ) : isPdf ? (
            <div className="overflow-hidden rounded-xl border border-surface2 bg-white shadow-sm">
              <iframe src={url} className="w-full h-[400px] border-none" title="Vista previa del PDF" />
            </div>
          ) : isOffice ? (
            <div className="overflow-hidden rounded-xl border border-surface2 bg-white shadow-sm">
              <iframe src={officeViewerUrl} className="w-full h-[450px] border-none" title="Vista previa del documento" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-surface2 bg-white shadow-sm">
              <iframe src={url} className="w-full h-[350px] border-none" title="Vista previa del archivo" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
