import { execSync, spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { readFileSync, existsSync, unlinkSync, statSync } from "node:fs";
import { getProjectsRoot, getProjectPath } from "./pathUtils.js";

export interface CodexExecOptions {
    projectId?: string;
    projectPath?: string;
    query: string;
    fullAuto?: boolean;
    outputFile?: string;
    timeout?: number;
    cleanup?: boolean;
    extraArgs?: string[];
}

export interface CodexExecResult {
    success: boolean;
    message: string;
    output?: string;
    stdout?: string;
    stderr?: string;
    outputFilePath?: string;
}


/**
 * 使用 codex 调查项目
 */
export async function investigateProject(options: CodexExecOptions): Promise<CodexExecResult> {
    const {
        projectId,
        projectPath,
        query,
        fullAuto = true,
        outputFile = 'answer.txt',
        timeout = 10 * 60 * 1000,
        cleanup = false,
        extraArgs = [],
    } = options;

    let transQuery = query.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\\/g, '\\\\');
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

    const outputFilePath = join(targetPath, outputFile);
    const executionStartTime = Date.now();

    // 清理旧文件
    if (existsSync(outputFilePath)) {
        try {
            unlinkSync(outputFilePath);
        } catch (e) {
            console.warn('清理旧文件失败:', e);
        }
    }

    // 构建命令参数
    const args = ['exec', `"${query}"`];
    if (fullAuto) args.push('--full-auto');
    args.push('--output-last-message', outputFile);
    if (extraArgs.length > 0) args.push(...extraArgs);

    try {
        const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
            // 使用 shell: true 以通过 PATH 查找 codex 命令
            // 使用参数数组形式，spawn 会正确处理参数，不会被拆分
            const child = spawn('codex', args, {
                cwd: targetPath,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true, // 使用 shell 以支持 PATH 查找
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
                    reject(new Error('找不到 codex 命令，请确保已安装并在 PATH 中'));
                } else {
                    reject(error);
                }
            });
        });

        // 读取输出文件
        let outputContent: string | undefined;
        if (existsSync(outputFilePath)) {
            try {
                const fileStats = statSync(outputFilePath);
                if (fileStats.mtimeMs >= executionStartTime) {
                    outputContent = readFileSync(outputFilePath, 'utf-8');
                }
                if (cleanup) {
                    try {
                        unlinkSync(outputFilePath);
                    } catch (e) {
                        console.warn('清理失败:', e);
                    }
                }
            } catch (e) {
                console.error('读取文件失败:', e);
            }
        }

        const isSuccess = result.code === 0 || outputContent !== undefined;

        return {
            success: isSuccess,
            message: isSuccess ? '执行成功' : `退出码 ${result.code}`,
            output: outputContent,
            stdout: result.stdout || undefined,
            stderr: result.stderr || undefined,
            outputFilePath: cleanup ? undefined : outputFilePath,
        };
    } catch (error: any) {
        let outputContent: string | undefined;
        if (existsSync(outputFilePath)) {
            try {
                const fileStats = statSync(outputFilePath);
                if (fileStats.mtimeMs >= executionStartTime) {
                    outputContent = readFileSync(outputFilePath, 'utf-8');
                }
            } catch {
                // 忽略
            }
        }

        return {
            success: false,
            message: error.message || String(error),
            output: outputContent,
            stderr: error.message || String(error),
        };
    }
}

/**
 * 同步版本
 */
export function investigateProjectSync(options: CodexExecOptions): CodexExecResult {
    const {
        projectId,
        projectPath,
        query,
        fullAuto = true,
        outputFile = 'answer.txt',
        cleanup = false,
        extraArgs = [],
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

    const outputFilePath = join(targetPath, outputFile);
    const executionStartTime = Date.now();

    // 清理旧文件
    if (existsSync(outputFilePath)) {
        try {
            unlinkSync(outputFilePath);
        } catch (e) {
            console.warn('清理旧文件失败:', e);
        }
    }

    // 构建命令
    const args = ['exec', query];
    if (fullAuto) args.push('--full-auto');
    args.push('--output-last-message', outputFile);
    if (extraArgs.length > 0) args.push(...extraArgs);

    // 转义参数用于 execSync
    const escapedArgs = args.map(arg => {
        if (arg.includes(' ') || arg.includes('"')) {
            return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
    });
    const command = `codex ${escapedArgs.join(' ')}`;

    try {
        const execOptions: any = {
            cwd: targetPath,
            encoding: 'utf-8' as const,
            stdio: ['ignore', 'pipe', 'pipe'] as const,
            maxBuffer: 50 * 1024 * 1024,
            shell: true,
        };

        const stdout = execSync(command, execOptions) as string;

        // 读取输出文件
        let outputContent: string | undefined;
        if (existsSync(outputFilePath)) {
            try {
                const fileStats = statSync(outputFilePath);
                if (fileStats.mtimeMs >= executionStartTime) {
                    outputContent = readFileSync(outputFilePath, 'utf-8');
                }
                if (cleanup) {
                    try {
                        unlinkSync(outputFilePath);
                    } catch (e) {
                        console.warn('清理失败:', e);
                    }
                }
            } catch (e) {
                console.error('读取文件失败:', e);
            }
        }

        return {
            success: true,
            message: '执行成功',
            output: outputContent,
            stdout: stdout.trim() || undefined,
            outputFilePath: cleanup ? undefined : outputFilePath,
        };
    } catch (error: any) {
        let outputContent: string | undefined;
        if (existsSync(outputFilePath)) {
            try {
                const fileStats = statSync(outputFilePath);
                if (fileStats.mtimeMs >= executionStartTime) {
                    outputContent = readFileSync(outputFilePath, 'utf-8');
                }
            } catch {
                // 忽略
            }
        }

        const stderr = error.stderr?.toString() || error.stderr || '';
        const errorMessage = error.message || stderr || String(error);

        return {
            success: false,
            message: errorMessage.includes('ENOENT') || errorMessage.includes('找不到')
                ? '找不到 codex 命令，请确保已安装并在 PATH 中'
                : `执行失败: ${errorMessage}`,
            output: outputContent,
            stderr: stderr || errorMessage,
        };
    }
}

