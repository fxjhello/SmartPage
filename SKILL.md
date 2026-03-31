# SmartPage — A4 One-Page Fitting Skill

> 将 Markdown 内容自动适配到一页 A4 纸。粘贴即排版，一键导出 PDF，PNG 和 Markdown。

## Quick Start

```bash
npm install
npx playwright install chromium   # 首次运行
npm run dev                       # 启动开发服务器
```

## What This Skill Does

接收 **Markdown 字符串**，自动执行：
1. 二分查找最优字号（6px–72px，精度 0.25px）
2. 渲染到 A4 页面（210mm × 297mm）
3. 输出 PDF + PNG + Markdown

**输入格式：仅 Markdown。** 如果你拿到的是 PDF、DOCX、Excel、PPT 等格式的文件：
- 先用你可用的转换工具/skill 将其转为 Markdown
- 例如搜索 skill 商店中的 `pdf-to-md`、`docx-to-md` 等转换工具
- 本 skill 不处理非 Markdown 格式，只接收 `.md` 内容

## Usage — Two Modes

### Mode 1: Human UI（交互式）

```bash
npm run dev
```

浏览器打开后：
- **左侧** → 粘贴/编辑 Markdown，或从 9 个内置示例中选择
- **右侧** → 实时 A4 预览
- **底部控制栏** → 调节主题/字体/页边距/行高/段落间距/首行缩进
- **预览操作** → `⌘+滚轮` 缩放 | 拖拽平移 | 双击重置
- **打印** → `⌘P` 直接输出 A4 PDF

### Mode 2: Skill API（无头导出）

#### CLI

```bash
npm run fit -- input.md --theme classic --font "Noto Sans SC" --margin 20 --output-dir ./out
```

#### Module

```typescript
import { fitToPage } from './fit'

const result = await fitToPage({
  markdown: content,        // 必填：Markdown 字符串
  theme: 'classic',         // 可选，默认 classic
  fontFamily: 'Noto Sans SC', // 可选，默认 Noto Sans SC
  marginMm: 20,             // 可选，默认 20
  lineHeightRatio: 1.5,     // 可选，默认 1.5
  paragraphSpacing: 0.5,    // 可选，默认 0.5
  firstLineIndent: 0,       // 可选，默认 0
  outputDir: './output',    // 可选，默认当前目录
  outputName: 'resume',     // 可选，默认 output
})
// result = { md, pdf, png, fontSize, overflow }
```

#### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--theme` | classic | classic, warm, academic, editorial, smartisan, noir, mint, ink, tech, kraft |
| `--font` | Noto Sans SC | 字体名称 |
| `--margin` | 20 | 页边距 (mm) |
| `--line-height` | 1.5 | 行高比 |
| `--paragraph-spacing` | 0.5 | 段落间距 (em) |
| `--first-line-indent` | 0 | 首行缩进 (em) |
| `--output-dir` | . | 输出目录 |
| `--output-name` | output | 输出文件名（无扩展名） |

## Themes (10)

| 主题 | 风格 | 适用场景 |
|------|------|----------|
| classic | 白底黑字，通用 | 默认/万能 |
| warm | 奶油色底，棕色标题 | 温暖/手写感 |
| academic | 藏蓝标题，h2 下划线 | 论文/学术 |
| editorial | 红色标题，h1 大写 | 杂志/出版物 |
| smartisan | 米白底，红褐色，虚线分隔 | 锤子便签风格 |
| noir | 深蓝黑底，金色标题 | 暗夜/高对比 |
| mint | 淡绿底，翠绿标题 | 清新/自然 |
| ink | 宣纸色底，纯黑大字距 | 书法/传统 |
| tech | 浅蓝灰底，亮蓝标题 | 科技/现代 |
| kraft | 深驼色底，深棕标题 | 牛皮纸/复古 |

## Fonts (9 Built-in)

思源黑体、思源宋体、霞鹜文楷、苹方、站酷小薇体、Inter、Georgia、Helvetica Neue、Times New Roman

## Architecture

```
Markdown 输入
  → marked.lexer() 提取 Block[]
  → Pretext prepare()+layout() 测量高度（Human UI）
  → DOM reflow 二分查找（Headless）
  → 二分查找 6–72px，~8 次迭代
  → 渲染 HTML → Playwright 导出 PDF/PNG
```

### Key Files

| File | Role |
|------|------|
| `fit.ts` | Skill API 入口 — `fitToPage()` + CLI |
| `src/core/markdown.ts` | Markdown 解析 → Block[] |
| `src/core/style.css` | 10 主题 CSS + 打印样式 |
| `src/human/measure.ts` | Pretext 二分查找字号（Human UI） |
| `src/human/main.ts` | Human UI DOM 构建 + 实时更新 |
| `src/human/controls.ts` | 主题/字体/边距控件 |
| `src/human/samples.ts` | 9 个内置示例模板 |
| `src/headless/fit-entry.ts` | Playwright 无头渲染入口 |

## Code Conventions

- TypeScript strict, no semicolons, single quotes, 2-space indent
- `import type { X }` for type-only imports
- No `any` except `window as any` for Playwright globals
- No `@ts-ignore` / `@ts-expect-error`
- CSS: `em`-based typography, CSS variables for theming
- DOM: `document.createElement` > `innerHTML`, `DOMParser` for safe MD→HTML

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Playwright Chromium missing | `npx playwright install chromium` |
| Font not rendering | Check Google Fonts loading; use built-in fallback fonts |
| Content still overflows | Reduce margin (`--margin 15`), reduce line height, or simplify content |
| PDF looks blurry | PNG is 2x screenshot; PDF uses vector rendering at screen media |
