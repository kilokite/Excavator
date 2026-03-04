/**
 * 项目相关 Function Call 函数
 */
import { list, get, search } from '../../utils/project.js';

/**
 * 获取所有项目列表（包含配置信息）
 */
export async function getProjectList(): Promise<string> {
    try {
        const projects = list();
        
        if (projects.length === 0) {
            return '当前没有项目';
        }
        
        const projectList = projects.map(project => {
            const config = project.config;
            const lines = [
                `- **${project.name}** (ID: ${project.id})`,
                `  路径: ${project.path}`,
                `  Git仓库: ${project.isGitRepository ? '是' : '否'}`,
            ];
            
            if (config) {
                if (config.description) {
                    lines.push(`  描述: ${config.description}`);
                }
                if (config.tags && config.tags.length > 0) {
                    lines.push(`  标签: ${config.tags.join(', ')}`);
                }
                if (config.gitRemote) {
                    lines.push(`  远程仓库: ${config.gitRemote}`);
                }
            }
            
            return lines.join('\n');
        }).join('\n\n');
        
        return `共有 ${projects.length} 个项目:\n\n${projectList}`;
    } catch (error) {
        return `获取项目列表时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取指定项目的详细信息（包含配置）
 */
export async function getProjectInfo(projectId: string): Promise<string> {
    try {
        const project = get(projectId);
        
        if (!project) {
            return `项目 ${projectId} 不存在`;
        }
        
        const config = project.config;
        const lines = [
            `项目: **${project.name}**`,
            `ID: ${project.id}`,
            `路径: ${project.path}`,
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
    } catch (error) {
        return `获取项目信息时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 搜索项目
 */
export async function searchProjectsByKeyword(keyword: string): Promise<string> {
    try {
        const projects = search(keyword);
        
        if (projects.length === 0) {
            return `没有找到匹配 "${keyword}" 的项目`;
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
        
        return `找到 ${projects.length} 个匹配的项目:\n\n${projectList}`;
    } catch (error) {
        return `搜索项目时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}






