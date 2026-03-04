import { resolve, join } from "node:path";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 获取 projects 目录的根路径
 * 从当前文件位置向上查找 server 目录，然后进入 projects 子目录
 * 如果找不到 server/projects，会尝试查找直接的 projects 目录作为 fallback
 */
export function getProjectsRoot(): string {
    const currentFile = fileURLToPath(import.meta.url);
    let currentDir = resolve(currentFile, '..');
    
    // 向上查找最多 10 层，直到找到包含 server 目录的位置
    for (let i = 0; i < 10; i++) {
        const serverProjectsPath = join(currentDir, 'server', 'projects');
        try {
            // 检查 server/projects 路径是否存在
            const entries = readdirSync(join(currentDir, 'server'), { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return serverProjectsPath;
            }
        } catch {
            // 忽略读取错误，继续向上查找
        }
        
        // 也检查当前目录是否有直接的 projects 子目录（fallback）
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
        // 如果已经到达根目录，停止查找
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    
    // 如果找不到，fallback 到相对路径（适用于开发环境）
    return resolve(fileURLToPath(new URL('../../../projects', import.meta.url)));
}

/**
 * 获取项目路径（简单版本）
 * @param projectId 项目ID
 * @param projectsRoot 项目根目录，如果不提供则自动查找
 * @returns 项目路径
 */
export function getProjectPathById(projectId: string, projectsRoot?: string): string {
    const root = projectsRoot || getProjectsRoot();
    return join(root, projectId);
}

/**
 * 获取项目路径（完整版本，支持可选参数和验证）
 * @param projectId 项目ID（可选）
 * @param projectPath 项目路径（可选，如果提供则直接返回）
 * @param projectsRoot 项目根目录（可选，如果不提供则自动查找）
 * @returns 项目路径，如果项目不存在则返回 null
 */
export function getProjectPath(
    projectId?: string,
    projectPath?: string,
    projectsRoot?: string
): string | null {
    if (projectPath) return resolve(projectPath);
    if (!projectId) return null;
    
    const root = projectsRoot || getProjectsRoot();
    const path = join(root, projectId);
    
    try {
        const entries = readdirSync(root, { withFileTypes: true });
        const projectExists = entries.some(entry => entry.isDirectory() && entry.name === projectId);
        return projectExists ? path : null;
    } catch {
        return null;
    }
}
