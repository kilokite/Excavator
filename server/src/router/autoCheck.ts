import { router, publicPro } from '../trpc/trpc.js';
import { z } from 'zod';
import {
    getEnabledAutoCheckProjects,
    getAllAutoCheckProjects,
    addAutoCheckProject,
    updateAutoCheckProject,
    removeAutoCheckProject,
    setGlobalEnabled,
    autoCheckConfigManager,
    type AutoCheckProjectConfig,
} from '../app/config/autoCheckConfig.js';
import { restartAutoCheckTasks } from '../app/services/autoCheckService.js';
import { exists } from '../app/utils/project.js';

export default router({
    // 获取所有自动检查配置
    getAutoCheckList: publicPro.query(() => {
        const config = autoCheckConfigManager.getData();
        return {
            globalEnabled: config.globalEnabled,
            projects: config.projects,
            enabledCount: getEnabledAutoCheckProjects().length,
            totalCount: config.projects.length,
        };
    }),

    // 获取启用的自动检查项目
    getEnabledAutoCheckProjects: publicPro.query(() => {
        return getEnabledAutoCheckProjects();
    }),

    // 添加自动检查项目配置
    addAutoCheckProject: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            targetChatId: z.string().describe('目标聊天ID'),
            fetchInterval: z.number().optional().describe('检查间隔（毫秒），默认 60000（1分钟）'),
            enabled: z.boolean().optional().default(true).describe('是否启用'),
        }))
        .mutation(({ input }) => {
            // 验证项目是否存在
            if (!exists(input.projectId)) {
                throw new Error(`项目 ${input.projectId} 不存在`);
            }

            const projectConfig: AutoCheckProjectConfig = {
                projectId: input.projectId,
                targetChatId: input.targetChatId,
                fetchInterval: input.fetchInterval || 60 * 1000,
                enabled: input.enabled !== false,
            };

            addAutoCheckProject(projectConfig);
            restartAutoCheckTasks();
            return { success: true, message: `已添加项目 ${input.projectId} 的自动检查配置` };
        }),

    // 更新自动检查项目配置
    updateAutoCheckProject: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            targetChatId: z.string().optional().describe('目标聊天ID'),
            fetchInterval: z.number().optional().describe('检查间隔（毫秒）'),
            enabled: z.boolean().optional().describe('是否启用'),
        }))
        .mutation(({ input }) => {
            const { projectId, ...updates } = input;

            if (Object.keys(updates).length === 0) {
                throw new Error('请至少提供一个要更新的配置项');
            }

            updateAutoCheckProject(projectId, updates);
            restartAutoCheckTasks();
            return { success: true, message: `已更新项目 ${projectId} 的自动检查配置` };
        }),

    // 删除自动检查项目配置
    removeAutoCheckProject: publicPro
        .input(z.string().describe('项目ID'))
        .mutation(({ input: projectId }) => {
            removeAutoCheckProject(projectId);
            restartAutoCheckTasks();
            return { success: true, message: `已删除项目 ${projectId} 的自动检查配置` };
        }),

    // 设置全局开关
    setGlobalEnabled: publicPro
        .input(z.boolean().describe('是否启用全局自动检查'))
        .mutation(({ input: enabled }) => {
            setGlobalEnabled(enabled);
            restartAutoCheckTasks();
            return { success: true, message: `已${enabled ? '启用' : '禁用'}全局自动检查` };
        }),
});



















