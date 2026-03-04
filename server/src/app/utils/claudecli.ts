import { execSync, spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { readFileSync, existsSync, unlinkSync, statSync } from "node:fs";
import { transToTiebaOldBrother } from "./openai.js";
import { CHECK_COMMIT } from "./prompt.js";
import { getProjectsRoot, getProjectPath } from "./pathUtils.js";

export interface ClaudeExecOptions {
    projectId?: string;
    projectPath?: string;
    query: string;
    outputFormat?: 'text' | 'json' | 'stream-json';
    model?: string;
    maxTurns?: number;
    timeout?: number;
    cleanup?: boolean;
    extraArgs?: string[];
    // System prompt options
    systemPrompt?: string;
    systemPromptFile?: string;
    appendSystemPrompt?: string;
    // Additional directories
    addDir?: string[];
    // Permission and agent options
    permissionMode?: string;
    agents?: string; // JSON string
    allowedTools?: string[];
    disallowedTools?: string[];
    // Continue/resume options
    continue?: boolean;
    resume?: string;
    // Other flags
    verbose?: boolean;
    dangerouslySkipPermissions?: boolean;
}

export interface ClaudeExecResult {
    success: boolean;
    message: string;
    output?: string;
    stdout?: string;
    stderr?: string;
    tiebaSummary?: string;
}


/**
 * 使用 Claude CLI 分析项目
 * 使用 -p 标志进行非交互式查询
 */
export async function analyzeProject(options: ClaudeExecOptions): Promise<ClaudeExecResult> {
    const {
        projectId,
        projectPath,
        query,
        outputFormat = 'text',
        model,
        maxTurns,
        timeout = 10 * 60 * 1000,
        cleanup = false,
        extraArgs = [],
        systemPrompt,
        systemPromptFile,
        appendSystemPrompt,
        addDir,
        permissionMode,
        agents,
        allowedTools,
        disallowedTools,
        continue: continueFlag,
        resume,
        verbose,
        dangerouslySkipPermissions,
    } = options;
    console.log("timeout", timeout);
    const targetPath = getProjectPath(projectId, projectPath);
    if (!targetPath) {
        return {
            success: false,
            message: projectId ? `项目 ${projectId} 不存在` : '未指定项目ID或项目路径',
        };
    }

    if (!existsSync(targetPath)) {
        return {
            success: false,
            message: `项目路径不存在: ${targetPath}`,
        };
    }

    // 转义查询字符串
    const transQuery = query.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\\/g, '\\\\');
    
    // 构建命令参数
    const args: string[] = [];
    
    // Print mode (non-interactive)
    args.push('-p', `"${transQuery}"`);
    
    // Output format
    if (outputFormat) {
        args.push('--output-format', outputFormat);
    }
    
    // Model
    if (model) {
        args.push('--model', model);
    }
    
    // Max turns
    if (maxTurns !== undefined) {
        args.push('--max-turns', String(maxTurns));
    }
    
    // System prompt options
    if (systemPrompt) {
        const transSystemPrompt = systemPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\\/g, '\\\\');
        args.push('--system-prompt', `"${transSystemPrompt}"`);
    }
    
    if (systemPromptFile) {
        args.push('--system-prompt-file', systemPromptFile);
    }
    
    if (appendSystemPrompt) {
        const transAppendPrompt = appendSystemPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\\/g, '\\\\');
        args.push('--append-system-prompt', `"${transAppendPrompt}"`);
    }
    
    // Additional directories
    if (addDir && addDir.length > 0) {
        for (const dir of addDir) {
            args.push('--add-dir', dir);
        }
    }
    
    // Permission mode
    if (permissionMode) {
        args.push('--permission-mode', permissionMode);
    }
    
    // Agents (JSON string)
    if (agents) {
        args.push('--agents', agents);
    }
    
    // Allowed/disallowed tools
    if (allowedTools && allowedTools.length > 0) {
        args.push('--allowedTools', ...allowedTools);
    }
    
    if (disallowedTools && disallowedTools.length > 0) {
        args.push('--disallowedTools', ...disallowedTools);
    }
    
    // Continue/resume
    if (continueFlag) {
        args.push('--continue');
    }
    
    if (resume) {
        args.push('--resume', resume);
    }
    
    // Verbose
    if (verbose) {
        args.push('--verbose');
    }
    
    // Dangerously skip permissions
    if (dangerouslySkipPermissions) {
        args.push('--dangerously-skip-permissions');
    }
    
    // Extra args
    if (extraArgs.length > 0) {
        args.push(...extraArgs);
    }

    try {
        const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
            const child = spawn('claude', args, {
                cwd: targetPath,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true,
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (chunk: Buffer) => {
                stdout += chunk.toString('utf-8');
            });

            child.stderr?.on('data', (chunk: Buffer) => {
                stderr += chunk.toString('utf-8');
            });

            const timeoutId = setTimeout(() => {
                child.kill();
                reject(new Error(`超时 ${timeout}ms`));
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timeoutId);
                resolve({ stdout, stderr, code });
            });

            child.on('error', (error: any) => {
                clearTimeout(timeoutId);
                if (error.code === 'ENOENT') {
                    reject(new Error('找不到 claude 命令，请确保已安装 Claude CLI 并在 PATH 中'));
                } else {
                    reject(error);
                }
            });
        });

        // 根据输出格式处理结果
        let outputContent: string | undefined;
        
        if (outputFormat === 'json' || outputFormat === 'stream-json') {
            try {
                // 尝试解析 JSON 输出
                const jsonOutput = JSON.parse(result.stdout);
                outputContent = typeof jsonOutput === 'string' 
                    ? jsonOutput 
                    : JSON.stringify(jsonOutput, null, 2);
            } catch {
                // 如果不是有效 JSON，直接使用 stdout
                outputContent = result.stdout;
            }
        } else {
            outputContent = result.stdout;
        }

        const isSuccess = result.code === 0 || outputContent !== undefined;

        return {
            success: isSuccess,
            message: isSuccess ? '执行成功' : `退出码 ${result.code}`,
            output: outputContent,
            stdout: result.stdout || undefined,
            stderr: result.stderr || undefined,
        };
    } catch (error: any) {
        console.log('analyzeProject error', error);
        return {
            success: false,
            message: error.message || String(error),
            output: undefined,
            stderr: error.message || String(error),
        };
    }
}

/**
 * 生成贴吧老哥风格总结
 * @param content 要总结的内容
 * @returns 贴吧老哥风格总结，失败时返回 undefined
 */
async function generateTiebaSummary(content: string): Promise<string | undefined> {
    if (!content || content.trim().length === 0) {
        return undefined;
    }

    try {
        // 限制内容长度，避免 API 调用过长
        const contentToSummarize = content.length > 8000 
            ? content.substring(0, 8000) + '...' 
            : content;
        const summaryResult = await transToTiebaOldBrother(contentToSummarize);
        return summaryResult || undefined;
    } catch (summaryError: any) {
        console.warn('生成贴吧老哥总结失败:', summaryError.message || String(summaryError));
        return undefined;
    }
}

/**
 * 同步版本
 */
export function analyzeProjectSync(options: ClaudeExecOptions): ClaudeExecResult {
    const {
        projectId,
        projectPath,
        query,
        outputFormat = 'text',
        model,
        maxTurns,
        cleanup = false,
        extraArgs = [],
        systemPrompt,
        systemPromptFile,
        appendSystemPrompt,
        addDir,
        permissionMode,
        agents,
        allowedTools,
        disallowedTools,
        continue: continueFlag,
        resume,
        verbose,
        dangerouslySkipPermissions,
    } = options;

    const targetPath = getProjectPath(projectId, projectPath);
    if (!targetPath) {
        return {
            success: false,
            message: projectId ? `项目 ${projectId} 不存在` : '未指定项目ID或项目路径',
        };
    }

    if (!existsSync(targetPath)) {
        return {
            success: false,
            message: `项目路径不存在: ${targetPath}`,
        };
    }

    // 构建命令参数
    const args: string[] = [];
    
    // Print mode (non-interactive)
    args.push('-p', query);
    
    // Output format
    if (outputFormat) {
        args.push('--output-format', outputFormat);
    }
    
    // Model
    if (model) {
        args.push('--model', model);
    }
    
    // Max turns
    if (maxTurns !== undefined) {
        args.push('--max-turns', String(maxTurns));
    }
    
    // System prompt options
    if (systemPrompt) {
        args.push('--system-prompt', systemPrompt);
    }
    
    if (systemPromptFile) {
        args.push('--system-prompt-file', systemPromptFile);
    }
    
    if (appendSystemPrompt) {
        args.push('--append-system-prompt', appendSystemPrompt);
    }
    
    // Additional directories
    if (addDir && addDir.length > 0) {
        for (const dir of addDir) {
            args.push('--add-dir', dir);
        }
    }
    
    // Permission mode
    if (permissionMode) {
        args.push('--permission-mode', permissionMode);
    }
    
    // Agents (JSON string)
    if (agents) {
        args.push('--agents', agents);
    }
    
    // Allowed/disallowed tools
    if (allowedTools && allowedTools.length > 0) {
        args.push('--allowedTools', ...allowedTools);
    }
    
    if (disallowedTools && disallowedTools.length > 0) {
        args.push('--disallowedTools', ...disallowedTools);
    }
    
    // Continue/resume
    if (continueFlag) {
        args.push('--continue');
    }
    
    if (resume) {
        args.push('--resume', resume);
    }
    
    // Verbose
    if (verbose) {
        args.push('--verbose');
    }
    
    // Dangerously skip permissions
    if (dangerouslySkipPermissions) {
        args.push('--dangerously-skip-permissions');
    }
    
    // Extra args
    if (extraArgs.length > 0) {
        args.push(...extraArgs);
    }

    // 转义参数用于 execSync
    const escapedArgs = args.map(arg => {
        if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
            return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
    });
    const command = `claude ${escapedArgs.join(' ')}`;

    try {
        const execOptions: any = {
            cwd: targetPath,
            encoding: 'utf-8' as const,
            stdio: ['ignore', 'pipe', 'pipe'] as const,
            maxBuffer: 50 * 1024 * 1024,
            shell: true,
        };
        
        const stdout = execSync(command, execOptions) as string;

        // 根据输出格式处理结果
        let outputContent: string | undefined;
        
        if (outputFormat === 'json' || outputFormat === 'stream-json') {
            try {
                const jsonOutput = JSON.parse(stdout);
                outputContent = typeof jsonOutput === 'string' 
                    ? jsonOutput 
                    : JSON.stringify(jsonOutput, null, 2);
            } catch {
                outputContent = stdout;
            }
        } else {
            outputContent = stdout;
        }

        return {
            success: true,
            message: '执行成功',
            output: outputContent,
            stdout: stdout.trim() || undefined,
        };
    } catch (error: any) {
        const stderr = error.stderr?.toString() || error.stderr || '';
        const errorMessage = error.message || stderr || String(error);

        return {
            success: false,
            message: errorMessage.includes('ENOENT') || errorMessage.includes('找不到')
                ? '找不到 claude 命令，请确保已安装 Claude CLI 并在 PATH 中'
                : `执行失败: ${errorMessage}`,
            output: undefined,
            stderr: stderr || errorMessage,
        };
    }
}

/**
 * checkCommit 函数的选项
 * 继承自 ClaudeExecOptions，但排除 query 和 projectId（由函数参数提供）
 */
export interface CheckCommitOptions extends Omit<ClaudeExecOptions, 'query' | 'projectId'> {
}

/**
 * 检查指定项目的 Git 提交
 * 使用 CHECK_COMMIT 预设提示对提交进行全面审查
 * @param projectId 项目ID
 * @param commitHash 提交哈希
 * @param options 可选参数
 * @returns 代码审查结果
 */
export async function checkCommit(
    projectId: string,
    commitHash: string,
    options: CheckCommitOptions = {}
): Promise<ClaudeExecResult> {
    // 使用 CHECK_COMMIT 预设提示
    const query = CHECK_COMMIT(commitHash);

    // 执行代码审查
    const result = await analyzeProject({
        projectId,
        query,
        timeout: 10 * 60 * 1000,
        outputFormat: 'text',
        ...options,
    });

    // 仅在成功且有输出时生成贴吧老哥总结
    if (result.success && result.output && result.output.trim().length > 0) {
        const tiebaSummary = await generateTiebaSummary(result.output);
        return {
            ...result,
            tiebaSummary,
        };
    }

    return result;
}
