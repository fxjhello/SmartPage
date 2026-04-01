export interface Sample {
  label: string
  value: string
  content: string
}

export const SAMPLES: Sample[] = [
  {
    label: '个人简历',
    value: 'resume',
    content: `# 张伟

![avatar](https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face)

**高级软件工程师** | 上海
zhang.wei@email.com | +86 138-0000-0000

---

## 工作经历

### 技术负责人 — Acme 科技有限公司
*2022 - 至今*

- 带领 8 人工程团队交付实时数据分析平台
- 通过缓存优化和查询重构，将 API 响应时间降低 60%
- 设计并落地微服务架构，日均承载 5000 万+ 请求

### 高级工程师 — 字节流科技
*2019 - 2022*

- 搭建核心推荐引擎，基于协同过滤算法
- 实施 CI/CD 流水线，部署时间从 2 小时缩短至 15 分钟
- 通过 Code Review 和结对编程指导 5 名初级开发者

### 软件工程师 — 创业科技 XYZ
*2017 - 2019*

- 使用 React、Node.js 和 PostgreSQL 进行全栈开发
- 交付 3 个核心产品功能，保持 99.9% 可用率

---

## 技术技能

**编程语言：** TypeScript、Python、Go、Rust
**框架：** React、Next.js、FastAPI、Gin
**基础设施：** AWS、Kubernetes、Docker、Terraform
**数据：** PostgreSQL、Redis、Elasticsearch、Kafka

---

## 教育背景

### 复旦大学 — 计算机科学硕士
*2015 - 2017*

### 同济大学 — 软件工程学士
*2011 - 2015*
`,
  },
]
