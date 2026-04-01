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
    const textItems = content.items
      .filter(item => 'str' in item && item.str.trim())
      .map(item => {
        const t = item as any
        return {
          str: t.str.trim(),
          x: t.transform[4],
          y: Math.round(t.transform[5]),
          fontSize: Math.round(Math.sqrt(t.transform[0] ** 2 + t.transform[1] ** 2)),
        }
      })

    if (textItems.length === 0) {
      pages.push('')
      continue
    }

    // Sort by Y (top-to-bottom), then X (left-to-right)
    textItems.sort((a, b) => b.y - a.y || a.x - b.x)

    // Group into lines by Y proximity (threshold: 4px)
    const lines: { items: typeof textItems; y: number }[] = []
    let currentLine = [textItems[0]]
    let currentY = textItems[0].y
    for (let j = 1; j < textItems.length; j++) {
      if (Math.abs(textItems[j].y - currentY) <= 4) {
        currentLine.push(textItems[j])
      } else {
        currentLine.sort((a, b) => a.x - b.x)
        lines.push({ items: currentLine, y: currentY })
        currentLine = [textItems[j]]
        currentY = textItems[j].y
      }
    }
    currentLine.sort((a, b) => a.x - b.x)
    lines.push({ items: currentLine, y: currentY })

    // Detect base font size (most common)
    const freq: Record<number, number> = {}
    for (const item of textItems) {
      freq[item.fontSize] = (freq[item.fontSize] || 0) + 1
    }
    const baseFontSize = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0]) || 12

    // Detect average line gap for paragraph detection
    const gaps: number[] = []
    for (let j = 1; j < lines.length; j++) {
      gaps.push(lines[j - 1].y - lines[j].y)
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 12
    const paragraphThreshold = avgGap * 1.8

    // Build Markdown with heading/paragraph detection
    const mdLines: string[] = []
    for (let j = 0; j < lines.length; j++) {
      const lineText = lines[j].items.map(it => it.str).join(' ')
      const lineFontSize = Math.round(lines[j].items.reduce((s, it) => s + it.fontSize, 0) / lines[j].items.length)
      const gap = j > 0 ? lines[j - 1].y - lines[j].y : 0

      // Heading detection: font size > base + 30%
      if (lineFontSize >= baseFontSize * 1.3) {
        const level = lineFontSize >= baseFontSize * 2 ? 1 : lineFontSize >= baseFontSize * 1.6 ? 2 : 3
        mdLines.push('')
        mdLines.push(`${'#'.repeat(level)} ${lineText}`)
        mdLines.push('')
      }
      // Paragraph break: gap > threshold
      else if (gap > paragraphThreshold && gap > 0) {
        mdLines.push('')
        mdLines.push(lineText)
      }
      // Normal line
      else {
        mdLines.push(lineText)
      }
    }

    pages.push(mdLines.join('\n').trim())
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
