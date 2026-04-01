# SmartPage 智能一页

> Inspired by [@VladArtym](https://x.com/VladArtym) — [原始推文](https://x.com/VladArtym/status/2038368243115610351)

自适应单页工具 —— 粘贴 Markdown，自动缩放字体，让所有内容刚好填满一张 A4 纸。导出 PDF，PNG 和 Markdown。

---

## 核心特性

- **自动字号适配**：二分查找最大可用字体，内容多则缩小、内容少则放大，始终填满一页
- **实时预览**：所见即所得的 A4 页面预览，默认 100% 适配屏幕

## 快速开始

### 方式一：For AI agents (复制下面这段话并发给你的智能体)

```
read https://github.com/fxjhello/SmartPage/blob/master/SKILL.md for installation and usage instructions.
```
### 方式二：npx（无需克隆）

```bash
npx smartpage input.md --theme classic --output-dir ./out
```

> 首次运行自动安装依赖。无头导出需要系统已安装 **Google Chrome** 或 **Microsoft Edge**。
> 如果两者都没有，运行 `npx playwright install chromium`。

### 方式三：源码开发

```bash
npm install
npm run dev
```

浏览器打开后，在左侧粘贴 Markdown 内容，右侧即时预览 A4 效果。

## 应用场景

| 场景 | 说明 |
|------|------|
| 个人简历 | 控制在一页，排版专业 |
| 会议议程 / 备忘录 | 一页纸概览，方便打印分发 |
| 教学讲义 / 考试速查表 | 把知识点压缩到一页 |
| 读书笔记摘要 | 一本书的精华浓缩到一页 |
| 项目周报 / 日报 | 固定一页的汇报格式 |
| 产品说明卡 | 硬件产品的快速参考卡 |
| 活动传单 | 快速排版活动信息 |
| 菜单 / 价目表 | 单页价格表 |
| 求职信 / 自荐信 | 配合简历的另一页 |

适用于任何**需要精确控制在一页纸内**的内容。


## 技术栈

| 技术 | 用途 |
|------|------|
| [Pretext](https://github.com/chenglou/pretext) | Canvas 文本测量，无 DOM reflow |
| [marked](https://github.com/markedjs/marked) | Markdown 解析 |
| Vite + TypeScript | 构建与类型安全 |
| Playwright | 无头浏览器渲染 + PDF/PNG 导出 |
| Google Fonts | 中英文字体加载 |

## License

MIT
