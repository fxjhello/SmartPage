import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, extname, basename } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FitOptions {
  /** Markdown content string */
  markdown: string
  /** Theme name: classic | warm | academic | editorial | smartisan | noir | mint | ink | tech | kraft */
  theme?: string
  /** Font family name */
  fontFamily?: string
  /** Margin in millimeters */
  marginMm?: number
  /** Line height ratio */
  lineHeightRatio?: number
  /** Paragraph spacing in em */
  paragraphSpacing?: number
  /** First line indent in em */
  firstLineIndent?: number
  /** Output directory (default: current working directory) */
  outputDir?: string
  /** Output filename without extension (default: "output") */
  outputName?: string
  /** Vite dev server base URL (default: auto-start via vite preview) */
  baseUrl?: string
}

export interface FitResult {
  /** Path to generated PDF */
  pdf: string
  /** Path to generated PNG */
  png: string
  /** Path to saved Markdown file */
  md: string
  /** Final font size in px */
  fontSize: number
  /** Whether content still overflows at minimum font size */
  overflow: boolean
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  theme: 'classic',
  fontFamily: 'Noto Sans SC',
  marginMm: 20,
  lineHeightRatio: 1.5,
  paragraphSpacing: 0.5,
  firstLineIndent: 0,
  outputDir: '.',
  outputName: 'output',
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Fit Markdown content to a single A4 page.
 * Returns paths to generated PDF and PNG files.
 */
export async function fitToPage(options: FitOptions): Promise<FitResult> {
  const opts = { ...DEFAULTS, ...options }

  // Resolve output paths
  const outputDir = resolve(opts.outputDir!)
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  const mdPath = resolve(outputDir, `${opts.outputName!}.md`)
  const pdfPath = resolve(outputDir, `${opts.outputName!}.pdf`)
  const pngPath = resolve(outputDir, `${opts.outputName!}.png`)

  // Save markdown file
  writeFileSync(mdPath, opts.markdown, 'utf-8')

  // Determine base URL
  const baseUrl = opts.baseUrl || await startPreviewServer()

  // Launch headless browser
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Navigate to fit.html
    await page.goto(`${baseUrl}/fit.html`, { waitUntil: 'networkidle' })

    // Wait for render engine to be ready
    await page.waitForFunction(() => (window as any).__smartpageReady === true, { timeout: 15000 })

    // Render markdown and get result
    const result = await page.evaluate(
      async ({ markdown, theme, fontFamily, marginMm, lineHeightRatio, paragraphSpacing, firstLineIndent }) => {
        return await (window as any).__smartpageRender({
          markdown,
          theme,
          fontFamily,
          marginMm,
          lineHeightRatio,
          paragraphSpacing,
          firstLineIndent,
        })
      },
      {
        markdown: opts.markdown,
        theme: opts.theme,
        fontFamily: opts.fontFamily,
        marginMm: opts.marginMm,
        lineHeightRatio: opts.lineHeightRatio,
        paragraphSpacing: opts.paragraphSpacing,
        firstLineIndent: opts.firstLineIndent,
      },
    )

    // Export PDF (use screen media to avoid @media print conflicts)
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      media: 'screen',
    })

    // Export PNG (screenshot the A4 page at 2x for quality)
    const a4Element = page.locator('#a4-page')
    await a4Element.screenshot({ path: pngPath, type: 'png', scale: 'css' })

    return {
      pdf: pdfPath,
      png: pngPath,
      md: mdPath,
      fontSize: result.fontSize,
      overflow: result.overflow,
    }
  } finally {
    await browser.close()
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2)

  // Parse args
  const flags: Record<string, string> = {}
  let input: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const val = args[i + 1]
      if (val && !val.startsWith('--')) {
        flags[key] = val
        i++
      } else {
        flags[key] = 'true'
      }
    } else {
      input = args[i]
    }
  }

  if (!input) {
    console.error('Usage: bun run fit.ts <input.md> [options]')
    console.error('')
    console.error('Options:')
    console.error('  --theme <name>          Theme: classic, warm, academic, editorial,')
    console.error('                          smartisan, noir, mint, ink, tech, kraft')
    console.error('  --font <family>         Font family name')
    console.error('  --margin <mm>           Margin in millimeters (default: 20)')
    console.error('  --line-height <ratio>   Line height ratio (default: 1.5)')
    console.error('  --paragraph-spacing <em> Paragraph spacing in em (default: 0.5)')
    console.error('  --first-line-indent <em> First line indent in em (default: 0)')
    console.error('  --output-dir <path>     Output directory (default: current dir)')
    console.error('  --output-name <name>    Output filename without extension (default: output)')
    console.error('  --base-url <url>        Vite preview server URL')
    console.error('')
    console.error('Output: .md + .pdf + .png')
    process.exit(1)
  }

  // Read input file
  const inputPath = resolve(input)
  if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`)
    process.exit(1)
  }
  const markdown = readFileSync(inputPath, 'utf-8')

  // Build options
  const fitOptions: FitOptions = {
    markdown,
    theme: flags.theme,
    fontFamily: flags.font,
    marginMm: flags.margin ? Number(flags.margin) : undefined,
    lineHeightRatio: flags['line-height'] ? Number(flags['line-height']) : undefined,
    paragraphSpacing: flags['paragraph-spacing'] ? Number(flags['paragraph-spacing']) : undefined,
    firstLineIndent: flags['first-line-indent'] ? Number(flags['first-line-indent']) : undefined,
    outputDir: flags['output-dir'],
    outputName: flags['output-name'],
    baseUrl: flags['base-url'],
  }

  // Execute
  console.log('Rendering A4 page...')
  const result = await fitToPage(fitOptions)

  console.log(`✓ MD:  ${result.md}`)
  console.log(`✓ PDF: ${result.pdf}`)
  console.log(`✓ PNG: ${result.png}`)
  console.log(`  Font size: ${result.fontSize.toFixed(1)}px`)
  if (result.overflow) {
    console.log('  ⚠ Content overflows at minimum font size')
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Start Vite dev server and return its URL.
 * Called only when --base-url is not provided.
 */
async function startPreviewServer(): Promise<string> {
  const { createServer } = await import('vite')

  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    server: {
      port: 0, // auto-assign random port
      strictPort: false,
    },
  })

  await server.listen()
  const url = server.resolvedUrls?.local[0]
  if (!url) {
    throw new Error('Failed to start Vite dev server')
  }

  // Register cleanup on process exit
  process.on('exit', () => server.close())
  process.on('SIGINT', () => { server.close(); process.exit() })
  process.on('SIGTERM', () => { server.close(); process.exit() })

  return url
}
