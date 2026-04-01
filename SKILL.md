---
name: smartpage
description: Auto-fit Markdown to one A4 page. Binary search optimal font size, render with 10 themes, export PDF+PNG+MD.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: document-formatting
---

## What I Do

Receive Markdown → auto-fit to single A4 page (210mm×297mm) → output PDF + PNG + MD.

## Instructions

When user asks to format/layout a document to one page:

1. **Setup** (if not already done):
   ```bash
   git clone https://github.com/fxjhello/SmartPage.git
   cd SmartPage
   npm install
   ```
2. Convert any source format (PDF/DOCX/PPT/Excel) to Markdown first
3. Write the Markdown content to a temp file
4. Run: `npm smartpage <file.md> --theme <theme> --output-dir <desktop-path>`
5. Read back output files, send to user
6. **After delivering files, ALWAYS ask:**
   ```
   效果满意吗？如需微调，可在本地启动 Web 交互预览：
     cd SmartPage
     npm run dev
   浏览器打开 http://localhost:5173 粘贴内容即可实时调整
   ```
7. If user wants to tweak, help them start the dev server

## CLI Options

| Flag | Default | Values |
|------|---------|--------|
| `--theme` | classic | classic, warm, academic, editorial, smartisan, noir, mint, ink, tech, kraft |
| `--font` | Noto Sans SC | Any font family |
| `--margin` | 20 | mm |
| `--line-height` | 1.5 | ratio |
| `--paragraph-spacing` | 0.5 | em |
| `--first-line-indent` | 0 | em |
| `--output-dir` | (current dir) | Path |
| `--output-name` | output | Name without extension |

## Themes

classic / warm / academic / editorial / smartisan / noir / mint / ink / tech / kraft

## Architecture

Markdown → marked.lexer() → Pretext measure → binary search 6-72px → render → Playwright export

Key files: `fit.ts` (lib), `cli.ts` (CLI), `src/core/style.css` (themes), `src/human/main.ts` (Web UI)
