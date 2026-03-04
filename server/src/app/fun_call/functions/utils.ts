/**
 * Function Call 工具函数
 */
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 只读白名单的 git 子命令
 */
const READONLY_GIT_SUBCOMMANDS = new Set([
    'log',
    'status',
    'branch',
    'rev-parse',
]);

/**
 * 统一的只读 git 命令执行器
 */
export function runReadOnlyGitCommand(projectPath: string, args: string[]): { success: boolean; output?: string; error?: string } {
    const subcommand = args[0];
    if (!READONLY_GIT_SUBCOMMANDS.has(subcommand)) {
        return { success: false, error: `只读模式禁止执行 git ${subcommand}` };
    }

    try {
        const output = execSync(['git', ...args].join(' '), {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024,
        });
        return { success: true, output: output.trim() };
    } catch (error: any) {
        const stderr = error.stderr?.toString() || error.stderr || '';
        const stdout = error.stdout?.toString() || error.stdout || '';
        const errorMessage = stderr || stdout || error.message || String(error);
        return { success: false, error: errorMessage };
    }
}

/**
 * 获取 projects 目录的根路径
 */
export function getProjectsRoot(): string {
    const currentFile = fileURLToPath(import.meta.url);
    let currentDir = resolve(currentFile, '..');
    
    for (let i = 0; i < 10; i++) {
        const serverProjectsPath = join(currentDir, 'server', 'projects');
        try {
            const entries = readdirSync(join(currentDir, 'server'), { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return serverProjectsPath;
            }
        } catch {
            // 忽略
        }
        
        try {
            const projectsPath = join(currentDir, 'projects');
            const entries = readdirSync(currentDir, { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return projectsPath;
            }
        } catch {
            // 忽略
        }
        
        const parentDir = resolve(currentDir, '..');
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    
    return resolve(fileURLToPath(new URL('../../../projects', import.meta.url)));
}

/**
 * 检查项目是否存在且为 Git 仓库
 */
export function validateProject(projectId: string): { valid: boolean; projectPath?: string; error?: string } {
    const projectsRoot = getProjectsRoot();
    const projectPath = join(projectsRoot, projectId);
    
    try {
        const entries = readdirSync(projectsRoot, { withFileTypes: true });
        const projectExists = entries.some(
            entry => entry.isDirectory() && entry.name === projectId
        );
        
        if (!projectExists) {
            return { valid: false, error: `项目 ${projectId} 不存在` };
        }
    } catch (error) {
        return { valid: false, error: `读取项目目录失败: ${error instanceof Error ? error.message : String(error)}` };
    }
    
    const checkRepo = runReadOnlyGitCommand(projectPath, ['rev-parse', '--is-inside-work-tree']);
    if (!checkRepo.success) {
        return { valid: false, error: `项目 ${projectId} 不是 Git 仓库` };
    }
    
    return { valid: true, projectPath };
}






