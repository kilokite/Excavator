# 部署指南

本文档描述 `EX` 项目的推荐生产部署方式（单机 + PM2 + Nginx）。

## 1. 部署前准备

- 系统：Linux（Ubuntu 22.04+ 推荐）
- Node.js：18+
- pnpm：8+
- Git
- Claude Code CLI（用于 `analyzeProject` 路由能力）
- Codex CLI（用于 `investigateProject` 路由能力）
- 可访问飞书与 AI API

建议目录：

```bash
/opt/excavator
```

## 2. 拉取代码与安装依赖

```bash
git clone <your-repo-url> /opt/excavator
cd /opt/excavator
pnpm install --frozen-lockfile
```

建议在服务器上验证 CLI 可用性：

```bash
claude --version
codex --version
```

若命令不存在，请先安装并完成授权登录。

## 3. 配置运行参数

复制示例配置并填写：

```bash
cp server/src/config.example.ts server/src/config.ts
```

至少确认以下配置有效：

- `PORT`（后端监听端口，默认 `13431`）
- `LARK_APP_ID`
- `LARK_APP_SECRET`
- `OPENAI_API_KEY`

可选：

- `BIGMODEL_API_KEY`
- `WEB_SEARCH_API_KEY`
- `FRONTEND_URL` / `FRONTEND_PORT`（影响机器人消息中的前端链接）

## 4. 构建

在仓库根目录执行：

```bash
pnpm run build
```

构建结果：

- 服务端编译产物：`server/dist/`
- 前端静态资源：`server/public/`
- 部署辅助包描述：`dist/package.json`

## 5. 启动方式（推荐 PM2）

### 5.1 安装 PM2

```bash
npm install -g pm2
```

### 5.2 启动应用

```bash
cd /opt/excavator/server
pm2 start dist/index.js --name excavator
pm2 save
pm2 startup
```

### 5.3 常用命令

```bash
pm2 status
pm2 logs excavator
pm2 restart excavator
pm2 stop excavator
```

## 6. Nginx 反向代理（可选）

示例：将公网 `80` 转发到后端 `13431`。

```nginx
server {
    listen 80;
    server_name your.domain.com;

    location / {
        proxy_pass http://127.0.0.1:13431;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

检查并重载：

```bash
nginx -t && systemctl reload nginx
```

## 7. 健康检查

部署后至少验证：

1. 访问 `http://127.0.0.1:13431` 能打开前端页面
2. `http://127.0.0.1:13431/trpc` 路由可用（接口调用成功）
3. 飞书机器人成功建立连接并可响应消息
4. 触发一次 `checkcommit`，确认报告生成流程完整

## 8. 升级流程

```bash
cd /opt/excavator
git pull
pnpm install --frozen-lockfile
pnpm run build
pm2 restart excavator
```

## 9. 回滚建议

- 保留最近可用版本 tag（如 `deploy-2026-03-20`）
- 回滚时 `git checkout <tag>` 后重新构建并重启 PM2
- 变更配置前备份 `server/src/config.ts`

## 10. 常见问题

- 飞书机器人未启动：检查 `LARK_APP_ID`/`LARK_APP_SECRET`，以及开放平台事件订阅配置
- AI 回复失败：检查 `OPENAI_API_KEY` 与网络连通性
- 页面 404：确认已执行 `pnpm run build`，且 `server/public/` 下有静态资源
- 鉴权失败：确认请求头 token 与服务端鉴权逻辑一致

## 11. 生产安全清单

- 禁止提交真实密钥到仓库
- 使用环境变量注入密钥（CI/CD 或服务器 secret 管理）
- 替换默认账号口令和 token 校验逻辑
- 给部署目录最小权限，避免以 root 长期运行应用
