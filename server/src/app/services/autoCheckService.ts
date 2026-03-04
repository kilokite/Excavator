/**
 * 自动检查服务
 * 定期检查项目提交并自动分析
 */
import * as lark from '@larksuiteoapi/node-sdk';
import { fetchProject, getSelectedProjectLatestCommit } from '../utils/gitTools.js';
import { getEnabledAutoCheckProjects } from '../config/autoCheckConfig.js';
import { sendCardMessage, sendTextMessage } from './larkService.js';
import { createCommitDetectedCard } from '../messages/cards/factory.js';
import { checkCommitWithRetry } from './commitCheckService.js';
import { incCounter, incProjectCounter } from '../utils/stats.js';

// 已处理的提交哈希集合（用于自动检查任务）
// key: projectId, value: Set<commitHash>
const processedCommits = new Map<string, Set<string>>();
let currentClient: lark.Client | null = null;
let runningTimers: NodeJS.Timeout[] = [];

function clearTimers(): void {
    if (runningTimers.length === 0) return;
    runningTimers.forEach(timer => {
        clearInterval(timer);
        clearTimeout(timer);
    });
    runningTimers = [];
}

/**
 * 初始化自动检查任务（保存客户端并启动调度）
 */
export function initAutoCheckTasks(client: lark.Client): void {
    currentClient = client;
    restartAutoCheckTasks();
}

/**
 * 停止当前所有自动检查任务
 */
export function stopAutoCheckTasks(): void {
    clearTimers();
}

/**
 * 重启自动检查任务（通常在配置变更后调用）
 */
export function restartAutoCheckTasks(): void {
    if (!currentClient) {
        console.warn('[自动检查] 尚未初始化飞书客户端，无法重启自动检查任务');
        return;
    }

    clearTimers();
    runningTimers = startAutoCheckTask(currentClient);
}

/**
 * 获取当前运行的自动检查定时器数量
 */
export function getAutoCheckTaskCount(): number {
    return runningTimers.length;
}

/**
 * 检查单个项目的提交并分析
 */
export async function checkProjectCommits(
    client: lark.Client,
    projectConfig: { projectId: string; targetChatId: string }
): Promise<void> {
    const { projectId, targetChatId } = projectConfig;

    try {
        incCounter('autoCheckRuns', 1);
        incProjectCounter(projectId, 'autoCheckRuns', 1);
        console.log(`[自动检查] 开始检查项目 ${projectId} 的新提交...`);

        // 1. 执行 git fetch
        const fetchResult = fetchProject(projectId, { prune: true, all: true });
        
        if (!fetchResult.success) {
            console.error(`[自动检查] 项目 ${projectId} git fetch 失败: ${fetchResult.message}`);
            return;
        }

        // 2. 获取最新提交
        const latestCommit = getSelectedProjectLatestCommit(projectId);
        
        if (!latestCommit) {
            console.log(`[自动检查] 项目 ${projectId} 没有找到提交`);
            return;
        }

        const commitHash = latestCommit.hash;

        // 3. 获取或创建该项目的已处理提交集合
        if (!processedCommits.has(projectId)) {
            processedCommits.set(projectId, new Set<string>());
        }
        const projectProcessedCommits = processedCommits.get(projectId)!;

        // 4. 检查是否已处理过
        if (projectProcessedCommits.has(commitHash)) {
            console.log(`[自动检查] 项目 ${projectId} 提交 ${commitHash.substring(0, 8)} 已处理过，跳过`);
            return;
        }

        console.log(`[自动检查] 项目 ${projectId} 发现新提交: ${commitHash.substring(0, 8)} - ${latestCommit.message}`);
        console.log(`[自动检查] 分支: ${latestCommit.branch}, 作者: ${latestCommit.author}`);
        incCounter('autoCheckNewCommits', 1);
        incProjectCounter(projectId, 'autoCheckNewCommits', 1);

        // 5. 标记为已处理（先标记，避免重复处理）
        projectProcessedCommits.add(commitHash);

        // 6. 发送"正在分析"通知卡片
        const { buildCommitDetailUrl } = await import('../utils/commitUrlBuilder.js');
        const detailUrl = buildCommitDetailUrl(projectId, commitHash);
        const detectedCard = createCommitDetectedCard(
            commitHash.substring(0, 8),
            latestCommit.branch,
            latestCommit.author,
            latestCommit.message,
            detailUrl
        );
        await sendCardMessage(client, targetChatId, detectedCard);

        // 7. 执行代码审查（带重试机制）
        await checkCommitWithRetry(
            client,
            projectId,
            commitHash,
            targetChatId
        );
    } catch (error: any) {
        console.error(`[自动检查] 项目 ${projectId} 执行失败:`, error);
        
        try {
            await sendTextMessage(
                client,
                targetChatId,
                `❌ 项目 ${projectId} 自动检查提交时发生错误: ${error.message || String(error)}`
            );
        } catch (sendError) {
            console.error(`[自动检查] 项目 ${projectId} 发送错误通知失败:`, sendError);
        }
    }
}

/**
 * 自动检查所有配置的项目提交并分析
 */
export async function autoCheckCommits(client: lark.Client): Promise<void> {
    const enabledProjects = getEnabledAutoCheckProjects();
    
    if (enabledProjects.length === 0) {
        return;
    }

    await Promise.all(
        enabledProjects.map(projectConfig => 
            checkProjectCommits(client, projectConfig).catch(error => {
                console.error(`[自动检查] 项目 ${projectConfig.projectId} 检查失败:`, error);
            })
        )
    );
}

/**
 * 初始化已处理提交列表
 * 在启动时获取当前最新提交并标记为已处理，避免分析历史提交
 */
export function initializeProcessedCommits(projectId: string): void {
    try {
        fetchProject(projectId, { prune: true, all: true });
        
        const latestCommit = getSelectedProjectLatestCommit(projectId);
        
        if (latestCommit) {
            if (!processedCommits.has(projectId)) {
                processedCommits.set(projectId, new Set<string>());
            }
            const projectProcessedCommits = processedCommits.get(projectId)!;
            
            projectProcessedCommits.add(latestCommit.hash);
            console.log(`[自动检查] 项目 ${projectId} 初始化: 已标记当前最新提交 ${latestCommit.hash.substring(0, 8)} 为已处理`);
        }
    } catch (error) {
        console.error(`[自动检查] 项目 ${projectId} 初始化已处理提交列表失败:`, error);
    }
}

/**
 * 启动自动检查提交任务
 */
export function startAutoCheckTask(client: lark.Client): NodeJS.Timeout[] {
    const enabledProjects = getEnabledAutoCheckProjects();
    
    if (enabledProjects.length === 0) {
        console.log('[自动检查] 没有启用的项目配置，自动检查任务未启动');
        return [];
    }

    const intervalIds: NodeJS.Timeout[] = [];

    for (const projectConfig of enabledProjects) {
        const { projectId, fetchInterval } = projectConfig;
        
        console.log(`[自动检查] 启动项目 ${projectId} 的自动检查任务: 间隔=${fetchInterval / 1000}秒`);

        initializeProcessedCommits(projectId);

        const initialTimeout = setTimeout(() => {
            checkProjectCommits(client, projectConfig).catch(error => {
                console.error(`[自动检查] 项目 ${projectId} 首次检查失败:`, error);
            });
        }, 2000);
        intervalIds.push(initialTimeout);

        const intervalId = setInterval(() => {
            checkProjectCommits(client, projectConfig).catch(error => {
                console.error(`[自动检查] 项目 ${projectId} 定时检查失败:`, error);
            });
        }, fetchInterval);

        intervalIds.push(intervalId);
    }

    return intervalIds;
}



