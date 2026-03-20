/**
 * 提交检查服务
 * 执行代码审查并处理重试逻辑
 */
import * as lark from '@larksuiteoapi/node-sdk';
import { checkCommit } from '../utils/claudecli.js';
// import { checkCommit } from '../utils/codexcli.js';
import { setReport } from '../utils/reportStore.js';
import { CHECK_COMMIT_TIMEOUT, DEFAULT_FRONTEND_URL } from '../config/constants.js';
import { sendCardMessage, sendTextMessage } from './larkService.js';
import { createCheckCommitCard, createErrorCard } from '../messages/cards/factory.js';
import { extractReportSections } from '../utils/reportSections.js';
import { incCounter, incProjectCounter } from '../utils/stats.js';

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_BASE = 0;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 处理重试逻辑的辅助函数
 */
async function handleRetry(
    projectId: string,
    commitHash: string,
    attempt: number,
    errorMsg: string,
    shouldRetry: boolean
): Promise<boolean> {
    if (shouldRetry && attempt < MAX_RETRY_ATTEMPTS) {
        console.warn(
            `[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
            `${errorMsg} (尝试 ${attempt}/${MAX_RETRY_ATTEMPTS})，将在 ${RETRY_DELAY_BASE * attempt / 1000} 秒后重试...`
        );
        await sleep(RETRY_DELAY_BASE * attempt);
        return true; // 继续重试
    }
    return false; // 不再重试
}

/**
 * 执行代码审查并验证报告格式（带重试机制）
 */
export async function checkCommitWithRetry(
    client: lark.Client,
    projectId: string,
    commitHash: string,
    targetChatId: string
): Promise<boolean> {
    let attempt = 0;
    
    while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;
        
        try {
            if (attempt === 1) {
                incCounter('commitChecks', 1);
                incProjectCounter(projectId, 'commitChecks', 1);
            }
            const result = await checkCommit(projectId, commitHash, {
                timeout: CHECK_COMMIT_TIMEOUT,
            });

            if (result.success && result.output) {
                const { commitInfo, executiveSummary } = extractReportSections(result.output);
                
                // 验证报告格式
                if (commitInfo === '' || executiveSummary === '') {
                    const shouldContinue = await handleRetry(
                        projectId,
                        commitHash,
                        attempt,
                        '分析失败: 报告格式不符合要求',
                        true
                    );
                    if (shouldContinue) {
                        continue;
                    }
                    // 达到最大重试次数
                    console.error(
                        `[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                        `分析失败: 报告格式不符合要求 (已重试 ${MAX_RETRY_ATTEMPTS} 次，放弃重试)`
                    );
                    const errorCard = createErrorCard(
                        projectId,
                        commitHash,
                        `报告格式不符合要求，已重试 ${MAX_RETRY_ATTEMPTS} 次仍失败`
                    );
                    await sendCardMessage(client, targetChatId, errorCard);
                    return false;
                }
                
                // 报告格式正确，保存报告并发送卡片消息
                const reportId = setReport(
                    projectId,
                    commitHash,
                    result.output,
                    result.tiebaSummary
                );
                incCounter('reportsGenerated', 1);
                incProjectCounter(projectId, 'reportsGenerated', 1);
                
                const cardContent = createCheckCommitCard(
                    projectId,
                    commitHash,
                    reportId,
                    commitInfo,
                    executiveSummary,
                    result.tiebaSummary,
                    DEFAULT_FRONTEND_URL
                );
                
                const messageId = await sendCardMessage(client, targetChatId, cardContent);
                
                // 如果发送成功，更新报告以关联 messageId
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
                        `[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                        `分析完成并已发送 (第 ${attempt} 次尝试成功)`
                    );
                } else {
                    console.log(`[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} 分析完成并已发送`);
                }
                return true;
            } else {
                // checkCommit 执行失败
                let errorMsg = result.message || '未知错误';
                if (result.stderr) {
                    errorMsg += `\n\n错误详情: ${result.stderr}`;
                }
                
                const shouldContinue = await handleRetry(
                    projectId,
                    commitHash,
                    attempt,
                    `分析失败: ${errorMsg}`,
                    true
                );
                if (shouldContinue) {
                    continue;
                }
                // 达到最大重试次数
                const errorCard = createErrorCard(projectId, commitHash, errorMsg);
                await sendCardMessage(client, targetChatId, errorCard);
                console.error(
                    `[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                    `分析失败: ${errorMsg} (已重试 ${MAX_RETRY_ATTEMPTS} 次，放弃重试)`
                );
                return false;
            }
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            const shouldContinue = await handleRetry(
                projectId,
                commitHash,
                attempt,
                `执行异常: ${errorMsg}`,
                true
            );
            if (shouldContinue) {
                continue;
            }
            // 达到最大重试次数
            console.error(
                `[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} ` +
                `执行异常: ${errorMsg} (已重试 ${MAX_RETRY_ATTEMPTS} 次，放弃重试)`
            );
            try {
                await sendTextMessage(
                    client,
                    targetChatId,
                    `❌ 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} 自动检查失败: ${errorMsg} (已重试 ${MAX_RETRY_ATTEMPTS} 次)`
                );
            } catch (sendError) {
                console.error(`[自动检查] 项目 ${projectId} 发送错误通知失败:`, sendError);
            }
            return false;
        }
    }
    
    return false;
}



