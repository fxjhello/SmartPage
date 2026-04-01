import { toPng, toJpeg } from 'html-to-image'
import { parse } from 'marked'
import { extractBlocks } from '../core/markdown'
import { findOptimalFontSize, clearMeasureCache } from './measure'
import { createControls, getSettings } from './controls'
import { SAMPLES } from './samples'
import type { StyleSettings } from './controls'
import '../core/style.css'
import jsPDF from 'jspdf'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastLoadedFont = ''
let a4Content: HTMLElement
let a4Page: HTMLElement
let a4Wrapper: HTMLElement
let a4Placeholder: HTMLElement
let statusFontSize: HTMLElement
let statusOverflow: HTMLElement
let statusZoom: HTMLElement
let textarea: HTMLTextAreaElement
let fitScale = 1
let userZoom = 1
let settingsModal: HTMLElement | null = null

// ─── Markdown Toolbar Helpers ───────────────────────────────────

function insertWrap(before: string, after: string = before): void {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.substring(start, end)
  const replacement = before + (selected || 'text') + after
  textarea.setRangeText(replacement, start, end, 'select')
  textarea.focus()
  scheduleUpdate()
}

function insertLine(prefix: string): void {
  const start = textarea.selectionStart
  const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = textarea.value.indexOf('\n', start)
  const line = textarea.value.substring(lineStart, lineEnd === -1 ? undefined : lineEnd)
  const replacement = prefix + line
  textarea.setRangeText(replacement, lineStart, lineEnd === -1 ? textarea.value.length : lineEnd, 'end')
  textarea.focus()
  scheduleUpdate()
}

function buildToolbar(container: HTMLElement): void {
  const toolbar = document.createElement('div')
  toolbar.className = 'md-toolbar'

  const buttons: { label: string; action: () => void; title?: string }[] = [
    { label: 'B', action: () => insertWrap('**'), title: '粗体' },
    { label: 'I', action: () => insertWrap('*'), title: '斜体' },
    { label: 'S', action: () => insertWrap('~~'), title: '删除线' },
    { label: 'H1', action: () => insertLine('# '), title: '一级标题' },
    { label: 'H2', action: () => insertLine('## '), title: '二级标题' },
    { label: 'H3', action: () => insertLine('### '), title: '三级标题' },
    { label: '•', action: () => insertLine('- '), title: '无序列表' },
    { label: '1.', action: () => insertLine('1. '), title: '有序列表' },
    { label: '[]', action: () => insertWrap('[', '](url)'), title: '链接' },
    { label: '</>', action: () => insertWrap('`'), title: '行内代码' },
    { label: '```', action: () => insertWrap('\n```\n', '\n```\n'), title: '代码块' },
    { label: '—', action: () => insertLine('\n---\n'), title: '分隔线' },
    { label: '>', action: () => insertLine('> '), title: '引用' },
  ]

  for (const btn of buttons) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'md-toolbar-btn'
    b.textContent = btn.label
    b.title = btn.title || ''
    b.addEventListener('click', btn.action)
    toolbar.appendChild(b)
  }

  container.appendChild(toolbar)
}

// ─── Settings Modal ─────────────────────────────────────────────

function openSettingsModal(onChange: () => void): void {
  if (settingsModal) {
    settingsModal.remove()
  }

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  const modal = document.createElement('div')
  modal.className = 'modal-content'

  const header = document.createElement('div')
  header.className = 'modal-header'

  const title = document.createElement('span')
  title.textContent = '样式设置'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'modal-close'
  closeBtn.textContent = '✕'
  closeBtn.addEventListener('click', () => { overlay.remove(); settingsModal = null })

  header.append(title, closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body'

  createControls(body, onChange)

  modal.append(header, body)
  overlay.appendChild(modal)
  document.body.appendChild(overlay)
  settingsModal = overlay

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.remove(); settingsModal = null }
  })
}

// ─── Export Functions ───────────────────────────────────────────

async function exportPNG(): Promise<void> {
  try {
    const dataUrl = await toPng(a4Page, { quality: 1, pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = 'smartpage.png'
    link.href = dataUrl
    link.click()
  } catch (err) {
    console.error('PNG export failed:', err)
  }
}

async function exportPDF(): Promise<void> {
  try {
    const dataUrl = await toJpeg(a4Page, { quality: 0.95, pixelRatio: 2 })
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)
    pdf.save('smartpage.pdf')
  } catch (err) {
    console.error('PDF export failed:', err)
  }
}

function exportMD(): void {
  const blob = new Blob([textarea.value], { type: 'text/markdown' })
  const link = document.createElement('a')
  link.download = 'smartpage.md'
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}

// ─── Build DOM ──────────────────────────────────────────────────

function buildDOM(): void {
  const app = document.getElementById('app')!
  app.className = 'app'

  // Top bar
  const topbar = document.createElement('div')
  topbar.className = 'topbar'

  const title = document.createElement('div')
  title.className = 'topbar-title'
  title.textContent = 'SmartPage'

  const statusArea = document.createElement('div')
  statusArea.className = 'topbar-status'

  statusFontSize = document.createElement('span')
  statusFontSize.className = 'status-fontsize'
  statusFontSize.textContent = '—'

  statusOverflow = document.createElement('span')
  statusOverflow.className = 'status-overflow'
  statusOverflow.textContent = '内容溢出'

  statusZoom = document.createElement('span')
  statusZoom.className = 'status-zoom'
  statusZoom.textContent = '100%'
  statusZoom.title = '⌘+滚轮缩放，双击重置'

  // Export dropdown
  const exportWrapper = document.createElement('div')
  exportWrapper.className = 'export-wrapper'

  const exportBtn = document.createElement('button')
  exportBtn.className = 'btn-export'
  exportBtn.textContent = '导出 ▾'

  const exportMenu = document.createElement('div')
  exportMenu.className = 'export-menu'
  exportMenu.style.display = 'none'

  const exportItems = [
    { label: '导出 PDF', action: exportPDF },
    { label: '导出 PNG', action: exportPNG },
    { label: '导出 MD', action: exportMD },
  ]

  for (const item of exportItems) {
    const btn = document.createElement('button')
    btn.className = 'export-menu-item'
    btn.textContent = item.label
    btn.addEventListener('click', () => {
      exportMenu.style.display = 'none'
      item.action()
    })
    exportMenu.appendChild(btn)
  }

  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const visible = exportMenu.style.display === 'block'
    exportMenu.style.display = visible ? 'none' : 'block'
  })

  document.addEventListener('click', () => { exportMenu.style.display = 'none' })

  exportWrapper.append(exportBtn, exportMenu)

  statusArea.append(statusFontSize, statusZoom, statusOverflow, exportWrapper)
  topbar.append(title, statusArea)

  // Left panel
  const leftPanel = document.createElement('div')
  leftPanel.className = 'left-panel'

  const textareaWrapper = document.createElement('div')
  textareaWrapper.className = 'textarea-wrapper'

  const textareaHeader = document.createElement('div')
  textareaHeader.className = 'textarea-header'
  textareaHeader.textContent = '粘贴 / 编辑 Markdown'

  // Markdown toolbar
  const toolbarContainer = document.createElement('div')
  toolbarContainer.className = 'toolbar-container'
  buildToolbar(toolbarContainer)

  textarea = document.createElement('textarea')
  textarea.className = 'input-textarea'
  textarea.placeholder = '在此粘贴 Markdown 内容...\n\n支持粘贴后编辑修改\n\n# 标题\n\n正文内容...\n\n- 列表项'
  textarea.spellcheck = false

  textareaWrapper.append(textareaHeader, toolbarContainer, textarea)
  leftPanel.appendChild(textareaWrapper)

  // Right panel
  const rightPanel = document.createElement('div')
  rightPanel.className = 'right-panel'

  // Settings button
  const settingsBtn = document.createElement('button')
  settingsBtn.className = 'settings-btn'
  settingsBtn.textContent = '⚙ 设置'
  settingsBtn.addEventListener('click', () => {
    openSettingsModal(() => {
      clearMeasureCache()
      scheduleUpdate()
    })
  })

  a4Page = document.createElement('div')
  a4Page.className = 'a4-page'

  a4Placeholder = document.createElement('div')
  a4Placeholder.className = 'a4-placeholder'
  a4Placeholder.textContent = '在左侧粘贴内容以预览'

  a4Content = document.createElement('div')
  a4Content.className = 'a4-content'

  a4Page.append(a4Placeholder, a4Content)

  a4Wrapper = document.createElement('div')
  a4Wrapper.className = 'a4-wrapper'
  a4Wrapper.appendChild(a4Page)

  rightPanel.append(settingsBtn, a4Wrapper)

  app.append(topbar, leftPanel, rightPanel)

  // Events
  textarea.addEventListener('input', scheduleUpdate)

  // Auto-scale A4 page
  const resizeObserver = new ResizeObserver(() => updateA4Scale())
  resizeObserver.observe(rightPanel)

  // Cmd + scroll zoom
  rightPanel.addEventListener('wheel', (e) => {
    if (!e.metaKey && !e.ctrlKey) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.95 : 1.05
    userZoom = Math.max(0.3, Math.min(3, userZoom * factor))
    applyScale()
    updateZoomStatus()
  }, { passive: false })

  // Drag to pan
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let scrollStartX = 0
  let scrollStartY = 0

  rightPanel.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    isDragging = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    scrollStartX = rightPanel.scrollLeft
    scrollStartY = rightPanel.scrollTop
    rightPanel.classList.add('dragging')
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    rightPanel.scrollLeft = scrollStartX - (e.clientX - dragStartX)
    rightPanel.scrollTop = scrollStartY - (e.clientY - dragStartY)
  })

  window.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    rightPanel.classList.remove('dragging')
  })

  // Double-click reset zoom
  rightPanel.addEventListener('dblclick', () => {
    userZoom = 1
    applyScale()
    updateZoomStatus()
  })
}

const PAGE_W = 794
const PAGE_H = 1123

function updateA4Scale(): void {
  const rightPanel = a4Wrapper.parentElement
  if (!rightPanel) return

  const padding = 32
  const availW = rightPanel.clientWidth - padding * 2
  const availH = rightPanel.clientHeight - padding * 2

  fitScale = Math.min(availW / PAGE_W, availH / PAGE_H)
  applyScale()
}

function applyScale(): void {
  const scale = fitScale * userZoom
  a4Page.style.transform = `scale(${scale})`
  a4Page.style.transformOrigin = 'top left'
  a4Wrapper.style.width = `${PAGE_W * scale}px`
  a4Wrapper.style.height = `${PAGE_H * scale}px`
}

function updateZoomStatus(): void {
  const pct = Math.round(userZoom * 100)
  statusZoom.textContent = `${pct}%`
  statusZoom.classList.toggle('zoom-modified', userZoom !== 1)
}

function scheduleUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(update, 150)
}

async function update(): Promise<void> {
  const markdown = textarea.value
  const settings = getSettings()

  if (!markdown.trim()) {
    a4Content.textContent = ''
    a4Placeholder.style.display = ''
    statusFontSize.textContent = '—'
    statusOverflow.classList.remove('visible')
    return
  }

  a4Placeholder.style.display = 'none'

  if (lastLoadedFont !== settings.fontFamily) {
    await Promise.all([
      document.fonts.load(`16px "${settings.fontFamily}"`),
      document.fonts.load(`700 16px "${settings.fontFamily}"`),
    ])
    lastLoadedFont = settings.fontFamily
  }

  const blocks = extractBlocks(markdown)
  const { fontSize, overflow } = findOptimalFontSize(blocks, settings)

  statusFontSize.textContent = `${fontSize.toFixed(1)}px`
  statusOverflow.classList.toggle('visible', overflow)

  const html = await parse(markdown)
  let currentFontSize = fontSize
  applyStyles(settings, currentFontSize)

  const doc = new DOMParser().parseFromString(html, 'text/html')
  a4Content.replaceChildren(...Array.from(doc.body.childNodes).map(n => n.cloneNode(true)))

  // DOM fallback binary search
  const pageStyle = getComputedStyle(a4Page)
  const availableHeight = a4Page.clientHeight - parseFloat(pageStyle.paddingTop) - parseFloat(pageStyle.paddingBottom)

  if (a4Content.scrollHeight > availableHeight && currentFontSize > 6) {
    let lo = 6
    let hi = currentFontSize
    while (hi - lo > 0.25) {
      const mid = (lo + hi) / 2
      applyStyles(settings, mid)
      if (a4Content.scrollHeight <= availableHeight) {
        lo = mid
      } else {
        hi = mid
      }
    }
    currentFontSize = Math.floor(lo * 4) / 4
    applyStyles(settings, currentFontSize)
    statusFontSize.textContent = `${currentFontSize.toFixed(1)}px`
    statusOverflow.classList.toggle('visible', currentFontSize <= 6.25 && a4Content.scrollHeight > availableHeight)
  }
}

const THEME_CLASSES = [
  'theme-classic', 'theme-warm', 'theme-academic', 'theme-editorial',
  'theme-smartisan', 'theme-noir', 'theme-mint', 'theme-ink', 'theme-tech', 'theme-kraft',
]

function applyStyles(settings: StyleSettings, fontSize: number): void {
  a4Page.classList.remove(...THEME_CLASSES)
  a4Page.classList.add(`theme-${settings.theme}`)

  a4Page.style.padding = `${settings.marginMm}mm`
  a4Page.style.fontFamily = `"${settings.fontFamily}", -apple-system, sans-serif`
  a4Page.style.fontSize = `${fontSize}px`
  a4Page.style.lineHeight = String(settings.lineHeightRatio)
  a4Page.style.setProperty('--ps', `${settings.paragraphSpacing}em`)
  a4Page.style.setProperty('--fi', `${settings.firstLineIndent}em`)
}

const CACHE_KEY = 'smartpage-md'

// Init
document.addEventListener('DOMContentLoaded', () => {
  buildDOM()
  const cached = localStorage.getItem(CACHE_KEY)
  textarea.value = cached ?? SAMPLES[0].content
  scheduleUpdate()

  textarea.addEventListener('input', () => {
    localStorage.setItem(CACHE_KEY, textarea.value)
  })
})
