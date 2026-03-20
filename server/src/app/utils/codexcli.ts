import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { transToTiebaOldBrother } from "./openai.js";
import { CHECK_COMMIT } from "./prompt.js";
import { getProjectPath } from "./pathUtils.js";

export interface CodexExecOptions {
    projectId?: string;
    projectPath?: string;
    query: string;
    timeout?: number;
    cleanup?: boolean; // map to --ephemeral
    extraArgs?: string[];
    // Codex CLI specific flags
    model?: string;
    profile?: string;
    sandbox?: "read-only" | "workspace-write" | "danger-full-access";
    oss?: boolean;
    fullAuto?: boolean;
    json?: boolean;
    outputLastMessage?: string;
    outputSchema?: string;
    color?: "always" | "never" | "auto";
    skipGitRepoCheck?: boolean;
    dangerouslyBypassApprovalsAndSandbox?: boolean;
}

export interface CodexExecResult {
    success: boolean;
    message: string;
    output?: string;
    stdout?: string;
    stderr?: string;
    tiebaSummary?: string;
    outputFilePath?: string;
}

/**
 * 使用 Codex CLI (codex exec) 分析项目
 * 非交互式执行，返回一次性结果
 */
export async function analyzeProject(options: CodexExecOptions): Promise<CodexExecResult> {
    const {
        projectId,
        projectPath,
        query,
        timeout = 10 * 60 * 1000,
        cleanup = false,
        extraArgs = [],
        model,
        profile,
        sandbox,
        oss,
        fullAuto,
        json,
        outputLastMessage,
        outputSchema,
        color,
        skipGitRepoCheck,
        dangerouslyBypassApprovalsAndSandbox,
    } = options;

    const targetPath = getProjectPath(projectId, projectPath);
    if (!targetPath) {
        return {
            success: false,
            message: projectId ? `项目 ${projectId} 不存在` : "未指定项目ID或项目路径",
        };
    }

    if (!existsSync(targetPath)) {
        return {
            success: false,
            message: `项目路径不存在: ${targetPath}`,
        };
    }

    // 构建 codex exec 命令参数
    const args: string[] = [];
    args.push("exec");

    if (color) {
        args.push("--color", color);
    }

    if (model) {
        args.push("--model", model);
    }

    if (profile) {
        args.push("--profile", profile);
    }

    if (sandbox) {
        args.push("--sandbox", sandbox);
    }

    if (oss) {
        args.push("--oss");
    }

    if (fullAuto) {
        args.push("--full-auto");
    }

    if (json) {
        args.push("--json");
    }

    if (cleanup) {
        // 不持久化会话
        args.push("--ephemeral");
    }

    if (outputLastMessage) {
        args.push("--output-last-message", outputLastMessage);
    }

    if (outputSchema) {
        args.push("--output-schema", outputSchema);
    }

    if (skipGitRepoCheck) {
        args.push("--skip-git-repo-check");
    }

    if (dangerouslyBypassApprovalsAndSandbox) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    if (extraArgs.length > 0) {
        args.push(...extraArgs);
    }

    // PROMPT 放在最后，作为单独参数传递
    args.push(query);

    try {
        const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
            const child = spawn("codex", args, {
                cwd: targetPath,
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stdout = "";
            let stderr = "";

            child.stdout?.on("data", (chunk: Buffer) => {
                stdout += chunk.toString("utf-8");
            });

            child.stderr?.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf-8");
            });

            const timeoutId = setTimeout(() => {
                child.kill();
                reject(new Error(`超时 ${timeout}ms`));
            }, timeout);

            child.on("close", (code) => {
                clearTimeout(timeoutId);
                resolve({ stdout, stderr, code });
            });

            child.on("error", (error: any) => {
                clearTimeout(timeoutId);
                if (error.code === "ENOENT") {
                    reject(new Error("找不到 codex 命令，请确保已安装 Codex CLI 并在 PATH 中"));
                } else {
                    reject(error);
                }
            });
        });

        const isSuccess = result.code === 0 || !!result.stdout;

        return {
            success: isSuccess,
            message: isSuccess ? "执行成功" : `退出码 ${result.code}`,
            output: result.stdout || undefined,
            stdout: result.stdout || undefined,
            stderr: result.stderr || undefined,
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || String(error),
            output: undefined,
            stderr: error.message || String(error),
        };
    }
}

export interface InvestigateProjectOptions {
    projectId?: string;
    projectPath?: string;
    query: string;
    fullAuto?: boolean;
    outputFile?: string;
    timeout?: number;
    cleanup?: boolean;
    extraArgs?: string[];
}

/**
 * 使用 Codex CLI 调查项目（带输出文件）
 */
export async function investigateProject(
    options: InvestigateProjectOptions
): Promise<CodexExecResult> {
    const {
        projectId,
        projectPath,
        query,
        fullAuto = true,
        outputFile = "answer.txt",
        timeout = 10 * 60 * 1000,
        cleanup = false,
        extraArgs = [],
    } = options;

    const targetPath = getProjectPath(projectId, projectPath);
    if (!targetPath) {
        return {
            success: false,
            message: projectId ? `项目 ${projectId} 不存在` : "未指定项目ID或项目路径",
        };
    }

    if (!existsSync(targetPath)) {
        return {
            success: false,
            message: `项目路径不存在: ${targetPath}`,
        };
    }

    const outputFilePath = join(targetPath, outputFile);

    const args: string[] = [];
    args.push("exec");

    if (fullAuto) {
        args.push("--full-auto");
    }

    if (extraArgs.length > 0) {
        args.push(...extraArgs);
    }

    args.push("--output-last-message", outputFile);
    // PROMPT 作为单独参数传递，避免被 CLI 拆分
    args.push(query);

    try {
        const result = await new Promise<{
            stdout: string;
            stderr: string;
            code: number | null;
        }>((resolve, reject) => {
            const child = spawn("codex", args, {
                cwd: targetPath,
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stdout = "";
            let stderr = "";

            child.stdout?.on("data", (chunk: Buffer) => {
                stdout += chunk.toString("utf-8");
            });

            child.stderr?.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf-8");
            });

            const timeoutId = setTimeout(() => {
                child.kill();
                reject(new Error(`超时 ${timeout}ms`));
            }, timeout);

            child.on("close", (code) => {
                clearTimeout(timeoutId);
                resolve({ stdout, stderr, code });
            });

            child.on("error", (error: any) => {
                clearTimeout(timeoutId);
                if (error.code === "ENOENT") {
                    reject(
                        new Error(
                            "找不到 codex 命令，请确保已安装 Codex CLI 并在 PATH 中"
                        )
                    );
                } else {
                    reject(error);
                }
            });
        });

        let fileContent: string | undefined;
        if (existsSync(outputFilePath)) {
            try {
                fileContent = readFileSync(outputFilePath, "utf-8");
            } catch (readError: any) {
                console.warn(
                    "读取 Codex 输出文件失败:",
                    readError.message || String(readError)
                );
            }
        }

        if (cleanup && existsSync(outputFilePath)) {
            try {
                unlinkSync(outputFilePath);
            } catch (unlinkError: any) {
                console.warn(
                    "删除 Codex 输出文件失败:",
                    unlinkError.message || String(unlinkError)
                );
            }
        }

        const isSuccess = result.code === 0 || !!fileContent || !!result.stdout;

        return {
            success: isSuccess,
            message: isSuccess ? "执行成功" : `退出码 ${result.code}`,
            output: fileContent,
            stdout: result.stdout || undefined,
            stderr: result.stderr || undefined,
            outputFilePath,
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || String(error),
            output: undefined,
            stderr: error.message || String(error),
            outputFilePath,
        };
    }
}

/**
 * 同步版本 investigateProject
 */
export function investigateProjectSync(
    options: InvestigateProjectOptions
): CodexExecResult {
    const {
        projectId,
        projectPath,
        query,
        fullAuto = true,
        outputFile = "answer.txt",
        timeout = 10 * 60 * 1000,
        cleanup = false,
        extraArgs = [],
    } = options;

    const targetPath = getProjectPath(projectId, projectPath);
    if (!targetPath) {
        return {
            success: false,
            message: projectId ? `项目 ${projectId} 不存在` : "未指定项目ID或项目路径",
        };
    }

    if (!existsSync(targetPath)) {
        return {
            success: false,
            message: `项目路径不存在: ${targetPath}`,
        };
    }

    const outputFilePath = join(targetPath, outputFile);

    const args: string[] = [];
    args.push("exec");

    if (fullAuto) {
        args.push("--full-auto");
    }

    if (extraArgs.length > 0) {
        args.push(...extraArgs);
    }

    args.push("--output-last-message", outputFile);
    args.push(query);

    const escapedArgs = args.map((arg) => {
        if (arg.includes(" ") || arg.includes('"') || arg.includes("'")) {
            return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
    });
    const command = `codex ${escapedArgs.join(" ")}`;

    try {
        const execOptions: any = {
            cwd: targetPath,
            encoding: "utf-8" as const,
            stdio: ["ignore", "pipe", "pipe"] as const,
            maxBuffer: 50 * 1024 * 1024,
            shell: true,
            timeout,
        };

        const stdout = execSync(command, execOptions) as string;

        let fileContent: string | undefined;
        if (existsSync(outputFilePath)) {
            try {
                fileContent = readFileSync(outputFilePath, "utf-8");
            } catch (readError: any) {
                console.warn(
                    "读取 Codex 输出文件失败:",
                    readError.message || String(readError)
                );
            }
        }

        if (cleanup && existsSync(outputFilePath)) {
            try {
                unlinkSync(outputFilePath);
            } catch (unlinkError: any) {
                console.warn(
                    "删除 Codex 输出文件失败:",
                    unlinkError.message || String(unlinkError)
                );
            }
        }

        return {
            success: true,
            message: "执行成功",
            output: fileContent,
            stdout: stdout.trim() || undefined,
            outputFilePath,
        };
    } catch (error: any) {
        const stderr = error.stderr?.toString() || error.stderr || "";
        const errorMessage = error.message || stderr || String(error);

        return {
            success: false,
            message:
                errorMessage.includes("ENOENT") || errorMessage.includes("找不到")
                    ? "找不到 codex 命令，请确保已安装 Codex CLI 并在 PATH 中"
                    : `执行失败: ${errorMessage}`,
            output: undefined,
            stderr: stderr || errorMessage,
            outputFilePath,
        };
    }
}

/**
 * 同步版本
 */
export function analyzeProjectSync(options: CodexExecOptions): CodexExecResult {
    const {
        projectId,
        projectPath,
        query,
        timeout = 10 * 60 * 1000,
        cleanup = false,
        extraArgs = [],
        model,
        profile,
        sandbox,
        oss,
        fullAuto,
        json,
        outputLastMessage,
        outputSchema,
        color,
        skipGitRepoCheck,
        dangerouslyBypassApprovalsAndSandbox,
    } = options;

    const targetPath = getProjectPath(projectId, projectPath);
    if (!targetPath) {
        return {
            success: false,
            message: projectId ? `项目 ${projectId} 不存在` : "未指定项目ID或项目路径",
        };
    }

    if (!existsSync(targetPath)) {
        return {
            success: false,
            message: `项目路径不存在: ${targetPath}`,
        };
    }

    const args: string[] = [];
    args.push("exec");

    if (color) {
        args.push("--color", color);
    }

    if (model) {
        args.push("--model", model);
    }

    if (profile) {
        args.push("--profile", profile);
    }

    if (sandbox) {
        args.push("--sandbox", sandbox);
    }

    if (oss) {
        args.push("--oss");
    }

    if (fullAuto) {
        args.push("--full-auto");
    }

    if (json) {
        args.push("--json");
    }

    if (cleanup) {
        args.push("--ephemeral");
    }

    if (outputLastMessage) {
        args.push("--output-last-message", outputLastMessage);
    }

    if (outputSchema) {
        args.push("--output-schema", outputSchema);
    }

    if (skipGitRepoCheck) {
        args.push("--skip-git-repo-check");
    }

    if (dangerouslyBypassApprovalsAndSandbox) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    if (extraArgs.length > 0) {
        args.push(...extraArgs);
    }

    args.push(query);

    const escapedArgs = args.map((arg) => {
        if (arg.includes(" ") || arg.includes('"') || arg.includes("'")) {
            return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
    });
    const command = `codex ${escapedArgs.join(" ")}`;

    try {
        const execOptions: any = {
            cwd: targetPath,
            encoding: "utf-8" as const,
            stdio: ["ignore", "pipe", "pipe"] as const,
            maxBuffer: 50 * 1024 * 1024,
            shell: true,
            timeout,
        };

        const stdout = execSync(command, execOptions) as string;

        return {
            success: true,
            message: "执行成功",
            output: stdout,
            stdout: stdout.trim() || undefined,
        };
    } catch (error: any) {
        const stderr = error.stderr?.toString() || error.stderr || "";
        const errorMessage = error.message || stderr || String(error);

        return {
            success: false,
            message:
                errorMessage.includes("ENOENT") || errorMessage.includes("找不到")
                    ? "找不到 codex 命令，请确保已安装 Codex CLI 并在 PATH 中"
                    : `执行失败: ${errorMessage}`,
            output: undefined,
            stderr: stderr || errorMessage,
        };
    }
}

/**
 * 生成贴吧老哥风格总结
 */
async function generateTiebaSummary(content: string): Promise<string | undefined> {
    if (!content || content.trim().length === 0) {
        return undefined;
    }

    try {
        const contentToSummarize =
            content.length > 8000 ? content.substring(0, 8000) + "..." : content;
        const summaryResult = await transToTiebaOldBrother(contentToSummarize);
        return summaryResult || undefined;
    } catch (summaryError: any) {
        console.warn(
            "生成贴吧老哥总结失败:",
            summaryError.message || String(summaryError)
        );
        return undefined;
    }
}

/**
 * checkCommit 函数的选项
 */
export interface CheckCommitOptions extends Omit<CodexExecOptions, "query" | "projectId"> {}

/**
 * 使用 Codex CLI 检查指定项目的 Git 提交
 */
export async function checkCommit(
    projectId: string,
    commitHash: string,
    options: CheckCommitOptions = {}
): Promise<CodexExecResult> {
    const query = CHECK_COMMIT(commitHash);

    const result = await analyzeProject({
        projectId,
        query,
        timeout: options.timeout ?? 10 * 60 * 1000,
        ...options,
    });

    if (result.success && result.output && result.output.trim().length > 0) {
        const tiebaSummary = await generateTiebaSummary(result.output);
        return {
            ...result,
            tiebaSummary,
        };
    }

    return result;
}

