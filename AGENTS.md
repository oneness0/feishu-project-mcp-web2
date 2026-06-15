# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1 为设计意图与决策上下文。Code agent 实现时以 Section 2 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解（每项一句话，不展开）

- **目标用户**: 开发者/内部测试人员，验证应用骨架是否就绪，预期安静、无干扰的初始状态
- **核心目的**: 告知应用已初始化完成，传递「干净起跑」的起点感
- **情绪基调**: 通透克制 / 避免喧闹或过度装饰

### 1.2 设计方向（每项一行）

- **Design Style**: Muji 极简 — 纯白底+细字+充裕留白，精确匹配「白纸」隐喻与零功能骨架定位
- **Application Type**: Tool/SPA — 单页欢迎界面，无导航无业务模块
- **Aesthetic Direction**: 极致减法，仅靠排版呼吸感与微动效建立存在感

## 2. Color System (色彩系统)

**色彩关系**: 纯白基底 + 浅灰文字 + 极淡暖灰点缀，无色相干扰
**配色设计理由**: 「干净起跑」需消除所有视觉噪音，低饱和灰阶确保后续功能扩展时不冲突
**主色推导**: primary 取深墨灰而非品牌色，因当前无业务语义，仅承载「就绪」状态确认
**使用比例**: 95% 白/近白背景 · 4% 浅灰文字 · 1% 深灰主色（仅限标题与焦点态）

### 2.1 主题颜色

| Token                | HSL 值           | 说明                                     |
| -------------------- | ---------------- | ---------------------------------------- |
| `background`         | hsl(0 0% 99%)    | 近纯白底，避免 #fff 刺眼                 |
| `card`               | hsl(0 0% 99%)    | 同背景，当前无卡片区分需求               |
| `foreground`         | hsl(0 0% 25%)    | 主文字，柔黑不刺目                       |
| `muted-foreground`   | hsl(0 0% 62%)    | 副标题与占位提示                         |
| `primary`            | hsl(0 0% 13%)    | 标题与渐入动画锚点                       |
| `primary-foreground` | hsl(0 0% 99%)    | 仅在按钮填充时使用（当前无按钮）         |
| `accent`             | hsl(0 0% 96%)    | hover/focus 极淡反馈，几乎不可见         |
| `accent-foreground`  | hsl(0 0% 25%)    | accent 上的文字                          |
| `border`             | hsl(0 0% 92%)    | 仅在必要时出现，默认隐藏                 |

### 2.2 Topbar/Header 设计策略

- **背景策略**: 无顶部导航；页面全屏居中，无边框无分隔线
- **文字/图标**: 不适用
- **边框与分隔**: 不适用

## 3. Typography (字体排版)

- **Heading**: Inter + -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- **Body**: Inter + -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- **字体策略**: Inter 的几何中性特质强化「白纸」感；中文回退优先苹方/思源黑体 Regular，禁用 Bold 以上字重

## 4. Layout Strategy (布局策略)

- **导航策略**: None — 单页骨架无需导航，避免任何结构干扰
- **页面架构**: 全屏垂直水平居中，`max-w-lg` 约束文字行宽，确保移动端可读性
- **响应式**: 全设备统一居中布局；字号使用 `clamp()` 平滑缩放，无断点切换

## 5. Visual Language (视觉语言)

- **形态参数**: 圆角 `rounded-sm (2px)` · 阴影 `shadow-none` · 间距基调 `spacious`
- **识别签名**: 标题 `text-4xl font-light tracking-tight` · 副标题 `text-base font-normal text-muted-foreground` · 全局无装饰元素
- **装饰策略**: 零装饰；唯一视觉事件为标题 `fade-in-up 800ms ease-out` 渐入动画
- **动效原则**: 仅入场动画 800ms；无 hover/click 动效，保持静态克制感
- **可及性**: 前景/背景对比度 ≥ 7:1；动画支持 `prefers-reduced-motion` 降级为瞬时显示

## 6. Component Principles (组件原则)

- **状态完整性**: 当前仅有文本展示；若后续加入按钮，需覆盖 Default/Hover/Focus/Disabled 四态
- **层级清晰**: 标题与副标题仅通过字号+字重+颜色三级区分，无额外样式修饰
- **一致性**: 所有文字使用同一字体栈；颜色严格引用 token，禁止内联 hex/rgb

## 7. Image Direction (图片与视觉资产)

- **Image Role**: 无
- **Image Art Direction**: 无强制图片需求，纯排版驱动视觉
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 禁止添加插画、图标、背景纹理、渐变光晕等任何非文字视觉元素

## 项目架构

## 技术栈
- 前端: React 19 + TypeScript + Tailwind CSS + styled-jsx
- 路由: React Router DOM v6
- 布局: 无导航，全屏居中单页

## 页面结构
- `/` → 首页（HomePage）：极简欢迎页，纯白背景居中排版

# 8. 应避免 (Anti-patterns)

- ❌ 添加 Logo、图标、分割线、Footer 等应用概要设计未声明的结构元素
- ❌ 使用彩色、渐变、阴影或粗体破坏「白纸」纯净感
- ❌ 在欢迎语外增加引导文案、链接、按钮等提前引入功能预期