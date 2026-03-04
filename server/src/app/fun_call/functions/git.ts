/**
 * Git 相关 Function Call 函数
 */
import { getSelectedProjectLatestCommit } from '../../utils/gitTools.js';
import { runReadOnlyGitCommand, validateProject } from './utils.js';

/**
 * 获取指定项目最近的 git log
 */
export async function getGitLog(projectId: string, limit: number = 10): Promise<string> {
    try {
        const validation = validateProject(projectId);
        if (!validation.valid || !validation.projectPath) {
            return `错误: ${validation.error}`;
        }

        const projectPath = validation.projectPath;
        const result = runReadOnlyGitCommand(projectPath, ['log', '--oneline', '-n', String(limit)]);
        
        if (!result.success) {
            return `获取 git log 失败: ${result.error}`;
        }

        const logOutput = result.output || '';
        if (!logOutput) {
            return `项目 ${projectId} 没有提交记录`;
        }
        
        return `项目 ${projectId} 最近 ${limit} 条提交:\n${logOutput}`;
    } catch (error) {
        return `获取 git log 时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取指定项目的最新提交信息
 */
export async function getLatestCommit(projectId: string): Promise<string> {
    try {
        const commit = getSelectedProjectLatestCommit(projectId);
        
        if (!commit) {
            return `项目 ${projectId} 没有找到提交记录，或项目不存在`;
        }
        
        return `项目 ${projectId} 最新提交:\n` +
               `- 分支: ${commit.branch}\n` +
               `- 哈希: ${commit.hash}\n` +
               `- 作者: ${commit.author}\n` +
               `- 时间: ${commit.committedAt.toISOString()}\n` +
               `- 消息: ${commit.message}`;
    } catch (error) {
        return `获取最新提交时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取指定项目的 git status
 */
export async function getGitStatus(projectId: string): Promise<string> {
    try {
        const validation = validateProject(projectId);
        if (!validation.valid || !validation.projectPath) {
            return `错误: ${validation.error}`;
        }

        const projectPath = validation.projectPath;
        const result = runReadOnlyGitCommand(projectPath, ['status']);
        
        if (!result.success) {
            return `获取 git status 失败: ${result.error}`;
        }

        const statusOutput = result.output || '';
        if (!statusOutput) {
            return `项目 ${projectId} 工作区干净，没有变更`;
        }
        
        return `项目 ${projectId} 工作区状态:\n${statusOutput}`;
    } catch (error) {
        return `获取 git status 时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取指定项目的分支列表
 */
export async function getGitBranches(projectId: string, includeRemote: boolean = false): Promise<string> {
    try {
        const validation = validateProject(projectId);
        if (!validation.valid || !validation.projectPath) {
            return `错误: ${validation.error}`;
        }

        const projectPath = validation.projectPath;
        const args = includeRemote ? ['branch', '-a'] : ['branch'];
        const result = runReadOnlyGitCommand(projectPath, args);
        
        if (!result.success) {
            return `获取分支列表失败: ${result.error}`;
        }

        const branchOutput = result.output || '';
        if (!branchOutput) {
            return `项目 ${projectId} 没有分支`;
        }
        
        const scope = includeRemote ? '所有分支（包括远程）' : '本地分支';
        return `项目 ${projectId} ${scope}:\n${branchOutput}`;
    } catch (error) {
        return `获取分支列表时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}






