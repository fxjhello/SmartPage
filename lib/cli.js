#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fitToPage } from './fit';
// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
// Parse args
const flags = {};
let input;
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        const key = args[i].slice(2);
        const val = args[i + 1];
        if (val && !val.startsWith('--')) {
            flags[key] = val;
            i++;
        }
        else {
            flags[key] = 'true';
        }
    }
    else {
        input = args[i];
    }
}
if (!input) {
    console.error('Usage: npx smartpage <input.md> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --theme <name>           Theme: classic, warm, academic, editorial,');
    console.error('                           smartisan, noir, mint, ink, tech, kraft');
    console.error('  --font <family>          Font family name');
    console.error('  --margin <mm>            Margin in millimeters (default: 20)');
    console.error('  --line-height <ratio>    Line height ratio (default: 1.5)');
    console.error('  --paragraph-spacing <em> Paragraph spacing in em (default: 0.5)');
    console.error('  --first-line-indent <em> First line indent in em (default: 0)');
    console.error('  --output-dir <path>      Output directory (default: current dir)');
    console.error('  --output-name <name>     Output filename without extension (default: output)');
    console.error('  --base-url <url>         Vite preview server URL');
    console.error('');
    console.error('Output: .md + .pdf + .png');
    process.exit(1);
}
// Read input file
const inputPath = resolve(input);
if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
}
const markdown = readFileSync(inputPath, 'utf-8');
// Build options
const fitOptions = {
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
};
// Execute
console.log('Rendering A4 page...');
const result = await fitToPage(fitOptions);
console.log(`✓ MD:  ${result.md}`);
console.log(`✓ PDF: ${result.pdf}`);
console.log(`✓ PNG: ${result.png}`);
console.log(`  Font size: ${result.fontSize.toFixed(1)}px`);
if (result.overflow) {
    console.log('  ⚠ Content overflows at minimum font size');
}
//# sourceMappingURL=cli.js.map