# Function Call 使用指南

本文档介绍如何为系统添加新的 Function Call，让 AI 模型能够调用外部工具来增强自身能力。

## 目录

1. [Function Call 简介](#function-call-简介)
2. [如何添加新的 Function Call](#如何添加新的-function-call)
3. [示例：添加获取 Git Diff 的函数](#示例添加获取-git-diff-的函数)
4. [最佳实践](#最佳实践)
5. [常见问题](#常见问题)

## Function Call 简介

Function Calling 允许 AI 模型调用外部工具来获取信息或执行操作。当用户询问需要实时数据或执行操作的问题时，模型会自动调用相应的函数。

### 工作流程

1. 用户发送消息
2. AI 模型分析消息，决定是否需要调用函数
3. 如果需要，模型返回函数调用请求（tool_calls）
4. 系统执行函数并返回结果
5. 模型根据函数结果生成最终回复

## 如何添加新的 Function Call

添加新的 Function Call 需要三个步骤：

### 步骤 1: 实现函数逻辑

在 `functions/` 目录下的相应文件中添加你的函数实现（按功能分类）：

```typescript
/**
 * 你的函数描述
 * @param param1 参数1说明
 * @param param2 参数2说明
 * @returns 返回结果说明
 */
export async function yourFunctionName(param1: string, param2: number): Promise<string> {
    try {
        // 实现你的逻辑
        const result = await doSomething(param1, param2);
        return `执行结果: ${result}`;
    } catch (error) {
        return `执行失败: ${error instanceof Error ? error.message : String(error)}`;
    }
}
```

**重要提示：**
- 函数必须返回 `Promise<string>`
- 函数应该处理错误并返回友好的错误消息
- 函数名应该使用下划线命名（snake_case），如 `get_git_log`

### 步骤 2: 注册函数到映射表

在 `functions/index.ts` 文件的 `functionHandlers` 对象中注册你的函数：

```typescript
export const functionHandlers: Record<string, (...args: any[]) => Promise<string>> = {
    get_git_log: getGitLog,
    get_latest_commit: getLatestCommit,
    // ... 其他函数
    your_function_name: yourFunctionName, // 添加你的函数
};
```

**注意：** 键名（`your_function_name`）必须与步骤 3 中工具定义的 `name` 字段一致。

### 步骤 3: 定义工具 Schema

在 `tools.ts` 文件的 `getFunctionCallTools()` 函数中添加工具定义：

```typescript
export function getFunctionCallTools() {
    return [
        // ... 其他工具
        {
            type: "function" as const,
            function: {
                name: "your_function_name", // 必须与 functionHandlers 中的键名一致
                description: "详细描述这个函数的功能。AI 模型会根据这个描述决定是否调用此函数。描述应该清晰说明函数的用途、适用场景等。",
                parameters: {
                    type: "object",
                    properties: {
                        param1: {
                            type: "string",
                            description: "参数1的详细说明",
                        },
                        param2: {
                            type: "integer",
                            description: "参数2的详细说明",
                            minimum: 1,
                            maximum: 100,
                            default: 10,
                        },
                    },
                    required: ["param1"], // 必填参数列表
                    additionalProperties: false, // 必须为 false
                },
            },
        },
    ];
}
```

**工具定义要点：**

1. **name**: 函数名，必须与 `functionHandlers` 中的键名一致
2. **description**: 详细描述，AI 模型根据此描述决定是否调用函数
3. **parameters**: JSON Schema 格式的参数定义
   - `type`: 参数类型（string, integer, number, boolean, array, object）
   - `description`: 参数说明
   - `required`: 必填参数数组
   - `additionalProperties`: 必须为 `false`

**支持的参数类型和约束：**

- **string**: 支持 `format`（email, hostname, ipv4, ipv6, uuid）和 `pattern`（正则表达式）
- **integer/number**: 支持 `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `const`, `default`
- **boolean**: 支持 `default`
- **array**: 支持 `items` 定义数组元素类型
- **enum**: 限制值为预定义的几个选项之一
- **anyOf**: 匹配多个 schema 中的任意一个

## 示例：添加获取 Git Diff 的函数

让我们通过一个完整示例来演示如何添加新的 Function Call。

### 步骤 1: 实现函数

在 `functions/git.ts` 中添加（Git 相关函数）：

```typescript
/**
 * 获取指定项目的 Git diff
 * @param projectId 项目ID
 * @param target 比较目标（可选，如 commit hash、分支名等）
 * @returns diff 信息
 */
export async function getGitDiff(projectId: string, target?: string): Promise<string> {
    try {
        const validation = validateProject(projectId);
        if (!validation.valid || !validation.projectPath) {
            return `错误: ${validation.error}`;
        }

        const projectPath = validation.projectPath;
        const command = target ? `git diff ${target}` : 'git diff';
        
        try {
            const output = execSync(command, {
                cwd: projectPath,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: 10 * 1024 * 1024,
            });
            
            const diffOutput = output.trim();
            if (!diffOutput) {
                return `项目 ${projectId} 没有差异`;
            }
            
            // 限制输出长度，避免消息过长
            const maxLength = 2000;
            if (diffOutput.length > maxLength) {
                return `项目 ${projectId} 的差异:\n${diffOutput.substring(0, maxLength)}\n\n...(输出已截断)`;
            }
            
            return `项目 ${projectId} 的差异:\n${diffOutput}`;
        } catch (error: any) {
            const stderr = error.stderr?.toString() || error.stderr || '';
            const errorMessage = stderr || error.message || String(error);
            return `获取 git diff 失败: ${errorMessage}`;
        }
    } catch (error) {
        return `获取 git diff 时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}
```

### 步骤 2: 注册函数

在 `functionHandlers` 中添加：

```typescript
export const functionHandlers: Record<string, (...args: any[]) => Promise<string>> = {
    get_git_log: getGitLog,
    get_latest_commit: getLatestCommit,
    get_git_status: getGitStatus,
    get_git_branches: getGitBranches,
    get_git_diff: getGitDiff, // 添加新函数
};
```

### 步骤 3: 定义工具 Schema

在 `getFunctionCallTools()` 中添加：

```typescript
{
    type: "function" as const,
    function: {
        name: "get_git_diff",
        description: "获取指定项目的 Git 工作区差异或提交之间的差异。当用户询问项目的变更、差异、diff 等信息时使用此函数。",
        parameters: {
            type: "object",
            properties: {
                projectId: {
                    type: "string",
                    description: "项目ID，即 projects 目录下的子目录名称",
                },
                target: {
                    type: "string",
                    description: "可选，比较目标。可以是 commit hash、分支名、tag 等。如果不提供，则比较工作区与暂存区的差异。",
                },
            },
            required: ["projectId"],
            additionalProperties: false,
        },
    },
}
```

完成！现在 AI 模型可以在用户询问 Git diff 相关信息时自动调用这个函数了。

## 最佳实践

### 1. 函数命名

- 使用下划线命名（snake_case）：`get_git_log`、`get_latest_commit`
- 名称应该清晰表达函数功能
- 保持命名风格一致

### 2. 错误处理

- 始终使用 try-catch 捕获错误
- 返回友好的错误消息，而不是抛出异常
- 错误消息应该帮助用户理解问题

```typescript
try {
    // 你的逻辑
} catch (error) {
    return `执行失败: ${error instanceof Error ? error.message : String(error)}`;
}
```

### 3. 参数验证

- 在函数内部验证参数有效性
- 对于项目相关的函数，使用 `validateProject()` 验证项目是否存在
- 返回清晰的验证错误消息

### 4. 输出格式

- 返回格式化的、易读的结果
- 对于长输出，考虑截断或分页
- 使用 Markdown 格式增强可读性（如果支持）

### 5. 工具描述

- **description** 应该详细说明函数的用途和适用场景
- 描述应该帮助 AI 模型准确判断何时调用此函数
- 包含关键词，让模型能够识别用户意图

**好的描述示例：**
```
"获取指定项目的 Git 提交历史记录。当用户询问项目的提交历史、最近的提交、git log 等信息时使用此函数。"
```

**不好的描述示例：**
```
"获取 git log"
```

### 6. 参数描述

- 每个参数都应该有清晰的 `description`
- 说明参数的用途、格式要求、可选性等
- 对于有约束的参数（如范围、格式），在描述中说明

### 7. 性能考虑

- 避免执行耗时过长的操作
- 对于可能阻塞的操作，考虑异步处理
- 限制输出长度，避免消息过长

## 常见问题

### Q1: 函数没有被调用？

**可能原因：**
1. 工具描述不够清晰，AI 模型无法识别何时应该调用
2. 函数名与 `functionHandlers` 中的键名不一致
3. 参数定义有问题（如缺少 `additionalProperties: false`）

**解决方法：**
- 检查工具定义中的 `description` 是否详细且包含关键词
- 确认函数名在 `functionHandlers` 和工具定义中完全一致
- 检查参数 schema 是否符合规范

### Q2: 函数执行失败？

**可能原因：**
1. 函数内部逻辑错误
2. 参数验证失败
3. 外部依赖（如 Git 命令）执行失败

**解决方法：**
- 检查函数实现中的错误处理
- 添加日志记录，便于调试
- 确保返回友好的错误消息

### Q3: 如何调试 Function Call？

**调试技巧：**
1. 在函数中添加 `console.log` 记录执行过程
2. 检查 `normalReply.ts` 中的消息历史
3. 查看 AI 模型的 tool_calls 响应

### Q4: 可以调用异步操作吗？

**可以。** 函数必须返回 `Promise<string>`，所以可以执行任何异步操作。例如：

```typescript
export async function fetchRemoteData(url: string): Promise<string> {
    const response = await fetch(url);
    const data = await response.json();
    return JSON.stringify(data);
}
```

### Q5: 如何限制函数调用频率？

目前没有内置的频率限制机制。如果需要，可以在函数实现中添加缓存或限流逻辑。

### Q6: 函数可以调用其他函数吗？

**可以。** 函数可以调用其他已注册的函数，但要注意避免循环调用。

## 参考资源

- [DeepSeek Function Calling 文档](https://platform.deepseek.com/docs/guides/function-calling)
- [JSON Schema 规范](https://json-schema.org/)
- OpenAI Function Calling 最佳实践

## 现有 Function Call 列表

- `get_git_log`: 获取 Git 提交历史
- `get_latest_commit`: 获取最新提交信息
- `get_git_status`: 获取工作区状态
- `get_git_branches`: 获取分支列表

---

如有问题或建议，请联系开发团队。
















