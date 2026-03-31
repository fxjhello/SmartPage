# SmartPage AGENTS.md

**Generated:** 2026-03-31
**Stack:** Vite + TypeScript | @chenglou/pretext | marked | Playwright

## OVERVIEW

Single-page A4 print fitting tool. Paste Markdown → binary search optimal font size → render to A4 preview. Pure client-side, no backend. Dual mode: human UI (browser with interactive controls) + Skill API (headless Playwright export to PDF/PNG). Bun-compatible. Chinese UI labels. 10 print themes, 9 built-in samples.

## STRUCTURE

```
./
├── index.html              # Human UI entry
├── fit.html                # Headless rendering entry (Playwright)
├── fit.ts                  # Library — fitToPage() + startPreviewServer()
├── cli.ts                  # CLI entry — arg parsing → fitToPage()
├── package.json            # bin: smartpage → lib/cli.js
├── tsconfig.json           # strict TS, ESNext, noEmit (src/)
├── tsconfig.cli.json       # TS config for CLI build (fit.ts + cli.ts → lib/)
├── vite.config.ts          # Multi-page build config
├── src/
│   ├── core/               # Shared core
│   │   ├── markdown.ts     # marked lexer → Block[]
│   │   └── style.css       # 10 themes via CSS variables
│   ├── human/              # Human UI
│   │   ├── main.ts         # DOM builder, event handlers, update loop
│   │   ├── measure.ts      # Pretext-based font fitting (binary search)
│   │   ├── controls.ts     # Theme/font/margin controls
│   │   └── samples.ts      # 9 built-in Markdown examples
│   └── headless/           # Headless rendering
│       └── fit-entry.ts    # DOM-based binary search + Playwright interface
└── bun.lock
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add theme | `src/core/style.css` — add `.a4-page.theme-{name}` block |
| Add control option | `src/human/controls.ts` — THEME_OPTIONS / FONT_OPTIONS arrays |
| Add sample template | `src/human/samples.ts` — push to SAMPLES array |
| Font fitting (human UI) | `src/human/measure.ts` — `findOptimalFontSize()` Pretext binary search |
| Font fitting (headless) | `src/headless/fit-entry.ts` — DOM reflow binary search |
| Markdown parsing | `src/core/markdown.ts` — `extractBlocks()` |
| DOM rendering | `src/human/main.ts` — `buildDOM()`, `update()` |
| Skill API | `fit.ts` — `fitToPage()` function |
| CLI | `cli.ts` — arg parsing → fitToPage() |

## COMMANDS

```bash
npm install          # or bun install
npm run dev          # Vite dev server (human UI)
npm run build        # tsc && vite build
npm run build:cli    # tsc -p tsconfig.cli.json → lib/ (for npm publish)
npm run preview      # vite preview
npm run fit -- input.md --theme classic --font "Noto Sans SC" --margin 20 --output-dir ./out
npx smartpage input.md --theme classic --output-dir ./out   # CLI via npx
```

No test infrastructure exists. No ESLint/Prettier — style enforced by TypeScript strict + manual convention.

## CODE STYLE

### Imports
- Single quotes, no semicolons
- `import type { X }` for type-only imports
- Node built-ins: `import { ... } from 'node:fs'` / `'node:path'`
- Group order: external libs → internal modules → CSS imports (last)
- No barrel files; direct relative imports (`../core/markdown`)

### Naming
- **Types/Interfaces**: PascalCase (`FitOptions`, `FitResult`, `Block`)
- **Functions**: camelCase (`findOptimalFontSize`, `extractBlocks`)
- **Constants**: UPPER_SNAKE_CASE (`A4_WIDTH_PX`, `HEADING_SCALES`)
- **DOM helpers**: `el<T>()` generic factory for `document.createElement`
- **CSS classes**: kebab-case (`.a4-page`, `.theme-classic`)
- **Theme names**: lowercase string in JS (`'classic'`, `'warm'`)

### Formatting
- 2-space indentation, no semicolons (ASI)
- Single quotes for strings and property names
- Trailing commas in multi-line objects/arrays
- Template literals for interpolation
- Section dividers: `// ─── Section Name ──────────────────────`

### Types
- `strict: true` with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- No `any` except `window as any` for Playwright `__smartpage*` globals
- Explicit return types on exported functions
- Inline narrowing via `as Tokens.Heading` / `as Tokens.Paragraph`
- `Record<number, number>` for simple maps

### Error Handling
- **CLI**: `console.error()` + `process.exit(1)`
- **Async**: `try/finally` for browser cleanup (always `browser.close()`)
- **Vite server**: `process.on('exit'/'SIGINT'/'SIGTERM')` for cleanup
- No silent catches; every catch/finally has a purpose
- Type assertions only for DOM (`document.getElementById('x')!`) and Playwright globals

### DOM Patterns
- Prefer `document.createElement` over `innerHTML`
- `DOMParser().parseFromString(html, 'text/html')` for safe Markdown→HTML
- `replaceChildren(...nodes)` for replacing content
- `ResizeObserver` for responsive layout
- Direct event listeners (no delegation)

### CSS Patterns
- CSS variables on `.a4-page` for theming (`--page-bg`, `--heading-color`, etc.)
- `em`-based typography (scales with font size)
- `@media print` hides UI, shows only `.a4-wrapper`
- Theme classes: `.a4-page.theme-{name}` override CSS variables
- Section comments: `/* ─── Section Name ─────────────────── */`

### Anti-Patterns
- **No backend**: Pure client-side only
- **No `as any` suppression**: Except Playwright globals
- **No `@ts-ignore` / `@ts-expect-error`**: Fix types properly
- **fit.html ≠ index.html**: Headless page has zero UI controls
- **No DOM reflow during human UI binary search**: Use Pretext for measurement

## KEY SYMBOLS

| Symbol | Location | Role |
|--------|----------|------|
| `fitToPage()` | fit.ts | Skill API — headless render → MD + PDF + PNG |
| `findOptimalFontSize()` | human/measure.ts | Pretext binary search 6–72px, precision 0.25px |
| `computeTotalHeight()` | human/measure.ts | Height calculation per block via Pretext |
| `extractBlocks()` | core/markdown.ts | marked lexer → Block[] |
| `__smartpageRender()` | headless/fit-entry.ts | Playwright calls this for headless rendering |

## Skill API

### Module Usage
```typescript
import { fitToPage } from './fit'

const result = await fitToPage({
  markdown: content,
  theme: 'classic',
  fontFamily: 'Noto Sans SC',
  marginMm: 20,
  outputDir: './output',
  outputName: 'resume',
})
// result = { md, pdf, png, fontSize, overflow }
```

### CLI Options
| Flag | Default | Description |
|------|---------|-------------|
| `--theme` | classic | classic, warm, academic, editorial, smartisan, noir, mint, ink, tech, kraft |
| `--font` | Noto Sans SC | Font family name |
| `--margin` | 20 | Margin in mm |
| `--line-height` | 1.5 | Line height ratio |
| `--paragraph-spacing` | 0.5 | Paragraph spacing in em |
| `--first-line-indent` | 0 | First line indent in em |
| `--output-dir` | . | Output directory |
| `--output-name` | output | Output filename (no extension) |
| `--base-url` | auto | Vite server URL (auto-starts if omitted) |

## NOTES

- **A4 dimensions**: 794×1123px at 96 DPI (210mm×297mm)
- **Binary search**: ~8 iterations, ~160 Pretext calls ≈ 7ms (human UI); ~8 DOM reflows (headless)
- **Headless export**: Playwright Chromium renders `fit.html`, exports PDF (`media: 'screen'`) + PNG
- **Font loading**: Headless mode waits 300ms after font load for Canvas availability
- **Print CSS**: `@page { size: A4 }` + print media hides UI elements
