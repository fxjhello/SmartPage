import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
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
};
// ─── Core API ────────────────────────────────────────────────────────────────
/**
 * Fit Markdown content to a single A4 page.
 * Returns paths to generated PDF and PNG files.
 */
export async function fitToPage(options) {
    const opts = { ...DEFAULTS, ...options };
    // Resolve output paths
    const outputDir = resolve(opts.outputDir);
    if (!existsSync(outputDir))
        mkdirSync(outputDir, { recursive: true });
    const mdPath = resolve(outputDir, `${opts.outputName}.md`);
    const pdfPath = resolve(outputDir, `${opts.outputName}.pdf`);
    const pngPath = resolve(outputDir, `${opts.outputName}.png`);
    // Save markdown file
    writeFileSync(mdPath, opts.markdown, 'utf-8');
    // Determine base URL
    const baseUrl = opts.baseUrl || await startPreviewServer();
    // Launch headless browser — prefer system Chrome/Edge to avoid ~150MB download
    let browser;
    const launchOpts = { headless: true };
    for (const channel of ['chrome', 'msedge']) {
        try {
            browser = await chromium.launch({ ...launchOpts, channel });
            break;
        }
        catch {
            // System browser not available, try next
        }
    }
    if (!browser) {
        console.error('Error: No compatible browser found.');
        console.error('  SmartPage tried system Chrome and Edge, but neither was available.');
        console.error('  Install Playwright\'s bundled Chromium:');
        console.error('    npx playwright install chromium');
        console.error('  Or install Google Chrome / Microsoft Edge.');
        process.exit(1);
    }
    const page = await browser.newPage();
    try {
        // Navigate to fit.html
        await page.goto(`${baseUrl}/fit.html`, { waitUntil: 'networkidle' });
        // Wait for render engine to be ready
        await page.waitForFunction(() => window.__smartpageReady === true, { timeout: 15000 });
        // Render markdown and get result
        const result = await page.evaluate(async ({ markdown, theme, fontFamily, marginMm, lineHeightRatio, paragraphSpacing, firstLineIndent }) => {
            return await window.__smartpageRender({
                markdown,
                theme,
                fontFamily,
                marginMm,
                lineHeightRatio,
                paragraphSpacing,
                firstLineIndent,
            });
        }, {
            markdown: opts.markdown,
            theme: opts.theme,
            fontFamily: opts.fontFamily,
            marginMm: opts.marginMm,
            lineHeightRatio: opts.lineHeightRatio,
            paragraphSpacing: opts.paragraphSpacing,
            firstLineIndent: opts.firstLineIndent,
        });
        // Export PDF (use screen media to avoid @media print conflicts)
        await page.emulateMedia({ media: 'screen' });
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        // Export PNG (screenshot the A4 page at 2x for quality)
        const a4Element = page.locator('#a4-page');
        await a4Element.screenshot({ path: pngPath, type: 'png', scale: 'css' });
        return {
            pdf: pdfPath,
            png: pngPath,
            md: mdPath,
            fontSize: result.fontSize,
            overflow: result.overflow,
        };
    }
    finally {
        await browser.close();
    }
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Start Vite dev server from the package directory and return its URL.
 */
export async function startPreviewServer() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(__dirname, '..');
    const server = await createServer({
        configFile: false,
        root: pkgRoot,
        server: {
            port: 0,
            strictPort: false,
        },
    });
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) {
        throw new Error('Failed to start Vite dev server');
    }
    process.on('exit', () => server.close());
    process.on('SIGINT', () => { server.close(); process.exit(); });
    process.on('SIGTERM', () => { server.close(); process.exit(); });
    return url;
}
//# sourceMappingURL=fit.js.map