import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { readdirSync } from "node:fs";
import { getProjectsRoot } from "./pathUtils.js";

const FIELD_SEPARATOR = "\x1f";
// Use actual \x1f character instead of %x1f in format string to avoid Git treating it as literal
const SEP_CHAR = String.fromCharCode(0x1f);
const GIT_FORMAT = `%(refname:short)${SEP_CHAR}%(objectname)${SEP_CHAR}%(committerdate:iso8601-strict)${SEP_CHAR}%(committername)${SEP_CHAR}%(subject)`;
const HEAD_REF_REGEX = /(^HEAD$|\/HEAD$)/;

export interface CommitInfo {
    branch: string;
    hash: string;
    author: string;
    message: string;
    committedAt: Date;
}

export interface GetLatestCommitOptions {
    repoPath?: string;
    includeRemotes?: boolean;
    maxRefsToInspect?: number;
}

/**
 * 检查指定路径是否为 Git 仓库
 */
export function isGitRepository(cwd: string): boolean {
    try {
        execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取所有分支（默认包含远程分支）中最新的一条提交
 */
export function getLatestCommitAcrossBranches(options: GetLatestCommitOptions = {}): CommitInfo | null {
    const { 
        repoPath = process.cwd(), 
        includeRemotes = true, 
        maxRefsToInspect = 50 
    } = options;
    
    const cwd = resolve(repoPath);
    
    if (!isGitRepository(cwd)) {
        return null;
    }
    
    const refs = includeRemotes ? "refs/heads refs/remotes" : "refs/heads";
    const command = `git for-each-ref --sort=-committerdate --count=${maxRefsToInspect} --format="${GIT_FORMAT}" ${refs}`;
    
    let output: string;
    try {
        output = execSync(command, { cwd, encoding: "utf-8" }).trim();
    } catch (error) {
        console.error("获取最新提交失败:", error);
        return null;
    }
    
    if (!output) {
        return null;
    }
    
    const lines = output.split(/\r?\n/);
    for (const line of lines) {
        const [branch, hash, date, author, message] = line.split(FIELD_SEPARATOR);
        
        if (!branch || !hash || !date || HEAD_REF_REGEX.test(branch)) {
            continue;
        }
        
        const committedAt = new Date(date);
        if (Number.isNaN(committedAt.getTime())) {
            continue;
        }
        
        return {
            branch,
            hash,
            author,
            message,
            committedAt,
        };
    }
    
    return null;
}


/**
 * 获取指定项目的最新提交
 * @param projectId 项目ID（projects 目录下的子目录名）
 * @returns 最新提交信息，如果项目不存在或不是 Git 仓库则返回 null
 */
export function getSelectedProjectLatestCommit(projectId: string): CommitInfo | null {
    const projectsRoot = getProjectsRoot();
    const projectPath = join(projectsRoot, projectId);
    
    // 检查项目目录是否存在
    try {
        const entries = readdirSync(projectsRoot, { withFileTypes: true });
        const projectExists = entries.some(
            entry => entry.isDirectory() && entry.name === projectId
        );
        
        if (!projectExists) {
            console.error(`项目 ${projectId} 不存在`);
            return null;
        }
    } catch (error) {
        console.error('读取项目目录失败:', error);
        return null;
    }
    
    // 获取该项目的最新提交
    return getLatestCommitAcrossBranches({ repoPath: projectPath });
}

export interface GitFetchResult {
    success: boolean;
    message: string;
    output?: string;
}

/**
 * 对指定项目执行 git fetch
 * @param projectId 项目ID（projects 目录下的子目录名）
 * @param options 可选参数
 * @returns fetch 操作结果
 */
export function fetchProject(projectId: string, options: { prune?: boolean; all?: boolean } = {}): GitFetchResult {
    const projectsRoot = getProjectsRoot();
    const projectPath = join(projectsRoot, projectId);
    
    // 检查项目目录是否存在
    try {
        const entries = readdirSync(projectsRoot, { withFileTypes: true });
        const projectExists = entries.some(
            entry => entry.isDirectory() && entry.name === projectId
        );
        
        if (!projectExists) {
            return {
                success: false,
                message: `项目 ${projectId} 不存在`,
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `读取项目目录失败: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    
    // 检查是否为 Git 仓库
    if (!isGitRepository(projectPath)) {
        return {
            success: false,
            message: `项目 ${projectId} 不是 Git 仓库`,
        };
    }
    
    // 构建 git fetch 命令
    const { prune = true, all = true } = options;
    let command = 'git fetch';
    
    if (all) {
        command += ' --all';
    }
    
    if (prune) {
        command += ' --prune';
    }
    
    // 执行 git fetch
    try {
        const output = execSync(command, { 
            cwd: projectPath, 
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        
        return {
            success: true,
            message: `成功执行 git fetch`,
            output: output.trim() || undefined,
        };
    } catch (error: any) {
        // execSync 的错误对象包含 stdout 和 stderr
        const stderr = error.stderr?.toString() || error.stderr || '';
        const stdout = error.stdout?.toString() || error.stdout || '';
        const errorMessage = stderr || error.message || String(error);
        
        return {
            success: false,
            message: `git fetch 执行失败: ${errorMessage}`,
            output: stdout.trim() || undefined,
        };
    }
}
