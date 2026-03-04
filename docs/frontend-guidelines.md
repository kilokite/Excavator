# 前端开发规范（excavator / client）

本文档约定 `client/` 目录下的 Vue3 + Vite + TypeScript 项目开发规范，目标是：**一致性、可维护性、安全性、信息密度与交互体验**。

---

## 1. 技术栈与基本约定

- **框架**：Vue 3（`<script setup lang="ts">`）
- **路由**：`vite-plugin-pages` 自动路由（`client/src/pages/**`）
- **UI**：Vuetify 3
- **数据请求**：tRPC client（`client/src/server.ts`）
- **状态管理**：Pinia（`client/src/store/**`）
- **Markdown**：`markdown-it` + `mermaid` + `dompurify`，统一通过 `MarkdownRenderer` 渲染（见 6.4）

---

## 2. 目录结构规范

### 2.1 必须遵守的结构

- **页面**：`client/src/pages/**`
  - 页面文件名与路由一致，如 `pages/reports/index.vue` -> `/reports`
  - 动态路由使用 `[param].vue`，如 `pages/report/[reportId].vue` -> `/report/:reportId`
- **业务组件**：`client/src/components/**`
  - 跨页面复用组件必须放组件目录，不要写在页面里
- **全局布局**：`client/src/components/frame/Normal.vue`（由 `App.vue` 组合）
- **服务端代理**：`client/src/server.ts`（tRPC client）
- **状态**：`client/src/store/**`（Pinia）

### 2.2 命名约定

- **组件文件**：`PascalCase.vue`（如 `MarkdownRenderer.vue`）
- **工具模块**：`camelCase.ts`（如 `markdownUtils.ts`）
- **页面**：遵循路由目录结构（`index.vue` / `[id].vue`）
- **CSS 类名**：`kebab-case`（如 `.page-toolbar`）

---

## 3. 页面/组件编码规范（Vue + TS）

### 3.1 `<script setup>` 书写顺序

建议固定顺序，减少查找成本：

1. imports
2. types/interfaces
3. constants（含枚举映射）
4. `ref/reactive/computed`
5. fetch/side-effect functions
6. UI handlers
7. `watch/onMounted/onBeforeUnmount`

### 3.2 类型定义

- **禁止 `any` 漫延**：仅在与后端返回不稳定字段兼容时允许使用索引签名 `Record<string, unknown>` 或 `[k: string]: any`，并在注释说明原因。
- **对外数据结构**：优先使用后端返回结构（tRPC 类型推导）。如果手写 interface，要与后端保持同步。

### 3.3 状态与副作用

- 页面内状态尽量使用 `ref`，复杂对象再用 `reactive`。
- `watch` 必须说明意图；避免 watch 里写复杂流程，复杂逻辑抽成函数。
- `IntersectionObserver`/事件监听必须在 `onBeforeUnmount` 释放。

---

## 4. UI/交互规范（Vuetify 3）

### 4.1 风格统一：更“后台系统”而非 demo

- **尽量少用阴影卡片**：优先 `v-sheet` 或普通容器 + `border`/`divider` 做分割。
- **信息密度优先**：列表条目尽可能展示关键字段，必要时提供“展开/收起”。
- **顶部工具栏**：页面级操作（刷新/切换视图/搜索）放顶部工具栏。
- **右侧辅助区**：目录、筛选、统计等信息放右侧面板（可 sticky）。

### 4.2 交互与反馈

- 所有异步操作必须有：`loading` 状态 + 错误提示（snackbar/alert）。
- 批量操作必须有：选中数量提示、禁用状态、成功/失败统计。
- 一切按钮禁用必须有明确条件（如 `!selectedProjectId`）。

---

## 5. 数据请求规范（tRPC）

### 5.1 统一入口

- 只允许通过 `client/src/server.ts` 的 `server.xxx.yyy` 调用接口。

### 5.2 错误处理

- try/catch 必须给用户可理解的错误提示（不要只 `console.log`）。
- 对列表型接口：失败时要保证 UI 状态可恢复（例如清空/停止加载更多）。

### 5.3 分页/无限加载

- 列表优先支持 **分页参数**（`limit/offset` 或 `limit/skip`），前端实现“加载更多/滚动触底”。
- 需要同时支持按钮兜底（避免浏览器不支持 IntersectionObserver 时无法加载）。

---

## 6. 内容渲染规范（Markdown / Mermaid / 安全）

### 6.1 统一渲染组件

- **禁止在页面里手写 Markdown 正则替换**。
- Markdown 渲染必须统一使用：`client/src/components/reports/MarkdownRenderer.vue`。

### 6.2 Mermaid 支持

- 规范写法：

```md
```mermaid
graph TD
  A --> B
```
```

### 6.3 XSS 安全

- 任何 `v-html` 输出必须经过清理。
- 本项目规范：`MarkdownRenderer` 内部使用 `dompurify` 进行 sanitize。

### 6.4 目录（TOC）规范

- 标题必须使用 Markdown `#`/`##`/`###`… 生成。
- 标题 `id` 规则统一由 `client/src/components/reports/markdownUtils.ts` 生成，确保 TOC 点击跳转稳定。

---

## 7. 性能与可维护性

- 列表渲染：避免一次性渲染超大文本；使用预览 + 展开模式。
- `computed` 要有缓存收益；不用就删（保持 lint 清洁）。
- 大文本（报告全文）渲染：优先在容器内渲染，不扫描全局 DOM。

---

## 8. 代码等级与展示规范

代码等级从低到高固定为：

1. 有机肥（红 / error）
2. 不可回收垃圾（橙 / warning）
3. 可回收垃圾（蓝 / info）
4. 非垃圾（绿 / success）

UI 必须使用颜色高亮（如 `v-chip`），并保持同一套映射。

---

## 9. 提交与变更规范（建议）

- 一次 PR/提交只解决一个问题域（UI、接口、重构不要混太散）。
- 修改接口时必须同步更新前端类型/调用点，避免“接口变了页面没变”。
- 新增组件必须：
  - 可复用（props 明确、无隐藏依赖）
  - 有最小必要注释（说明用途/边界）

---

## 10. 自检清单（提交前 1 分钟）

- [ ] 页面是否符合“工具栏 + 分割线 + 信息密度”的后台风格？
- [ ] 异步请求是否有 loading/错误提示？
- [ ] 列表是否支持分页/加载更多？失败是否能恢复？
- [ ] 是否避免了手写 Markdown 正则？是否统一用 `MarkdownRenderer`？
- [ ] 是否存在潜在 XSS（`v-html` 未 sanitize）？
- [ ] lints 是否通过（仅改动文件）？

