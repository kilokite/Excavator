import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchProject } from '../../utils/gitTools.js';
import { getCommandContext } from '../commandContext.js';

/**
 * 获取 projects 目录的根路径
 */
function getProjectsRoot(): string {
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
function validateProject(projectId: string): { valid: boolean; projectPath?: string; error?: string } {
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
    
    try {
        execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, stdio: 'pipe' });
    } catch {
        return { valid: false, error: `项目 ${projectId} 不是 Git 仓库` };
    }
    
    return { valid: true, projectPath };
}

/**
 * 执行 git 命令并返回结果
 */
function executeGitCommand(projectPath: string, command: string): { success: boolean; output: string; error?: string } {
    try {
        const fullCommand = `git ${command}`;
        const output = execSync(fullCommand, {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        return { success: true, output: output.trim() };
    } catch (error: any) {
        const stderr = error.stderr?.toString() || error.stderr || '';
        const stdout = error.stdout?.toString() || error.stdout || '';
        const errorMessage = stderr || error.message || String(error);
        return {
            success: false,
            output: stdout.trim(),
            error: errorMessage,
        };
    }
}

/**
 * 格式化输出，限制长度
 */
function formatOutput(output: string, maxLength: number = 2000): string {
    if (output.length <= maxLength) {
        return output;
    }
    return output.substring(0, maxLength) + '\n\n...(输出已截断)';
}

/**
 * 统一回复工具
 */
async function reply(text: string): Promise<void> {
    const ctx = getCommandContext();
    await ctx.replyText(text);
}

/**
 * 包装项目校验，失败直接回复错误
 */
async function withProjectPath(
    projectId: string,
    handler: (projectPath: string) => Promise<void>
): Promise<void> {
    const validation = validateProject(projectId);
    if (!validation.valid || !validation.projectPath) {
        await reply(`❌ ${validation.error}`);
        return;
    }
    await handler(validation.projectPath);
}

/**
 * 执行 git 命令并统一回复
 */
async function runGitAndReply(options: {
    projectId: string;
    announce: string;
    command: string;
    successTitle: string;
    emptyFallback?: string;
    maxLength?: number;
}) {
    const { projectId, announce, command, successTitle, emptyFallback = '', maxLength = 2000 } = options;

    await reply(announce);

    await withProjectPath(projectId, async (projectPath) => {
        const result = executeGitCommand(projectPath, command);

        if (result.success) {
            const output = result.output || emptyFallback || '无输出';
            await reply(
                `${successTitle}\n\`\`\`\n${formatOutput(output, maxLength)}\n\`\`\``
            );
        } else {
            await reply(
                `❌ 执行失败:\n\`\`\`\n${formatOutput(result.error || '未知错误')}\n\`\`\``
            );
        }
    });
}

/**
 * git status - 查看工作区状态
 */
export async function handleGitStatus(projectId: string): Promise<void> {
    console.log(`执行 git status 指令: projectId=${projectId}`);
    await runGitAndReply({
        projectId,
        announce: `正在查看项目 ${projectId} 的状态...`,
        command: 'status',
        successTitle: `✅ **${projectId}** 状态:`,
        emptyFallback: '工作区干净，没有变更',
    });
}

/**
 * git log - 查看提交历史
 */
export async function handleGitLog(
    projectId: string,
    limit: number = 10
): Promise<void> {
    console.log(`执行 git log 指令: projectId=${projectId}, limit=${limit}`);
    await runGitAndReply({
        projectId,
        announce: `正在获取项目 ${projectId} 的提交历史...`,
        command: `log --oneline -n ${limit}`,
        successTitle: `✅ **${projectId}** 最近 ${limit} 条提交:`,
        emptyFallback: '没有提交记录',
    });
}

/**
 * git branch - 查看分支列表
 */
export async function handleGitBranch(
    projectId: string,
    all: boolean = false
): Promise<void> {
    console.log(`执行 git branch 指令: projectId=${projectId}, all=${all}`);
    const scope = all ? '所有分支（包括远程）' : '本地分支';
    await runGitAndReply({
        projectId,
        announce: `正在获取项目 ${projectId} 的分支列表...`,
        command: all ? 'branch -a' : 'branch',
        successTitle: `✅ **${projectId}** ${scope}:`,
        emptyFallback: '没有分支',
    });
}

/**
 * git fetch - 拉取远程更新
 */
export async function handleGitFetch(
    projectId: string,
    prune: boolean = true
): Promise<void> {
    console.log(`执行 git fetch 指令: projectId=${projectId}, prune=${prune}`);
    await reply(`正在从远程拉取项目 ${projectId} 的更新...`);

    await withProjectPath(projectId, async () => {
        const result = fetchProject(projectId, { prune, all: true });
        if (result.success) {
            const output = result.output ? `\n\`\`\`\n${formatOutput(result.output)}\n\`\`\`` : '';
            await reply(`✅ **${projectId}** 拉取成功${output}`);
        } else {
            await reply(`❌ ${result.message}`);
        }
    });
}

/**
 * git pull - 拉取并合并
 */
export async function handleGitPull(
    projectId: string,
    branch?: string
): Promise<void> {
    console.log(`执行 git pull 指令: projectId=${projectId}, branch=${branch || '当前分支'}`);
    const branchDesc = branch ? ` 的 ${branch} 分支` : '';
    await runGitAndReply({
        projectId,
        announce: `正在拉取并合并项目 ${projectId}${branchDesc}...`,
        command: branch ? `pull origin ${branch}` : 'pull',
        successTitle: `✅ **${projectId}** 拉取合并成功`,
        emptyFallback: '已是最新',
    });
}

/**
 * git diff - 查看差异
 */
export async function handleGitDiff(
    projectId: string,
    target?: string
): Promise<void> {
    console.log(`执行 git diff 指令: projectId=${projectId}, target=${target || '工作区'}`);
    const targetDesc = target ? `与 ${target} 的差异` : '工作区差异';
    await runGitAndReply({
        projectId,
        announce: `正在查看项目 ${projectId} 的差异...`,
        command: target ? `diff ${target}` : 'diff',
        successTitle: `✅ **${projectId}** ${targetDesc}:`,
        emptyFallback: '没有差异',
        maxLength: 1500,
    });
}

/**
 * git show - 查看提交详情
 */
export async function handleGitShow(
    projectId: string,
    commitHash: string
): Promise<void> {
    console.log(`执行 git show 指令: projectId=${projectId}, commitHash=${commitHash}`);
    await runGitAndReply({
        projectId,
        announce: `正在查看项目 ${projectId} 的提交 ${commitHash}...`,
        command: `show --stat ${commitHash}`,
        successTitle: `✅ **${projectId}** 提交 ${commitHash}:`,
        emptyFallback: '没有找到提交信息',
        maxLength: 1500,
    });
}

/**
 * git remote - 查看远程仓库
 */
export async function handleGitRemote(projectId: string): Promise<void> {
    console.log(`执行 git remote 指令: projectId=${projectId}`);
    await runGitAndReply({
        projectId,
        announce: `正在查看项目 ${projectId} 的远程仓库...`,
        command: 'remote -v',
        successTitle: `✅ **${projectId}** 远程仓库:`,
        emptyFallback: '没有配置远程仓库',
    });
}
