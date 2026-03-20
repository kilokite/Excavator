# 代码审查挖掘机 - Excavator

一个面向飞书群聊的 AI 代码审查机器人，提供「消息机器人 + Web 管理台 + 报告存储」一体化能力。  
当前项目为 Monorepo：`server`（Express + tRPC）和 `client`（Vue 3 + Vuetify）。

![预览](./docs/assets/d033e22ae3-1772469123648-0a833a44-4d89-413c-8111-b13412f96175.png)
![预览2](./docs/assets/1.png)

## 项目简介

挖掘机用于在团队协作场景里，把「代码提交检查」和「群聊机器人交互」串成完整闭环：

- 在飞书群里发命令即可触发指定仓库提交审查
- 自动保存报告并支持 Web 页面检索、筛选、追溯
- 支持定时自动检查，减少人工轮询成本
- 支持 Function Calling 工具化操作（项目、报告、Git、搜索、消息等）
- 提供 tRPC API，便于前端和后续扩展能力复用

## 核心能力

| 模块 | 说明 |
| --- | --- |
| 提交审查 | 对指定 `projectId` + `commitHash` 生成 AI 代码审查报告 |
| 项目管理 | 项目列表、项目配置、远程仓库信息、项目搜索与删除 |
| 报告中心 | 报告列表、分页筛选、作者筛选、摘要高亮、详情查看 |
| 自动检查 | 按项目轮询最新提交并自动生成报告（可全局开关） |
| 飞书机器人 | 命令交互 + 普通对话，支持 Function Calling 工具调用 |
| Git 工具 | 状态、日志、分支、diff、fetch 等仓库操作 |
| 运行统计 | 消息处理、报告生成、工具调用等统计接口 |
| AI 记忆管理 | 会话历史快照与清空（受鉴权保护） |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3 + TypeScript + Vuetify + Pinia + Vue Router + Vite |
| 后端 | Node.js + Express + tRPC + TypeScript |
| 数据 | SQLite（`better-sqlite3`） |
| AI | OpenAI SDK（当前默认接 DeepSeek Base URL） |
| 机器人 | 飞书 Lark WebSocket SDK |
| 工程化 | pnpm workspace（根脚本统一调度） |

## 目录结构

```text
EX/
├── client/                           # 前端管理台 (Vue 3)
│   ├── src/
│   │   ├── pages/                    # 页面（工作台、报告、自动检查、设置等）
│   │   ├── components/               # 组件（报告渲染、认证等）
│   │   ├── store/                    # Pinia 状态管理
│   │   └── server.ts                 # tRPC Client
│   └── package.json
├── server/                           # 后端 API + 飞书机器人
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                 # 应用核心抽象（App/Context/Types）
│   │   │   ├── middleware/           # 消息处理中间件链
│   │   │   ├── command/              # 飞书命令系统与处理器
│   │   │   ├── fun_call/             # Function Calling 工具与处理器
│   │   │   ├── services/             # 自动检查、飞书服务等
│   │   │   └── utils/                # 业务工具函数
│   │   ├── router/                   # tRPC 路由（auth/projects/reports/git...）
│   │   ├── utils/                    # SQLite、报告派生等通用模块
│   │   ├── config.example.ts         # 配置模板
│   │   ├── config.ts                 # 本地配置（不应提交真实密钥）
│   │   └── index.ts                  # HTTP 服务入口 + 机器人启动
│   ├── public/                       # 前端构建静态资源（构建后）
│   ├── projects/                     # 受管项目目录（运行时使用）
│   └── package.json
├── scripts/build.js                  # 生成 dist/package.json 的部署脚本
├── docs/                             # 项目文档
│   └── DEPLOYMENT.md                 # 部署指南
├── IMPROVEMENT_PLAN.md               # 改进规划
└── package.json                      # workspace 根脚本
```

## 快速开始

### 1) 环境要求

- Node.js >= 18
- pnpm >= 8（推荐）
- Claude Code CLI（用于 `analyzeProject` 相关能力）
- Codex CLI（用于 `investigateProject` 相关能力）
- 可访问飞书开放平台与 AI API

### 2) 安装依赖

```bash
pnpm install
```

### 3) 安装外部 CLI（必需）

后端的部分项目分析能力会调用本机 CLI，请确保以下命令可用：

```bash
claude --version
codex --version
```

若命令不存在，请先按各官方文档完成安装并登录授权，再启动服务。

### 4) 配置后端

建议使用 `server/src/config.example.ts` 作为模板，复制为 `server/src/config.ts` 后填写本地配置。  
也可以通过环境变量覆盖关键项。

最小必填项：

```bash
LARK_APP_ID=your_lark_app_id
LARK_APP_SECRET=your_lark_app_secret
OPENAI_API_KEY=your_api_key
```

可选项（联网搜索能力）：

```bash
BIGMODEL_API_KEY=your_bigmodel_api_key
WEB_SEARCH_API_KEY=your_web_search_api_key
```

> 飞书机器人需在 [飞书开放平台](https://open.feishu.cn/) 完成应用创建、消息事件订阅与权限配置。

### 5) 启动开发模式

```bash
# 同时启动 client + server
pnpm run dev

# 分开启动
pnpm run dev:server
pnpm run dev:client
```

默认端口：

- 前端开发服务器：`http://localhost:23421`（可用 `FRONTEND_PORT` 覆盖）
- 后端服务：`http://localhost:13431`

### 6) 构建生产版本

```bash
pnpm run build
```

构建完成后：

- 前端资源输出到 `server/public/`
- 根目录生成 `dist/package.json`（用于精简部署依赖）

## 使用说明

### 飞书命令（常用）

> 实际命令以 `server/src/app/command/handler/` 实现为准，以下是常见能力示例。

```text
checkcommit <projectId> <commitHash>     # 审查指定提交
chatid                                    # 获取当前会话 chatId

project list                              # 查看项目
project add <projectId> [gitRemote]       # 添加项目
project info <projectId>                  # 查看项目信息

report get <reportId>                     # 获取报告
report list <projectId>                   # 项目报告列表

git status <projectId>
git log <projectId> [branch] [limit]
git branch <projectId>
git diff <projectId> <commitHash>
```

### Web 管理台

后端启动后访问：`http://localhost:13431`

- 工作台：项目概览、近期状态
- 报告页：报告检索、筛选与阅读
- 自动检查：任务配置与开关
- 设置页：基础偏好配置

### 关键 API 能力（tRPC）

- `auth`：登录
- `projects`：项目查询/配置/fetch/外部分析能力
- `reports`：报告查询、筛选、批量生成
- `git`：仓库操作
- `autoCheck`：自动检查配置管理
- `stats`：统计汇总
- `memory`：AI 记忆快照与清理（鉴权）

## 消息处理链路

```text
parseMessage -> messageContext -> dedupe -> rebuttal -> command -> normalReply(AI)
```

- `messageContext` 会将原始事件与解析结果注入上下文，供 AI 回复时使用
- `normalReply` 支持 Function Calling，自动调用工具并回写会话记忆

## 安全建议

- 不要把真实密钥提交到仓库；本地配置请放在忽略文件中
- 生产环境务必修改默认登录口令与鉴权 token 逻辑
- 建议将飞书、AI 等密钥通过环境变量注入

## 部署文档

已提供独立部署指南：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

包含：

- 单机部署步骤
- PM2 守护配置
- Nginx 反向代理示例
- 升级与回滚建议
- 常见问题排查

## 开发扩展

- 新命令：`server/src/app/command/handler/`
- 新 Function：`server/src/app/fun_call/functions/`
- 新中间件：`server/src/app/middleware/`
- 新路由：`server/src/router/`

## License

MIT