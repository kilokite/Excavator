/**
 * 检查相关 Function Call 函数
 */
import { checkCommit, analyzeProject } from '../../utils/claudecli.js';
import { CHECK_COMMIT_TIMEOUT } from '../../config/constants.js';
import { validateProject } from './utils.js';

/**
 * 检查指定项目的提交（只读，返回文本结果）
 */
export async function checkCommitReport(projectId: string, commitHash: string): Promise<string> {
    try {
        const result = await checkCommit(projectId, commitHash, {
            timeout: CHECK_COMMIT_TIMEOUT,
        });

        if (!result.success) {
            let msg = result.message || '未知错误';
            if (result.stderr) {
                msg += `\n错误详情: ${result.stderr}`;
            }
            return `检查提交失败: ${msg}`;
        }

        if (!result.output) {
            return '检查完成，但未返回任何内容，告知用户检查失败';
        }

        return result.output;
    } catch (error) {
        return `检查提交时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 对指定项目的代码执行自定义检查（只读模式）
 */
export async function customCodeCheck(
    projectId: string,
    checkPrompt: string,
    timeout?: number | string,
    chatId?: string
): Promise<string> {
    let timeoutMs: number = 10 * 60 * 1000;
    if (typeof timeout === 'number' && timeout > 0) {
        timeoutMs = timeout;
    } else if (typeof timeout === 'string') {
        console.warn('customCodeCheck: timeout 参数类型错误，使用默认值');
    }
    
    console.log('customCodeCheck', { projectId, checkPrompt, timeout: timeoutMs });
    
    try {
        const validation = validateProject(projectId);
        if (!validation.valid || !validation.projectPath) {
            return `错误: ${validation.error}`;
        }

        const result = await analyzeProject({
            projectId,
            query: checkPrompt,
            timeout: timeoutMs,
            outputFormat: 'text',
        });

        if (!result.success) {
            let msg = result.message || '未知错误';
            if (result.stderr) {
                msg += `\n错误详情: ${result.stderr}`;
            }
            return `自定义检查失败: ${msg}`;
        }

        if (!result.output) {
            return '检查完成，但未返回任何内容';
        }
        return result.output;
    } catch (error) {
        return `执行自定义检查时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}



