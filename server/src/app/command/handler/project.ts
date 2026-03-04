import { list, get, search, exists, add, remove, configs } from '../../utils/project.js';
import { getCommandContext } from '../commandContext.js';

/**
 * 统一回复工具
 */
async function reply(text: string): Promise<void> {
    const ctx = getCommandContext();
    await ctx.replyText(text);
}

/**
 * 格式化项目信息
 */
function formatProjectInfo(project: ReturnType<typeof get>): string {
    if (!project) {
        return '项目不存在';
    }

    const config = project.config;
    const lines = [
        `**${project.name}** (ID: ${project.id})`,
        `路径: \`${project.path}\``,
        `Git仓库: ${project.isGitRepository ? '是' : '否'}`,
    ];

    if (config) {
        if (config.description) {
            lines.push(`描述: ${config.description}`);
        }
        if (config.tags && config.tags.length > 0) {
            lines.push(`标签: ${config.tags.join(', ')}`);
        }
        if (config.gitRemote) {
            lines.push(`远程仓库: ${config.gitRemote}`);
        }
        if (config.createdAt) {
            lines.push(`创建时间: ${config.createdAt}`);
        }
        if (config.updatedAt) {
            lines.push(`更新时间: ${config.updatedAt}`);
        }
    } else {
        lines.push('配置: 无');
    }

    return lines.join('\n');
}

/**
 * 列出所有项目
 */
export async function handleProjectList(): Promise<void> {
    console.log('执行 project list 指令');
    try {
        const projects = list();

        if (projects.length === 0) {
            await reply('当前没有项目');
            return;
        }

        const projectList = projects.map(project => {
            const config = project.config;
            const lines = [
                `- **${project.name}** (ID: ${project.id})`,
            ];

            if (config?.description) {
                lines.push(`  描述: ${config.description}`);
            }
            if (config?.tags && config.tags.length > 0) {
                lines.push(`  标签: ${config.tags.join(', ')}`);
            }

            return lines.join('\n');
        }).join('\n\n');

        await reply(`共有 ${projects.length} 个项目:\n\n${projectList}`);
    } catch (error) {
        await reply(`❌ 获取项目列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 获取项目信息
 */
export async function handleProjectInfo(projectId: string): Promise<void> {
    console.log(`执行 project info 指令: projectId=${projectId}`);
    try {
        const project = get(projectId);

        if (!project) {
            await reply(`❌ 项目 ${projectId} 不存在`);
            return;
        }

        await reply(formatProjectInfo(project));
    } catch (error) {
        await reply(`❌ 获取项目信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 搜索项目
 */
export async function handleProjectSearch(keyword: string): Promise<void> {
    console.log(`执行 project search 指令: keyword=${keyword}`);
    try {
        const projects = search(keyword);

        if (projects.length === 0) {
            await reply(`没有找到匹配 "${keyword}" 的项目`);
            return;
        }

        const projectList = projects.map(project => {
            const config = project.config;
            const lines = [
                `- **${project.name}** (ID: ${project.id})`,
            ];

            if (config?.description) {
                lines.push(`  描述: ${config.description}`);
            }
            if (config?.tags && config.tags.length > 0) {
                lines.push(`  标签: ${config.tags.join(', ')}`);
            }

            return lines.join('\n');
        }).join('\n\n');

        await reply(`找到 ${projects.length} 个匹配的项目:\n\n${projectList}`);
    } catch (error) {
        await reply(`❌ 搜索项目失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 更新项目配置
 */
export async function handleProjectUpdate(
    projectId: string,
    options: {
        name?: string;
        description?: string;
        gitRemote?: string;
        tags?: string;
    }
): Promise<void> {
    console.log(`执行 project update 指令: projectId=${projectId}, options=${JSON.stringify(options)}`);
    try {
        if (!exists(projectId)) {
            await reply(`❌ 项目 ${projectId} 不存在`);
            return;
        }

        const config = configs[projectId] || { id: projectId };
        const now = new Date().toISOString();
        if (options.name !== undefined) config.name = options.name;
        if (options.description !== undefined) config.description = options.description;
        if (options.gitRemote !== undefined) config.gitRemote = options.gitRemote;
        if (options.tags !== undefined) {
            config.tags = options.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }
        if (!config.createdAt) config.createdAt = now;
        config.updatedAt = now;
        configs[projectId] = config;
        await reply(`✅ 已更新项目 ${projectId} 的配置`);
    } catch (error) {
        await reply(`❌ 更新配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 删除项目（目录和配置）
 */
export async function handleProjectDelete(projectId: string): Promise<void> {
    console.log(`执行 project delete 指令: projectId=${projectId}`);
    try {
        const result = remove(projectId);
        if (result.success) {
            await reply(`✅ ${result.message}`);
        } else {
            await reply(`❌ ${result.message}`);
        }
    } catch (error) {
        await reply(`❌ 删除项目失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 添加项目
 */
export async function handleProjectAdd(
    projectId: string,
    options: {
        gitRemote?: string;
        name?: string;
        description?: string;
        tags?: string;
    } = {}
): Promise<void> {
    console.log(`执行 project add 指令: projectId=${projectId}, options=${JSON.stringify(options)}`);
    try {
        const addOptions: {
            gitRemote?: string;
            name?: string;
            description?: string;
            tags?: string[];
        } = {};

        if (options.gitRemote) {
            addOptions.gitRemote = options.gitRemote;
        }
        if (options.name) {
            addOptions.name = options.name;
        }
        if (options.description) {
            addOptions.description = options.description;
        }
        if (options.tags) {
            addOptions.tags = options.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }

        const result = add(projectId, addOptions);

        if (result.success) {
            const lines = [
                `✅ 成功添加项目: **${projectId}**`,
                `路径: \`${result.projectPath}\``,
            ];

            if (addOptions.name) {
                lines.push(`名称: ${addOptions.name}`);
            }
            if (addOptions.description) {
                lines.push(`描述: ${addOptions.description}`);
            }
            if (addOptions.gitRemote) {
                lines.push(`Git仓库: ${addOptions.gitRemote}`);
            }
            if (addOptions.tags && addOptions.tags.length > 0) {
                lines.push(`标签: ${addOptions.tags.join(', ')}`);
            }

            await reply(lines.join('\n'));
        } else {
            await reply(`❌ ${result.message}`);
        }
    } catch (error) {
        await reply(`❌ 添加项目失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
