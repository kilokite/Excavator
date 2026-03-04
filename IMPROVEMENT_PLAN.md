# 项目改进计划与待办事项

## 📋 项目概述

本项目是一个前后端分离的飞书自动回复机器人，用于代码审查和提交分析。使用 tRPC 进行 RPC 通信，采用 monorepo 结构。

## 🎯 改进目标

- 提高代码可维护性
- 遵循 SOLID 原则
- 增强代码可测试性
- 改善代码组织结构
- 统一错误处理和配置管理

---

## ✅ 待办事项清单

### 🔴 高优先级（立即处理）

#### 1. 拆分大型文件 - `main.ts` 重构
- [ ] 将 `checkCommitWithRetry` 函数拆分为独立服务
  - [ ] 创建 `services/commitCheckService.ts`
  - [ ] 创建 `utils/retryHandler.ts`
  - [ ] 创建 `services/reportService.ts`
- [ ] 将自动检查逻辑提取为独立服务
  - [ ] 创建 `services/autoCheckService.ts`
  - [ ] 创建 `handlers/autoCheckHandler.ts`
- [ ] 将消息发送逻辑提取为服务
  - [ ] 创建 `services/messageService.ts`
  - [ ] 定义 `MessageService` 接口

**预计工作量**: 2-3 天  
**影响范围**: `server/src/app/main.ts`

#### 2. 统一配置管理
- [ ] 创建统一的配置管理模块
  - [ ] 创建 `config/index.ts` 集中管理所有配置
  - [ ] 使用环境变量验证（zod schema）
  - [ ] 移除硬编码的魔法数字
- [ ] 迁移现有配置
  - [ ] 迁移 `config.ts` 中的配置
  - [ ] 迁移 `constants.ts` 中的常量
  - [ ] 迁移 `autoCheckConfig.ts` 中的配置
- [ ] 添加配置验证
  - [ ] 启动时验证必需的环境变量
  - [ ] 提供清晰的错误提示

**预计工作量**: 1 天  
**影响范围**: `server/src/config/`, `server/src/app/config/`

#### 3. 统一错误处理
- [ ] 创建错误类型系统
  - [ ] 创建 `errors/index.ts` 定义错误基类
  - [ ] 定义具体的错误类型（ValidationError, RetryError 等）
  - [ ] 添加错误码枚举
- [ ] 实现统一错误处理中间件
  - [ ] 创建 `middleware/errorHandler.ts`
  - [ ] 在 tRPC 中添加错误处理
  - [ ] 在 Express 路由中添加错误处理
- [ ] 替换现有的错误处理
  - [ ] 替换 `main.ts` 中的错误处理
  - [ ] 替换各个服务中的错误处理

**预计工作量**: 1-2 天  
**影响范围**: `server/src/errors/`, `server/src/middleware/`

#### 4. 类型安全改进
- [ ] 移除 `any` 类型
  - [ ] 审查所有使用 `any` 的地方
  - [ ] 定义明确的类型或使用 `unknown`
- [ ] 增强类型定义
  - [ ] 为错误对象定义类型
  - [ ] 为配置对象定义类型
  - [ ] 为函数返回值定义 Result 类型
- [ ] 添加严格的 TypeScript 配置
  - [ ] 启用 `strict: true`
  - [ ] 启用 `noImplicitAny: true`

**预计工作量**: 1-2 天  
**影响范围**: 全项目

---

### 🟡 中优先级（近期处理）

#### 5. 依赖注入与接口抽象
- [ ] 定义服务接口
  - [ ] `MessageService` 接口
  - [ ] `CommitChecker` 接口
  - [ ] `Storage` 接口
  - [ ] `ProjectManager` 接口
- [ ] 实现依赖注入容器
  - [ ] 创建简单的 DI 容器或使用现有库
  - [ ] 注册所有服务
- [ ] 重构现有代码使用接口
  - [ ] 重构 `main.ts` 使用注入的服务
  - [ ] 重构各个 handler 使用接口

**预计工作量**: 2-3 天  
**影响范围**: `server/src/services/`, `server/src/app/`

#### 6. 数据访问层抽象
- [ ] 定义存储接口
  - [ ] 创建 `repositories/storage.interface.ts`
  - [ ] 定义通用 CRUD 操作接口
- [ ] 重构 DataManager
  - [ ] 实现 `Storage` 接口
  - [ ] 重命名为 `FileStorage` 或 `JsonFileStorage`
- [ ] 为项目配置创建 Repository
  - [ ] 创建 `repositories/projectRepository.ts`
  - [ ] 封装项目配置的所有操作

**预计工作量**: 1-2 天  
**影响范围**: `server/src/repositories/`, `server/src/utils/data.ts`

#### 7. 单一职责原则重构
- [ ] 拆分 `checkCommitWithRetry` 函数
  - [ ] 提取重试逻辑到 `RetryHandler`
  - [ ] 提取验证逻辑到 `CommitValidator`
  - [ ] 提取报告处理到 `ReportProcessor`
- [ ] 拆分 `checkProjectCommits` 函数
  - [ ] 提取 Git 操作到服务
  - [ ] 提取提交检测逻辑
  - [ ] 提取通知发送逻辑

**预计工作量**: 2 天  
**影响范围**: `server/src/app/main.ts`

#### 8. 中间件系统增强
- [ ] 添加中间件元数据
  - [ ] 定义 `MiddlewareMeta` 接口
  - [ ] 为每个中间件添加元数据
- [ ] 添加中间件调试工具
  - [ ] 添加中间件执行日志
  - [ ] 添加性能监控
- [ ] 改进中间件类型系统
  - [ ] 增强类型推断
  - [ ] 添加中间件组合工具函数

**预计工作量**: 1 天  
**影响范围**: `server/src/app/core/app.ts`, `server/src/app/middleware/`

---

### 🟢 低优先级（长期优化）

#### 9. 测试基础设施
- [ ] 设置测试框架
  - [ ] 安装 Vitest 或 Jest
  - [ ] 配置测试环境
  - [ ] 创建测试工具函数
- [ ] 编写单元测试
  - [ ] 为工具函数编写测试
  - [ ] 为服务编写测试
  - [ ] 为中间件编写测试
- [ ] 编写集成测试
  - [ ] 为 API 端点编写测试
  - [ ] 为命令处理编写测试

**预计工作量**: 3-5 天  
**影响范围**: `server/src/__tests__/`, `server/vitest.config.ts`

#### 10. 文档完善
- [ ] 架构文档
  - [ ] 创建 `ARCHITECTURE.md` 说明系统架构
  - [ ] 创建 `DESIGN_PATTERNS.md` 说明设计模式
- [ ] API 文档
  - [ ] 为 tRPC 路由添加文档
  - [ ] 创建 API 使用示例
- [ ] 开发文档
  - [ ] 创建 `CONTRIBUTING.md` 开发规范
  - [ ] 创建 `DEVELOPMENT.md` 开发指南
- [ ] 代码注释
  - [ ] 为所有公共 API 添加 JSDoc
  - [ ] 为复杂逻辑添加注释

**预计工作量**: 2-3 天  
**影响范围**: 文档目录

#### 11. 代码组织优化
- [ ] 重构目录结构
  - [ ] 创建 `domain/` 目录存放领域模型
  - [ ] 创建 `repositories/` 目录
  - [ ] 整理 `utils/` 目录，按功能分类
- [ ] 模块化改进
  - [ ] 确保每个模块职责单一
  - [ ] 减少模块间耦合
  - [ ] 添加模块边界文档

**预计工作量**: 2-3 天  
**影响范围**: `server/src/` 目录结构

#### 12. 性能优化
- [ ] 性能分析
  - [ ] 识别性能瓶颈
  - [ ] 添加性能监控
- [ ] 优化改进
  - [ ] 优化数据库查询（如果有）
  - [ ] 优化文件 I/O 操作
  - [ ] 添加缓存机制

**预计工作量**: 2-3 天  
**影响范围**: 全项目

#### 13. 日志系统改进
- [ ] 统一日志格式
  - [ ] 使用结构化日志
  - [ ] 添加日志级别
- [ ] 日志工具
  - [ ] 集成日志库（如 winston, pino）
  - [ ] 添加日志轮转
  - [ ] 添加日志聚合（可选）

**预计工作量**: 1-2 天  
**影响范围**: `server/src/utils/logger.ts`

---

## 📊 进度跟踪

### 总体进度
- 总任务数: 13 个大项，约 50+ 个子任务
- 已完成: 0
- 进行中: 0
- 待开始: 13

### 按优先级统计
- 🔴 高优先级: 4 项
- 🟡 中优先级: 4 项
- 🟢 低优先级: 5 项

---

## 🎓 设计原则参考

### SOLID 原则
- **S**ingle Responsibility: 每个类/函数只做一件事
- **O**pen/Closed: 对扩展开放，对修改关闭
- **L**iskov Substitution: 子类可以替换父类
- **I**nterface Segregation: 接口隔离，不要强迫实现不需要的方法
- **D**ependency Inversion: 依赖抽象而不是具体实现

### 其他原则
- **DRY** (Don't Repeat Yourself): 避免代码重复
- **KISS** (Keep It Simple, Stupid): 保持简单
- **YAGNI** (You Aren't Gonna Need It): 不要过度设计
- **关注点分离**: 将不同关注点分离到不同模块

---

## 📝 实施建议

### 阶段一：基础重构（1-2 周）
1. 完成高优先级任务 1-4
2. 建立新的代码结构基础
3. 确保现有功能不受影响

### 阶段二：架构优化（2-3 周）
1. 完成中优先级任务 5-8
2. 引入依赖注入
3. 完善抽象层

### 阶段三：质量提升（2-3 周）
1. 完成低优先级任务 9-13
2. 添加测试覆盖
3. 完善文档

---

## 🔄 更新日志

- **2024-XX-XX**: 初始版本创建

---

## 📌 注意事项

1. **渐进式重构**: 不要一次性重构所有代码，采用渐进式方式
2. **保持功能**: 重构过程中确保现有功能正常工作
3. **测试先行**: 在重构前先添加测试（如果可能）
4. **代码审查**: 重要变更需要代码审查
5. **文档同步**: 代码变更时同步更新文档

---

## 🤝 贡献指南

在开始任何任务前：
1. 在对应的待办项前添加 `[进行中]` 标记
2. 完成后将 `[ ]` 改为 `[x]`
3. 更新进度跟踪部分
4. 提交 PR 时引用对应的任务编号

---

*本文档会根据项目进展持续更新*

