// src/components/planner/MarkdownRenderer.tsx
'use client'

import { useMemo } from 'react'

/**
 * Renders markdown content (headers, tables, bold, lists, line breaks)
 * as styled HTML without external dependencies.
 */
export function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => parseMarkdown(content), [content])

  return (
    <div
      className="planificacion-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineFormat(text: string): string {
  // Markdown links [label](url) — rendered antes de bold/italic para que
  // asteriscos dentro de la URL no rompan
  let result = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-600 underline hover:text-violet-800 break-all">$1</a>'
  )
  // URLs sueltas (auto-linkify)
  result = result.replace(
    /(^|[\s(])((https?:\/\/)[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-600 underline hover:text-violet-800 break-all">$2</a>'
  )
  // Bold **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')
  // Italic *text* or _text_
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code `text`
  result = result.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-gray-100 text-[11px] font-mono">$1</code>')
  // <br> tags
  result = result.replace(/<br\s*\/?>/gi, '<br/>')
  return result
}

export function parseMarkdown(md: string): string {
  const lines = md.split('\n')
  const output: string[] = []
  let i = 0
  let inList = false

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (trimmed === '') {
      if (inList) { output.push('</ul>'); inList = false }
      i++
      continue
    }

    // Table detection: line starts with |
    if (trimmed.startsWith('|')) {
      if (inList) { output.push('</ul>'); inList = false }
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      output.push(renderTable(tableLines))
      continue
    }

    // Headers
    if (trimmed.startsWith('######')) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push(`<h6 class="text-xs font-bold mt-4 mb-1 text-gray-600 uppercase tracking-wide">${inlineFormat(trimmed.slice(6).trim())}</h6>`)
      i++; continue
    }
    if (trimmed.startsWith('#####')) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push(`<h5 class="text-xs font-bold mt-4 mb-1 text-gray-700">${inlineFormat(trimmed.slice(5).trim())}</h5>`)
      i++; continue
    }
    if (trimmed.startsWith('####')) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push(`<h4 class="text-sm font-bold mt-5 mb-2 text-gray-800">${inlineFormat(trimmed.slice(4).trim())}</h4>`)
      i++; continue
    }
    if (trimmed.startsWith('###')) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push(`<h3 class="text-sm font-bold mt-6 mb-2 text-gray-800 border-b border-gray-200 pb-1">${inlineFormat(trimmed.slice(3).trim())}</h3>`)
      i++; continue
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push(`<h2 class="text-base font-bold mt-8 mb-3 text-violet-700 flex items-center gap-2"><span class="w-1 h-5 bg-violet-500 rounded-full inline-block"></span>${inlineFormat(trimmed.slice(3).trim())}</h2>`)
      i++; continue
    }
    if (trimmed.startsWith('# ')) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push(`<h1 class="text-lg font-bold mt-6 mb-3 text-center text-gray-900 border-b-2 border-violet-300 pb-2 uppercase tracking-wider">${inlineFormat(trimmed.slice(2).trim())}</h1>`)
      i++; continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inList) { output.push('</ul>'); inList = false }
      output.push('<hr class="my-4 border-gray-200"/>')
      i++; continue
    }

    // List items (- or * or numbered)
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      if (!inList) { output.push('<ul class="list-disc list-inside space-y-1 my-2 ml-2 text-sm text-gray-700">'); inList = true }
      const content = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')
      output.push(`<li>${inlineFormat(content)}</li>`)
      i++; continue
    }

    // Regular paragraph
    if (inList) { output.push('</ul>'); inList = false }
    output.push(`<p class="text-sm text-gray-700 leading-relaxed my-1.5">${inlineFormat(trimmed)}</p>`)
    i++
  }

  if (inList) output.push('</ul>')
  return output.join('\n')
}

function renderTable(lines: string[]): string {
  // Filter out separator rows (|---|---|)
  const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l))
  if (dataRows.length === 0) return ''

  const parseRow = (line: string): string[] => {
    return line.split('|').slice(1, -1).map(cell => cell.trim())
  }

  const headerCells = parseRow(dataRows[0])
  const bodyRows = dataRows.slice(1)

  let html = '<div class="overflow-x-auto my-4 rounded-lg border border-gray-300">'
  html += '<table class="w-full text-[11px] border-collapse">'

  // Header
  html += '<thead><tr class="bg-gray-100">'
  headerCells.forEach(cell => {
    html += `<th class="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800 text-[11px]">${inlineFormat(cell)}</th>`
  })
  html += '</tr></thead>'

  // Body
  if (bodyRows.length > 0) {
    html += '<tbody>'
    bodyRows.forEach((row, idx) => {
      const cells = parseRow(row)
      const bg = idx % 2 === 0 ? '' : 'bg-gray-50'
      html += `<tr class="${bg}">`
      cells.forEach((cell, ci) => {
        const isFirstCol = ci === 0
        html += `<td class="border border-gray-300 px-3 py-2 ${isFirstCol ? 'font-medium' : ''} text-gray-700 align-top">${inlineFormat(cell)}</td>`
      })
      html += '</tr>'
    })
    html += '</tbody>'
  }

  html += '</table></div>'
  return html
}
