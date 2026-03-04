import { CHECK_COMMIT_TIMEOUT } from '../../config/constants.js';
import { checkCommit } from '../../utils/claudecli.js';
import { setReport } from '../../utils/reportStore.js';
import { extractReportSections } from '../../utils/reportSections.js';
import { sendCardMessage } from '../../services/larkService.js';
import { createCheckCommitCard, createErrorCard } from '../../messages/cards/factory.js';
import { getCommandContext } from '../commandContext.js';

// 重试配置
const MAX_RETRY_ATTEMPTS = 3; // 最大重试次数
const RETRY_DELAY_BASE = 0; // 基础延迟时间（毫秒）

/**
 * 等待指定时间
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface CheckCommitParams {
    projectId: string;
    commitHash: string;
}

/**
 * 执行代码审查并验证报告格式（带重试机制）
 */
async function checkCommitWithRetry(
    ctx: ReturnType<typeof getCommandContext>,
    projectId: string,
    commitHash: string
): Promise<boolean> {
    const chatId = ctx.rawEvent.message.chat_id;
    const baseUrl = ctx.config.baseUrl;
    let attempt = 0;
    
    while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;
        
        try {
            // 执行代码审查
            const result = await checkCommit(projectId, commitHash, {
                timeout: CHECK_COMMIT_TIMEOUT,
            });

            if (result.success && result.output) {
                // 提取提交信息和摘要
                const { commitInfo, executiveSummary } = extractReportSections(result.output);
                
                // 验证报告格式
                if (commitInfo === '' || executiveSummary === '') {
                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        console.warn(
                            `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                            `分析失败: 报告格式不符合要求 (尝试 ${attempt}/${MAX_RETRY_ATTEMPTS})，将重试...`
                        );
                        
                        // 指数退避：等待时间递增
                        await sleep(RETRY_DELAY_BASE * attempt);
                        continue; // 重试
                    } else {
                        // 达到最大重试次数
                        console.error(
                            `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                            `分析失败: 报告格式不符合要求 (已重试 ${MAX_RETRY_ATTEMPTS} 次，放弃重试)`
                        );
                        
                        // 发送错误通知
                        const errorCard = createErrorCard(
                            projectId,
                            commitHash,
                            `报告格式不符合要求，已重试 ${MAX_RETRY_ATTEMPTS} 次仍失败`
                        );
                        await sendCardMessage(ctx.client, chatId, errorCard);
                        return false;
                    }
                }
                
                // 报告格式正确，存储报告
                const reportId = setReport(
                    projectId,
                    commitHash,
                    result.output,
                    result.tiebaSummary
                );
                
                // 创建并发送卡片
                const cardContent = createCheckCommitCard(
                    projectId,
                    commitHash,
                    reportId,
                    commitInfo,
                    executiveSummary,
                    result.tiebaSummary,
                    baseUrl
                );
                
                const messageId = await sendCardMessage(ctx.client, chatId, cardContent);
                
                // 更新报告，添加messageId
                if (messageId) {
                    setReport(
                        projectId,
                        commitHash,
                        result.output,
                        result.tiebaSummary,
                        messageId
                    );
                }
                
                if (attempt > 1) {
                    console.log(
                        `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                        `分析完成并已发送 (第 ${attempt} 次尝试成功)`
                    );
                } else {
                    console.log(`[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} 分析完成并已发送`);
                }
                return true;
            } else {
                // checkCommit 执行失败
                let errorMsg = result.message || '未知错误';
                if (result.stderr) {
                    errorMsg += `\n\n错误详情: ${result.stderr}`;
                }
                
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    console.warn(
                        `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                        `分析失败: ${errorMsg} (尝试 ${attempt}/${MAX_RETRY_ATTEMPTS})，将重试...`
                    );
                    
                    // 指数退避：等待时间递增
                    await sleep(RETRY_DELAY_BASE * attempt);
                    continue; // 重试
                } else {
                    // 达到最大重试次数
                    const errorCard = createErrorCard(projectId, commitHash, errorMsg);
                    await sendCardMessage(ctx.client, chatId, errorCard);
                    console.error(
                        `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                        `分析失败: ${errorMsg} (已重试 ${MAX_RETRY_ATTEMPTS} 次，放弃重试)`
                    );
                    return false;
                }
            }
        } catch (error: any) {
            if (attempt < MAX_RETRY_ATTEMPTS) {
                console.warn(
                    `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                    `执行异常: ${error.message || String(error)} (尝试 ${attempt}/${MAX_RETRY_ATTEMPTS})，将重试...`
                );
                
                // 指数退避：等待时间递增
                await sleep(RETRY_DELAY_BASE * attempt);
                continue; // 重试
            } else {
                // 达到最大重试次数
                console.error(
                    `[checkCommit] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                    `执行异常: ${error.message || String(error)} (已重试 ${MAX_RETRY_ATTEMPTS} 次，放弃重试)`
                );
                
                const errorMsg = `检查失败: ${error.message || String(error)} (已重试 ${MAX_RETRY_ATTEMPTS} 次)`;
                const errorCard = createErrorCard(projectId, commitHash, errorMsg);
                await sendCardMessage(ctx.client, chatId, errorCard);
                return false;
            }
        }
    }
    
    return false;
}

export async function handleCheckCommit(params: CheckCommitParams): Promise<void> {
    const ctx = getCommandContext();
    const { projectId, commitHash } = params;
    
    console.log(`执行 checkCommit 指令: projectId=${projectId}, commitHash=${commitHash}`);

    // 发送"正在处理"消息
    await ctx.replyText(`正在检查提交 ${commitHash}...`);
    
    // 执行代码审查（带重试机制）
    await checkCommitWithRetry(ctx, projectId, commitHash);
}
