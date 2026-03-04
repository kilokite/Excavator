import {
    getEnabledAutoCheckProjects,
    getAllAutoCheckProjects,
    addAutoCheckProject,
    updateAutoCheckProject,
    removeAutoCheckProject,
    setGlobalEnabled,
    autoCheckConfigManager,
    type AutoCheckProjectConfig,
} from '../../config/autoCheckConfig.js';
import { restartAutoCheckTasks } from '../../services/autoCheckService.js';
import { getCommandContext } from '../commandContext.js';
import { exists } from '../../utils/project.js';

/**
 * 统一回复工具
 */
async function reply(text: string): Promise<void> {
    const ctx = getCommandContext();
    await ctx.replyText(text);
}

/**
 * 格式化项目配置信息
 */
function formatProjectConfig(config: AutoCheckProjectConfig): string {
    const intervalMinutes = Math.floor(config.fetchInterval / 1000 / 60);
    const intervalSeconds = Math.floor((config.fetchInterval / 1000) % 60);
    const intervalStr = intervalSeconds > 0 
        ? `${intervalMinutes}分${intervalSeconds}秒`
        : `${intervalMinutes}分钟`;
    
    return [
        `- **项目ID**: ${config.projectId}`,
        `  - 目标聊天ID: \`${config.targetChatId}\``,
        `  - 检查间隔: ${intervalStr}`,
        `  - 状态: ${config.enabled ? '✅ 启用' : '❌ 禁用'}`,
    ].join('\n');
}

/**
 * 列出所有自动检查配置
 */
export async function handleAutoCheckList(): Promise<void> {
    console.log('执行 autocheck list 指令');
    try {
        const allProjects = getAllAutoCheckProjects();
        const enabledProjects = getEnabledAutoCheckProjects();
        const config = autoCheckConfigManager.getData();

        if (allProjects.length === 0) {
            await reply('当前没有配置自动检查项目');
            return;
        }

        const lines = [
            `**自动检查配置**`,
            `全局状态: ${config.globalEnabled ? '✅ 启用' : '❌ 禁用'}`,
            `已启用项目: ${enabledProjects.length} / ${allProjects.length}`,
            '',
            '**项目列表:**',
            ...allProjects.map(formatProjectConfig),
        ];

        await reply(lines.join('\n'));
    } catch (error) {
        await reply(`❌ 获取自动检查配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 添加自动检查项目
 */
export async function handleAutoCheckAdd(
    projectId: string,
    targetChatId: string,
    options: {
        interval?: string;
        enabled?: boolean;
    }
): Promise<void> {
    console.log(`执行 autocheck add 指令: projectId=${projectId}, targetChatId=${targetChatId}`);
    try {
        // 验证项目是否存在
        if (!exists(projectId)) {
            await reply(`❌ 项目 ${projectId} 不存在`);
            return;
        }

        // 解析检查间隔
        let fetchInterval = 1 * 60 * 1000; // 默认1分钟
        if (options.interval) {
            const intervalMatch = options.interval.match(/^(\d+)([ms])?$/);
            if (intervalMatch) {
                const value = parseInt(intervalMatch[1], 10);
                const unit = intervalMatch[2] || 'm';
                if (unit === 'm') {
                    fetchInterval = value * 60 * 1000;
                } else if (unit === 's') {
                    fetchInterval = value * 1000;
                }
            } else {
                await reply(`❌ 无效的间隔格式，请使用数字+单位（如 5m 或 30s）`);
                return;
            }
        }

        const projectConfig: AutoCheckProjectConfig = {
            projectId,
            targetChatId,
            fetchInterval,
            enabled: options.enabled !== false, // 默认启用
        };

        addAutoCheckProject(projectConfig);
        restartAutoCheckTasks();
        await reply(`✅ 已添加项目 ${projectId} 的自动检查配置`);
    } catch (error) {
        await reply(`❌ 添加自动检查配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 更新自动检查项目配置
 */
export async function handleAutoCheckUpdate(
    projectId: string,
    options: {
        targetChatId?: string;
        interval?: string;
        enabled?: boolean;
    }
): Promise<void> {
    console.log(`执行 autocheck update 指令: projectId=${projectId}`);
    try {
        const updates: Partial<AutoCheckProjectConfig> = {};

        if (options.targetChatId !== undefined) {
            updates.targetChatId = options.targetChatId;
        }

        if (options.interval !== undefined) {
            const intervalMatch = options.interval.match(/^(\d+)([ms])?$/);
            if (intervalMatch) {
                const value = parseInt(intervalMatch[1], 10);
                const unit = intervalMatch[2] || 'm';
                if (unit === 'm') {
                    updates.fetchInterval = value * 60 * 1000;
                } else if (unit === 's') {
                    updates.fetchInterval = value * 1000;
                }
            } else {
                await reply(`❌ 无效的间隔格式，请使用数字+单位（如 5m 或 30s）`);
                return;
            }
        }

        if (options.enabled !== undefined) {
            updates.enabled = options.enabled;
        }

        if (Object.keys(updates).length === 0) {
            await reply(`❌ 请至少提供一个要更新的配置项`);
            return;
        }

        updateAutoCheckProject(projectId, updates);
        restartAutoCheckTasks();
        await reply(`✅ 已更新项目 ${projectId} 的自动检查配置`);
    } catch (error) {
        await reply(`❌ 更新自动检查配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 删除自动检查项目配置
 */
export async function handleAutoCheckRemove(projectId: string): Promise<void> {
    console.log(`执行 autocheck remove 指令: projectId=${projectId}`);
    try {
        removeAutoCheckProject(projectId);
        restartAutoCheckTasks();
        await reply(`✅ 已删除项目 ${projectId} 的自动检查配置`);
    } catch (error) {
        await reply(`❌ 删除自动检查配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 启用/禁用全局自动检查
 */
export async function handleAutoCheckEnable(enabled: boolean): Promise<void> {
    console.log(`执行 autocheck enable 指令: enabled=${enabled}`);
    try {
        setGlobalEnabled(enabled);
        restartAutoCheckTasks();
        await reply(`✅ 已${enabled ? '启用' : '禁用'}全局自动检查`);
    } catch (error) {
        await reply(`❌ 设置全局开关失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

