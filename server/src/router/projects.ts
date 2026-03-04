import { router, publicPro } from '../trpc/trpc.js';
import { getSelectedProjectLatestCommit, getLatestCommitAcrossBranches, fetchProject } from '../app/utils/gitTools.js';
import { investigateProject, investigateProjectSync } from '../app/utils/codexcli.js';
import { analyzeProject, analyzeProjectSync } from '../app/utils/claudecli.js';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { list, get, search, exists, add, remove, configs } from '../app/utils/project.js';

const PROJECTS_ROOT = resolve(fileURLToPath(new URL('../../projects', import.meta.url)));

function serializeCommit(commit: ReturnType<typeof getLatestCommitAcrossBranches>) {
    if (!commit) {
        return null;
    }
    const { committedAt, ...rest } = commit;
    return {
        ...rest,
        committedAt: committedAt.toISOString(),
    };
}

function getProjectDirectories(): string[] {
    try {
        return readdirSync(PROJECTS_ROOT, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    } catch (error) {
        console.error('读取项目目录失败:', error);
        return [];
    }
}

export default router({
    // 获取所有项目的最新提交
    latestCommits: publicPro.query(() => {
        const projectDirs = getProjectDirectories();
        return projectDirs.map((name) => {
            const repoPath = join(PROJECTS_ROOT, name);
            const latest = getLatestCommitAcrossBranches({ repoPath });
            return {
                name,
                latestCommit: serializeCommit(latest),
            };
        });
    }),
    
    // 获取指定项目的最新提交
    getSelectedProjectLatestCommit: publicPro
        .input(z.string().describe('项目ID'))
        .query(({ input: projectId }) => {
            const latest = getSelectedProjectLatestCommit(projectId);
            return serializeCommit(latest);
        }),
    
    // 获取所有项目列表
    getProjectList: publicPro.query(() => {
        return getProjectDirectories();
    }),
    
    // 对指定项目执行 git fetch
    fetchProject: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            prune: z.boolean().optional().default(true).describe('是否删除已不存在的远程分支引用'),
            all: z.boolean().optional().default(true).describe('是否获取所有远程仓库'),
        }))
        .mutation(({ input }) => {
            return fetchProject(input.projectId, {
                prune: input.prune,
                all: input.all,
            });
        }),
    
    // 使用 codex 调查项目
    // 参考 Codex CLI 文档: https://docs.codex.com/cli-reference#codex-exec
    investigateProject: publicPro
        .input(z.object({
            projectId: z.string().optional().describe('项目ID'),
            projectPath: z.string().optional().describe('项目完整路径'),
            query: z.string().describe('查询问题'),
            fullAuto: z.boolean().optional().default(true).describe('是否使用全自动模式'),
            outputFile: z.string().optional().default('answer.txt').describe('输出文件名'),
            timeout: z.number().optional().describe('超时时间（毫秒）'),
            cleanup: z.boolean().optional().default(false).describe('是否删除输出文件'),
            extraArgs: z.array(z.string()).optional().default([]).describe('额外参数'),
            useSync: z.boolean().optional().default(false).describe('是否使用同步版本'),
        }))
        .mutation(async ({ input }) => {
            const { useSync, ...options } = input;
            
            if (useSync) {
                return investigateProjectSync(options);
            } else {
                return await investigateProject(options);
            }
        }),
    
    // 使用 Claude CLI 分析项目
    // 参考 Claude CLI 文档: https://docs.anthropic.com/claude/docs/claude-code-cli-reference
    analyzeProject: publicPro
        .input(z.object({
            projectId: z.string().optional().describe('项目ID'),
            projectPath: z.string().optional().describe('项目完整路径'),
            query: z.string().describe('查询问题'),
            outputFormat: z.enum(['text', 'json', 'stream-json']).optional().default('text').describe('输出格式'),
            model: z.string().optional().describe('模型名称（如 claude-sonnet-4-5-20250929 或 sonnet/opus）'),
            maxTurns: z.number().optional().describe('最大轮次限制'),
            timeout: z.number().optional().describe('超时时间（毫秒）'),
            cleanup: z.boolean().optional().default(false).describe('是否清理'),
            extraArgs: z.array(z.string()).optional().default([]).describe('额外参数'),
            useSync: z.boolean().optional().default(false).describe('是否使用同步版本'),
            // System prompt options
            systemPrompt: z.string().optional().describe('自定义系统提示（替换整个默认提示）'),
            systemPromptFile: z.string().optional().describe('从文件加载系统提示'),
            appendSystemPrompt: z.string().optional().describe('追加到默认系统提示'),
            // Additional directories
            addDir: z.array(z.string()).optional().describe('添加额外的工作目录'),
            // Permission and agent options
            permissionMode: z.string().optional().describe('权限模式'),
            agents: z.string().optional().describe('自定义子代理 JSON 配置'),
            allowedTools: z.array(z.string()).optional().describe('允许的工具列表'),
            disallowedTools: z.array(z.string()).optional().describe('禁止的工具列表'),
            // Continue/resume options
            continue: z.boolean().optional().describe('继续最近的对话'),
            resume: z.string().optional().describe('恢复指定会话ID'),
            // Other flags
            verbose: z.boolean().optional().describe('启用详细日志'),
            dangerouslySkipPermissions: z.boolean().optional().describe('跳过权限提示（谨慎使用）'),
        }))
        .mutation(async ({ input }) => {
            const { useSync, ...options } = input;
            
            if (useSync) {
                return analyzeProjectSync(options);
            } else {
                return await analyzeProject(options);
            }
        }),
    
    // 获取所有项目信息（包含配置）
    getAllProjectsInfo: publicPro.query(() => {
        return list();
    }),
    
    // 获取项目详细信息（包含配置）
    getProjectInfo: publicPro
        .input(z.string().describe('项目ID'))
        .query(({ input: projectId }) => {
            const project = get(projectId);
            if (!project) {
                throw new Error(`项目 ${projectId} 不存在`);
            }
            return project;
        }),
    
    // 搜索项目
    searchProjects: publicPro
        .input(z.string().describe('搜索关键词'))
        .query(({ input: keyword }) => {
            return search(keyword);
        }),
    
    // 检查项目是否存在
    projectExists: publicPro
        .input(z.string().describe('项目ID'))
        .query(({ input: projectId }) => {
            return exists(projectId);
        }),
    
    // 添加项目
    addProject: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            gitRemote: z.string().optional().describe('Git远程仓库地址'),
            name: z.string().optional().describe('项目名称（别名）'),
            description: z.string().optional().describe('项目描述'),
            tags: z.array(z.string()).optional().describe('项目标签'),
        }))
        .mutation(({ input }) => {
            return add(input.projectId, {
                gitRemote: input.gitRemote,
                name: input.name,
                description: input.description,
                tags: input.tags,
            });
        }),
    
    // 更新项目配置
    updateProjectConfig: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            name: z.string().optional().describe('项目名称（别名）'),
            description: z.string().optional().describe('项目描述'),
            gitRemote: z.string().optional().describe('Git远程仓库地址'),
            tags: z.array(z.string()).optional().describe('项目标签'),
            commitDetailUrlTemplate: z.string().optional().describe('提交详情链接模板（支持 {commitHash} 和 {projectId} 变量）'),
        }))
        .mutation(({ input }) => {
            if (!exists(input.projectId)) {
                throw new Error(`项目 ${input.projectId} 不存在`);
            }
            const config = configs[input.projectId] || { id: input.projectId };
            const now = new Date().toISOString();
            if (input.name !== undefined) config.name = input.name;
            if (input.description !== undefined) config.description = input.description;
            if (input.gitRemote !== undefined) config.gitRemote = input.gitRemote;
            if (input.tags !== undefined) config.tags = input.tags;
            if (input.commitDetailUrlTemplate !== undefined) config.commitDetailUrlTemplate = input.commitDetailUrlTemplate;
            if (!config.createdAt) config.createdAt = now;
            config.updatedAt = now;
            configs[input.projectId] = config;
            return { success: true, message: `已更新项目 ${input.projectId} 的配置` };
        }),
    
    // 删除项目（目录和配置）
    deleteProject: publicPro
        .input(z.string().describe('项目ID'))
        .mutation(({ input: projectId }) => {
            return remove(projectId);
        }),
});

