# SmartPage AGENTS.md

**Generated:** 2026-03-31
**Stack:** Vite + TypeScript | @chenglou/pretext | marked | Playwright

## OVERVIEW

Single-page A4 print fitting tool. Paste Markdown → binary search optimal font size → render to A4 preview. No backend. Pure client-side. Two modes: human UI (browser) + Skill API (headless export).

## STRUCTURE

```
./
├── index.html              # Human UI entry
├── fit.html                # Headless rendering entry (Playwright)
├── fit.ts                  # Skill API — CLI + module export
├── package.json            # dev: vite, build: tsc && vite build, fit: tsx fit.ts
├── tsconfig.json           # strict TS, ESNext, noEmit
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
└── bun.lock               # Bun lockfile (npm also works)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add new theme | `src/core/style.css` — add `.a4-page.theme-{name}` block |
| Add control option | `src/human/controls.ts` — THEME_OPTIONS / FONT_OPTIONS arrays |
| Add sample template | `src/human/samples.ts` — push to SAMPLES array |
| Font fitting algorithm (human UI) | `src/human/measure.ts` — `findOptimalFontSize()` Pretext binary search |
| Font fitting algorithm (headless) | `src/headless/fit-entry.ts` — DOM-based binary search |
| Markdown parsing | `src/core/markdown.ts` — `extractBlocks()` using marked lexer |
| DOM rendering | `src/human/main.ts` — `buildDOM()`, `update()` |
| Print CSS | `src/core/style.css` — `@media print` block |
| Skill API entry | `fit.ts` — `fitToPage()` function + CLI |
| Headless page | `fit.html` — Playwright loads this for export |

## CODE MAP

| Symbol | Location | Role |
|--------|----------|------|
| `fitToPage()` | fit.ts:60 | Skill API — headless render → MD + PDF + PNG |
| `findOptimalFontSize()` | human/measure.ts:122 | Core algorithm — Pretext binary search 6-72px |
| `computeTotalHeight()` | human/measure.ts:35 | Height calculation per block via Pretext |
| `extractBlocks()` | core/markdown.ts:105 | marked lexer → Block[] |
| `buildDOM()` | human/main.ts:22 | UI construction |
| `update()` | human/main.ts:229 | Render + DOM fallback after Pretext |
| `getSettings()` | human/controls.ts:125 | Read current control values |
| `__smartpageRender()` | headless/fit-entry.ts:95 | Playwright calls this for headless rendering |
| `SAMPLES` | human/samples.ts:7 | 9 built-in templates |

## CONVENTIONS

- **ESM**: `"type": "module"` in package.json, `import/export` syntax
- **TypeScript strict**: `noUnusedLocals`, `noUnusedParameters`, `strict` all enabled
- **No emit**: `tsc` only type-checks; Vite handles bundling
- **CSS variables**: A4 page theming via `--page-bg`, `--heading-color`, etc. on `.a4-page`
- **Pretext for measurement**: Canvas text measurement, no DOM reflow during binary search (human UI)
- **DOM-based for headless**: `fit-entry.ts` uses DOM reflow binary search (no Pretext dependency)

## CODE STYLE

### Imports
- Single quotes, no semicolons (enforced by codebase convention)
- `import type { X }` for type-only imports (e.g. `import type { Block } from '../core/markdown'`)
- Node built-ins: `import { ... } from 'node:fs'` / `'node:path'`
- Group order: external libs → internal modules → CSS imports (last)
- No barrel files; direct relative imports (`../core/markdown`)

### Naming
- **Types/Interfaces**: PascalCase (`FitOptions`, `FitResult`, `StyleSettings`, `Block`)
- **Functions**: camelCase (`findOptimalFontSize`, `extractBlocks`, `applyStyles`)
- **Constants**: UPPER_SNAKE_CASE (`A4_WIDTH_PX`, `THEME_CLASSES`, `HEADING_SCALES`)
- **DOM helpers**: `el<T>()` generic factory for `document.createElement`
- **CSS classes**: kebab-case (`.a4-page`, `.theme-classic`, `.control-group`)
- **Theme names**: lowercase kebab in CSS, lowercase string in JS (`'classic'`, `'warm'`)

### Formatting
- 2-space indentation
- No semicolons (ASI relied upon)
- Single quotes for strings and property names
- Trailing commas in multi-line objects/arrays
- Template literals for string interpolation
- Section dividers: `// ─── Section Name ──────────────────────`

### Types
- `strict: true` — no `any` except `window as any` for Playwright `__smartpage*` globals
- Explicit return types on exported functions (`Promise<FitResult>`, `void`)
- Inline type narrowing via `as Tokens.Heading` / `as Tokens.Paragraph` for marked tokens
- `Record<number, number>` for simple key-value maps (e.g. `HEADING_SCALES`)

### Error Handling
- **CLI**: `console.error()` + `process.exit(1)` for user-facing errors
- **Async**: `try/finally` for browser cleanup (always `browser.close()`)
- **Vite server**: Register `process.on('exit'/'SIGINT'/'SIGTERM')` for cleanup
- **No silent catches**: Every catch/finally has a purpose
- **Type assertions**: Only for DOM (`document.getElementById('x')!`) and Playwright globals

### DOM Patterns
- Prefer `document.createElement` over `innerHTML` for security
- Use `DOMParser().parseFromString(html, 'text/html')` for safe Markdown→HTML injection
- `replaceChildren(...nodes)` for replacing element content
- `ResizeObserver` for responsive layout calculations
- Event delegation: attach listeners to specific elements, not delegated

### CSS Patterns
- CSS variables on `.a4-page` for theme theming
- `em`-based typography for A4 content (scales with font size)
- `@media print` hides UI, shows only `.a4-wrapper`
- Theme classes: `.a4-page.theme-{name}` override CSS variables
- Section comments: `/* ─── Section Name ─────────────────── */`

### Anti-Patterns (THIS PROJECT)
- **No backend**: Pure client-side — do NOT add server code
- **No tests**: No test infrastructure exists
- **No ESLint/Prettier**: Style via TypeScript strict + manual convention
- **No `as any` suppression**: Except Playwright `window as any` globals
- **No `@ts-ignore` / `@ts-expect-error`**: Fix types properly
- **fit.html ≠ index.html**: Headless page has zero UI controls

## UNIQUE FEATURES

- **Bun-compatible**: Works with `bun install` / `bun run dev`; npm also works
- **Chinese UI**: All UI labels in Chinese (顶部栏, 样式设置, etc.)
- **10 print themes**: Defined in CSS as `.theme-*` classes, switchable via controls
- **Status bar**: Shows current font size, zoom %, overflow warning
- **Dual mode**: Human UI (browser) + Skill API (headless PDF/PNG export)

## COMMANDS

```bash
npm install          # or bun install
npm run dev          # Start Vite dev server (human UI)
npm run build        # tsc --noEmit && vite build
npm run preview      # vite preview
npm run fit -- input.md --theme classic --font "Noto Sans SC" --margin 20 --output-dir ./out
```

## Skill API Usage

### CLI
```bash
npm run fit -- input.md [options]
```

### Module
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
// result = { md: '.../resume.md', pdf: '.../resume.pdf', png: '.../resume.png', fontSize: 14.5, overflow: false }
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
- **Binary search (human UI)**: ~8 iterations (precision 0.25px) → ~160 Pretext calls ≈ 7ms
- **Binary search (headless)**: ~8 iterations via DOM reflow (~5-10 reflows)
- **Print output**: `@page { size: A4 }` + CSS print media hides UI, shows only `.a4-wrapper`
- **Headless export**: Playwright Chromium renders `fit.html`, exports PDF (`media: 'screen'`) + PNG
- **Font loading**: Headless mode waits 300ms after font load for Canvas availability
