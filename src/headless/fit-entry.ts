import { parse } from 'marked'

// ─── Globals ───────────────────────────────────────────────
const a4Page = document.getElementById('a4-page')!
const a4Content = document.getElementById('a4-content')!
let lastLoadedFont = ''

const THEME_CLASSES = [
  'theme-classic', 'theme-warm', 'theme-academic', 'theme-editorial',
  'theme-smartisan', 'theme-noir', 'theme-mint', 'theme-ink', 'theme-tech', 'theme-kraft',
]

const PAGE_W = 794
const PAGE_H = 1123

// ─── Style Application ─────────────────────────────────────
function applyStyles(fontFamily: string, theme: string, fontSize: number,
  lineHeightRatio: number, marginMm: number, paragraphSpacing: number, firstLineIndent: number): void {
  a4Page.classList.remove(...THEME_CLASSES)
  a4Page.classList.add(`theme-${theme}`)

  a4Page.style.padding = `${marginMm}mm`
  a4Page.style.fontFamily = `"${fontFamily}", -apple-system, sans-serif`
  a4Page.style.fontSize = `${fontSize}px`
  a4Page.style.lineHeight = String(lineHeightRatio)
  a4Page.style.setProperty('--ps', `${paragraphSpacing}em`)
  a4Page.style.setProperty('--fi', `${firstLineIndent}em`)
}

// ─── Core: render markdown → A4 page, return font size ────
async function renderMarkdown(
  markdown: string,
  fontFamily: string,
  theme: string,
  marginMm: number,
  lineHeightRatio: number,
  paragraphSpacing: number,
  firstLineIndent: number,
): Promise<number> {
  if (lastLoadedFont !== fontFamily) {
    await Promise.all([
      document.fonts.load(`16px "${fontFamily}"`),
      document.fonts.load(`700 16px "${fontFamily}"`),
      document.fonts.load(`16px "Fira Code"`),
    ])
    lastLoadedFont = fontFamily
  }

  const html = await parse(markdown)
  applyStyles(fontFamily, theme, 16, lineHeightRatio, marginMm, paragraphSpacing, firstLineIndent)

  const doc = new DOMParser().parseFromString(html, 'text/html')
  a4Content.replaceChildren(...Array.from(doc.body.childNodes).map(n => n.cloneNode(true)))

  const availableHeight = a4Page.clientHeight
    - parseFloat(getComputedStyle(a4Page).paddingTop)
    - parseFloat(getComputedStyle(a4Page).paddingBottom)

  // Check if 72px fits
  applyStyles(fontFamily, theme, 72, lineHeightRatio, marginMm, paragraphSpacing, firstLineIndent)
  if (a4Content.scrollHeight <= availableHeight) return 72

  // Binary search
  let lo = 6, hi = 72
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2
    applyStyles(fontFamily, theme, mid, lineHeightRatio, marginMm, paragraphSpacing, firstLineIndent)
    void a4Content.scrollHeight
    if (a4Content.scrollHeight <= availableHeight) lo = mid; else hi = mid
  }

  const finalFontSize = Math.floor(lo * 4) / 4
  applyStyles(fontFamily, theme, finalFontSize, lineHeightRatio, marginMm, paragraphSpacing, firstLineIndent)
  return finalFontSize
}

// ─── Expose to Playwright ──────────────────────────────────
interface FitRequest {
  markdown: string; theme: string; fontFamily: string;
  monoFontFamily?: string; marginMm: number; lineHeightRatio: number;
  paragraphSpacing: number; firstLineIndent: number;
}
interface FitResponse {
  fontSize: number; overflow: boolean; scrollHeight: number; pageHeight: number;
}

// Override .a4-page CSS for headless mode
a4Page.style.position = 'relative'
a4Page.style.top = 'auto'
a4Page.style.left = 'auto'
a4Page.style.width = `${PAGE_W}px`
a4Page.style.height = `${PAGE_H}px`
a4Page.style.boxSizing = 'border-box'
a4Page.style.overflow = 'hidden'

;(window as any).__smartpageRender = async (req: FitRequest): Promise<FitResponse> => {
  await document.fonts.ready
  await Promise.all([
    document.fonts.load(`16px "${req.fontFamily}"`),
    document.fonts.load(`700 16px "${req.fontFamily}"`),
    document.fonts.load(`16px "Fira Code"`),
  ])
  await new Promise(r => setTimeout(r, 300))

  const fontSize = await renderMarkdown(
    req.markdown, req.fontFamily, req.theme,
    req.marginMm, req.lineHeightRatio, req.paragraphSpacing, req.firstLineIndent,
  )

  const availableHeight = a4Page.clientHeight
    - parseFloat(getComputedStyle(a4Page).paddingTop)
    - parseFloat(getComputedStyle(a4Page).paddingBottom)

  console.log(`[SmartPage] fontSize=${fontSize.toFixed(1)}px, scroll=${a4Content.scrollHeight}, avail=${availableHeight}`)

  return {
    fontSize, overflow: a4Content.scrollHeight > availableHeight,
    scrollHeight: a4Content.scrollHeight, pageHeight: availableHeight,
  }
}

;(window as any).__smartpageReady = true
