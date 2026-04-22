// src/lib/extract/extractDocxRaw.ts
// Fallback DOCX text extractor that parses the raw XML inside the DOCX ZIP.
// Works with complex tables where mammoth fails silently.

import JSZip from 'jszip'

/**
 * Extracts raw text from a DOCX buffer by parsing the internal XML directly.
 * DOCX files are ZIP archives containing XML files.
 * The main content lives in `word/document.xml`.
 *
 * This function extracts all <w:t> (text run) elements,
 * respects paragraph breaks (<w:p>), and reconstructs table
 * rows/cells with pipe separators for readability.
 */
export async function extractDocxRaw(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)

  // The primary content file
  const docXml = zip.file('word/document.xml')
  if (!docXml) {
    throw new Error('No se encontró word/document.xml dentro del archivo DOCX')
  }

  const xml = await docXml.async('string')
  return parseDocumentXml(xml)
}

/**
 * Parses the raw XML of word/document.xml and extracts structured text.
 * Handles paragraphs, tables, rows, and cells.
 */
function parseDocumentXml(xml: string): string {
  const output: string[] = []

  // First, let's check if there are tables
  const hasTables = xml.includes('<w:tbl')

  if (hasTables) {
    // Process with table awareness
    processWithTables(xml, output)
  } else {
    // Simple paragraph extraction
    processSimpleParagraphs(xml, output)
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Extracts text handling table structures with | separators.
 */
function processWithTables(xml: string, output: string[]): void {
  // Split the body content into segments: tables and non-table content
  // We process the XML sequentially to maintain document order

  let pos = 0
  const bodyStart = xml.indexOf('<w:body')
  const bodyEnd = xml.lastIndexOf('</w:body>')
  if (bodyStart === -1 || bodyEnd === -1) {
    // Fallback: just extract all text
    processSimpleParagraphs(xml, output)
    return
  }

  const body = xml.substring(bodyStart, bodyEnd)
  pos = 0

  while (pos < body.length) {
    const tableStart = body.indexOf('<w:tbl', pos)

    if (tableStart === -1) {
      // No more tables, process remaining paragraphs
      const remaining = body.substring(pos)
      extractParagraphs(remaining, output)
      break
    }

    // Process paragraphs before this table
    if (tableStart > pos) {
      const before = body.substring(pos, tableStart)
      extractParagraphs(before, output)
    }

    // Find end of table
    const tableEnd = findClosingTag(body, '<w:tbl', '</w:tbl>', tableStart)
    if (tableEnd === -1) {
      // Malformed XML, extract what we can
      const remaining = body.substring(tableStart)
      extractParagraphs(remaining, output)
      break
    }

    const tableXml = body.substring(tableStart, tableEnd)
    extractTable(tableXml, output)

    pos = tableEnd
  }
}

/**
 * Finds the matching closing tag, handling nesting.
 */
function findClosingTag(xml: string, openTag: string, closeTag: string, startPos: number): number {
  let depth = 0
  let pos = startPos

  while (pos < xml.length) {
    const nextOpen = xml.indexOf(openTag, pos + 1)
    const nextClose = xml.indexOf(closeTag, pos + (depth === 0 ? 1 : 0))

    if (nextClose === -1) return -1

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      pos = nextOpen + openTag.length
    } else {
      if (depth === 0) {
        return nextClose + closeTag.length
      }
      depth--
      pos = nextClose + closeTag.length
    }
  }

  return -1
}

/**
 * Extracts text from a table XML block.
 * Outputs rows with | separators for cells.
 */
function extractTable(tableXml: string, output: string[]): void {
  output.push('') // blank line before table

  // Extract rows
  const rowRegex = /<w:tr[\s>]/g
  let match: RegExpExecArray | null
  const rowPositions: number[] = []

  while ((match = rowRegex.exec(tableXml)) !== null) {
    rowPositions.push(match.index)
  }

  for (let i = 0; i < rowPositions.length; i++) {
    const rowStart = rowPositions[i]
    const rowEnd = i + 1 < rowPositions.length
      ? rowPositions[i + 1]
      : tableXml.length

    const rowXml = tableXml.substring(rowStart, rowEnd)
    const cells = extractCells(rowXml)

    if (cells.length > 0) {
      output.push('| ' + cells.join(' | ') + ' |')
    }
  }

  output.push('') // blank line after table
}

/**
 * Extracts cell text from a table row XML.
 */
function extractCells(rowXml: string): string[] {
  const cells: string[] = []
  const cellRegex = /<w:tc[\s>]/g
  let match: RegExpExecArray | null
  const cellPositions: number[] = []

  while ((match = cellRegex.exec(rowXml)) !== null) {
    cellPositions.push(match.index)
  }

  for (let i = 0; i < cellPositions.length; i++) {
    const cellStart = cellPositions[i]
    const cellEnd = i + 1 < cellPositions.length
      ? cellPositions[i + 1]
      : rowXml.length

    const cellXml = rowXml.substring(cellStart, cellEnd)
    const texts: string[] = []
    extractParagraphs(cellXml, texts)
    const cellText = texts.join(' ').replace(/\s+/g, ' ').trim()
    cells.push(cellText || '')
  }

  return cells
}

/**
 * Extracts paragraph text from XML, one paragraph per line.
 */
function extractParagraphs(xml: string, output: string[]): void {
  // Match <w:p ...>...</w:p> blocks
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g
  let match: RegExpExecArray | null

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const paraXml = match[0]
    const text = extractTextRuns(paraXml)
    if (text.trim()) {
      output.push(text.trim())
    }
  }
}

/**
 * Extracts all <w:t> text content from a block of XML.
 */
function extractTextRuns(xml: string): string {
  const parts: string[] = []
  // Match <w:t>text</w:t> or <w:t xml:space="preserve">text</w:t>
  const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g
  let match: RegExpExecArray | null

  while ((match = textRegex.exec(xml)) !== null) {
    const text = match[1]
    if (text) {
      // Decode basic XML entities
      parts.push(
        text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      )
    }
  }

  return parts.join('')
}

/**
 * Simple fallback: extract ALL <w:t> text from the XML.
 */
function processSimpleParagraphs(xml: string, output: string[]): void {
  extractParagraphs(xml, output)
}
