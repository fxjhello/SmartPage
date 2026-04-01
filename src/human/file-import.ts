import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// Use Vite-resolved URL for PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

// ─── HTML to Markdown converter ──────────────────────────────────

function htmlToMd(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return nodeToMd(doc.body)
}

function nodeToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const childrenMd = Array.from(el.childNodes).map(nodeToMd).join('')

  switch (tag) {
    case 'h1': return `\n# ${childrenMd.trim()}\n`
    case 'h2': return `\n## ${childrenMd.trim()}\n`
    case 'h3': return `\n### ${childrenMd.trim()}\n`
    case 'h4': return `\n#### ${childrenMd.trim()}\n`
    case 'h5': return `\n##### ${childrenMd.trim()}\n`
    case 'h6': return `\n###### ${childrenMd.trim()}\n`
    case 'p': return `\n${childrenMd.trim()}\n`
    case 'br': return '\n'
    case 'strong': case 'b': return `**${childrenMd.trim()}**`
    case 'em': case 'i': return `*${childrenMd.trim()}*`
    case 'u': return childrenMd
    case 's': case 'strike': case 'del': return `~~${childrenMd.trim()}~~`
    case 'li': return `- ${childrenMd.trim()}\n`
    case 'ul': case 'ol': return `\n${childrenMd}\n`
    case 'blockquote': return `\n> ${childrenMd.trim()}\n`
    case 'code': return `\`${childrenMd.trim()}\``
    case 'pre': return `\n\`\`\`\n${childrenMd.trim()}\n\`\`\`\n`
    case 'a': {
      const href = el.getAttribute('href')
      const text = childrenMd.trim()
      return href ? `[${text}](${href})` : text
    }
    case 'img': {
      const src = el.getAttribute('src') || ''
      const alt = el.getAttribute('alt') || ''
      return src ? `\n![${alt}](${src})\n` : ''
    }
    case 'hr': return '\n---\n'
    case 'table': return tableToMd(el)
    case 'thead': case 'tbody': return childrenMd
    case 'tr': return `| ${childrenMd.trim()} |\n`
    case 'th': return `${childrenMd.trim()} |`
    case 'td': return `${childrenMd.trim()} |`
    case 'div': case 'span': return childrenMd
    default: return childrenMd
  }
}

function tableToMd(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  const cells: string[][] = rows.map(row =>
    Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '')
  )

  // Add separator row after header
  const headerLen = cells[0]?.length || 0
  const separator = Array(headerLen).fill('---').join(' | ')
  const lines = cells.map(row => `| ${row.join(' | ')} |`)
  lines.splice(1, 0, `| ${separator} |`)

  return `\n${lines.join('\n')}\n`
}

// ─── PDF Layout Analysis ─────────────────────────────────────────

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

interface Line {
  items: TextItem[]
  y: number
  xMin: number
  xMax: number
  text: string
  avgFontSize: number
  column: number
}

/**
 * Extract text items from a PDF page with layout info
 */
function extractTextItems(content: any): TextItem[] {
  return content.items
    .filter((item: any) => 'str' in item && item.str.trim())
    .map((item: any) => {
      const t = item
      const fontSize = Math.sqrt(t.transform[0] ** 2 + t.transform[1] ** 2)
      return {
        str: t.str.trim(),
        x: t.transform[4],
        y: t.transform[5],
        width: t.width || 0,
        height: t.height || 0,
        fontSize,
      }
    })
}

/**
 * Sort items top-to-bottom, then left-to-right
 */
function sortItems(items: TextItem[]): void {
  items.sort((a, b) => {
    const yDiff = b.y - a.y
    // Use font-size-relative threshold for Y grouping
    const threshold = Math.min(a.fontSize, b.fontSize) * 0.3
    return Math.abs(yDiff) < threshold
      ? a.x - b.x
      : yDiff
  })
}

/**
 * Group text items into lines using adaptive Y threshold
 */
function groupIntoLines(items: TextItem[]): Line[] {
  if (items.length === 0) return []

  sortItems(items)

  // Calculate median font size for adaptive threshold
  const sizes = items.map(i => i.fontSize).sort((a, b) => a - b)
  const medianFontSize = sizes[Math.floor(sizes.length / 2)]
  const yThreshold = medianFontSize * 0.4 // 40% of median font size

  const lines: Line[] = []
  let currentItems = [items[0]]
  let currentY = items[0].y

  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i].y - currentY) <= yThreshold) {
      currentItems.push(items[i])
    } else {
      currentItems.sort((a, b) => a.x - b.x)
      lines.push(buildLine(currentItems, currentY))
      currentItems = [items[i]]
      currentY = items[i].y
    }
  }
  currentItems.sort((a, b) => a.x - b.x)
  lines.push(buildLine(currentItems, currentY))

  return lines
}

/**
 * Build a Line from grouped text items, with proper spacing
 */
function buildLine(items: TextItem[], y: number): Line {
  // Build text with proper spacing based on actual positions
  let text = ''
  for (let i = 0; i < items.length; i++) {
    if (i === 0) {
      text = items[i].str
    } else {
      const prev = items[i - 1]
      const gap = items[i].x - (prev.x + prev.width)
      const spaceWidth = prev.fontSize * 0.3 // typical space width
      if (gap > spaceWidth * 2) {
        // Large gap — likely column separator or tab
        text += '  ' + items[i].str
      } else if (gap > spaceWidth * 0.5) {
        text += ' ' + items[i].str
      } else {
        // Overlapping or very close — concatenate directly (CJK)
        text += items[i].str
      }
    }
  }

  const xMin = Math.min(...items.map(it => it.x))
  const xMax = Math.max(...items.map(it => it.x + it.width))
  const avgFontSize = items.reduce((s, it) => s + it.fontSize, 0) / items.length

  return { items, y, xMin, xMax, text, avgFontSize, column: 0 }
}

/**
 * Detect columns by analyzing X-distribution of lines
 * Returns number of columns and assigns column index to each line
 */
function detectColumns(lines: Line[]): number {
  if (lines.length < 3) {
    lines.forEach(l => l.column = 0)
    return 1
  }

  // Find the page width from the rightmost item
  const maxX = Math.max(...lines.map(l => l.xMax))
  const minX = Math.min(...lines.map(l => l.xMin))
  const pageWidth = maxX - minX

  // Build histogram of X positions
  const buckets = 10
  const bucketWidth = pageWidth / buckets
  const xPositions: number[] = []
  for (const line of lines) {
    xPositions.push(line.xMin)
  }

  // Count items in each horizontal region
  const counts = new Array(buckets).fill(0)
  for (const x of xPositions) {
    const bucket = Math.min(Math.floor((x - minX) / bucketWidth), buckets - 1)
    counts[bucket]++
  }

  // Find gaps (buckets with very few items)
  const maxCount = Math.max(...counts)
  const gapThreshold = maxCount * 0.15 // less than 15% of max = gap

  // Find column centers (peaks in histogram)
  const peaks: number[] = []
  for (let i = 1; i < buckets - 1; i++) {
    if (counts[i] > counts[i - 1] && counts[i] > counts[i + 1] && counts[i] > maxCount * 0.3) {
      peaks.push(i)
    }
  }

  // Also check for a clear middle gap (two-column layout)
  const middleBucket = Math.floor(buckets / 2)
  const middleCount = counts[middleBucket]
  const leftSum = counts.slice(0, middleBucket).reduce((a, b) => a + b, 0)
  const rightSum = counts.slice(middleBucket + 1).reduce((a, b) => a + b, 0)

  if (middleCount < gapThreshold && leftSum > 0 && rightSum > 0 && peaks.length >= 2) {
    // Two-column layout detected
    const midX = minX + pageWidth / 2
    for (const line of lines) {
      line.column = line.xMin < midX ? 0 : 1
    }
    return 2
  }

  // Single column
  lines.forEach(l => l.column = 0)
  return 1
}

/**
 * Detect and filter header/footer by finding repeated text at page edges
 */
function filterHeaderFooter(lines: Line[], pageHeight: number): Line[] {
  if (lines.length < 3) return lines

  // Top 5% and bottom 5% of page are header/footer zones
  const topThreshold = pageHeight * 0.92 // Y is from bottom
  const bottomThreshold = pageHeight * 0.08

  // Remove header/footer zone lines that look like page numbers or short titles
  const filtered = lines.filter(l => {
    if (l.y > topThreshold) {
      // Header zone: remove if it's short text (page number, title)
      return l.text.length > 40
    }
    if (l.y < bottomThreshold) {
      // Footer zone: remove if it looks like page number or URL
      return !/^\d+$|^[·\-\—]+\d+/.test(l.text.trim()) && l.text.length > 20
    }
    return true
  })

  return filtered.length > 0 ? filtered : lines
}

/**
 * Detect list items by looking for bullet/number prefixes
 */
function isListItem(text: string): boolean {
  const trimmed = text.trim()
  // Bullet characters
  if (/^[•·●○◦■□▪▫–\-]\s/.test(trimmed)) return true
  // Numbered: 1. 2) (1) etc.
  if (/^\d{1,3}[.、)]\s/.test(trimmed)) return true
  // Letter bullets: a) b) A. B.
  if (/^[a-zA-Z][.、)]\s/.test(trimmed)) return true
  return false
}

/**
 * Classify a line as heading, list item, or normal text
 */
function classifyLine(line: Line, baseFontSize: number): { type: 'heading' | 'list' | 'normal'; level?: number } {
  const fontSizeRatio = line.avgFontSize / baseFontSize

  // Heading: significantly larger font
  if (fontSizeRatio >= 1.35) {
    const level = fontSizeRatio >= 2.0 ? 1 : fontSizeRatio >= 1.6 ? 2 : 3
    return { type: 'heading', level }
  }

  // List item
  if (isListItem(line.text)) {
    return { type: 'list' }
  }

  return { type: 'normal' }
}

/**
 * Convert PDF page text items to Markdown with layout analysis
 */
function pageToMarkdown(items: TextItem[], pageHeight: number): string {
  if (items.length === 0) return ''

  // Step 1: Group into lines
  let lines = groupIntoLines(items)

  // Step 2: Filter header/footer
  lines = filterHeaderFooter(lines, pageHeight)

  if (lines.length === 0) return ''

  // Step 3: Detect columns
  const numColumns = detectColumns(lines)

  // Step 4: Calculate font size stats
  const allSizes = items.map(i => i.fontSize)
  const sortedSizes = [...allSizes].sort((a, b) => a - b)
  const baseFontSize = sortedSizes[Math.floor(sortedSizes.length * 0.5)] // median

  // Step 5: Calculate gap statistics (use median, not mean)
  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    gaps.push(lines[i - 1].y - lines[i].y)
  }
  const sortedGaps = [...gaps].filter(g => g > 0).sort((a, b) => a - b)
  const medianGap = sortedGaps.length > 0 ? sortedGaps[Math.floor(sortedGaps.length / 2)] : baseFontSize
  const paragraphThreshold = medianGap * 2.0

  // Step 6: Build Markdown
  const mdLines: string[] = []

  // For multi-column, process columns separately
  if (numColumns > 1) {
    for (let col = 0; col < numColumns; col++) {
      const colLines = lines.filter(l => l.column === col)
      if (col > 0 && mdLines.length > 0) {
        mdLines.push('')
      }
      buildMarkdownLines(colLines, mdLines, baseFontSize, paragraphThreshold)
    }
  } else {
    buildMarkdownLines(lines, mdLines, baseFontSize, paragraphThreshold)
  }

  return mdLines.join('\n').trim()
}

/**
 * Build markdown lines from a set of lines
 */
function buildMarkdownLines(
  lines: Line[],
  output: string[],
  baseFontSize: number,
  paragraphThreshold: number,
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prevLine = i > 0 ? lines[i - 1] : null
    const gap = prevLine ? prevLine.y - line.y : 0
    const classification = classifyLine(line, baseFontSize)

    switch (classification.type) {
      case 'heading': {
        // Add blank line before heading
        if (output.length > 0 && output[output.length - 1] !== '') {
          output.push('')
        }
        const prefix = '#'.repeat(classification.level!)
        output.push(`${prefix} ${line.text}`)
        output.push('')
        break
      }
      case 'list': {
        // Normalize list prefix to "- "
        const normalized = line.text.replace(/^[•·●○◦■□▪▫–\-]\s*/, '- ').replace(/^\d{1,3}[.、)]\s/, '- ')
        output.push(normalized)
        break
      }
      case 'normal': {
        // Paragraph break detection
        if (gap > paragraphThreshold && gap > 0 && output.length > 0) {
          output.push('')
        }
        output.push(line.text)
        break
      }
    }
  }
}

// ─── File parsers ────────────────────────────────────────────────

export async function parseExcel(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer)
  const sheets: string[] = []

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const html = XLSX.utils.sheet_to_html(sheet)
    const md = htmlToMd(html)
    sheets.push(sheet.SheetNames?.length ? md : `## ${name}\n\n${md}`)
  }

  return sheets.join('\n---\n').trim()
}

export async function parseDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  return htmlToMd(result.value).trim()
}

export async function parsePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const items = extractTextItems(content)
    const md = pageToMarkdown(items, viewport.height)
    pages.push(md)
  }

  return pages.join('\n\n').trim()
}

export const SUPPORTED_TYPES = [
  '.pdf', '.docx',
  '.xlsx', '.xls',
]

export async function parseFile(file: File): Promise<string> {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()

  switch (ext) {
    case '.xlsx': case '.xls':
      return parseExcel(file)
    case '.docx':
      return parseDocx(file)
    case '.pdf':
      return parsePdf(file)
    default:
      throw new Error(`不支持的文件格式: ${ext}`)
  }
}
