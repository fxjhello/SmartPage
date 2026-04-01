import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.min.mjs'

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
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join('')
    pages.push(text)
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
