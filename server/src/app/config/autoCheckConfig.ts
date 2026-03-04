import { DataManager } from '../../utils/data.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 单个项目的自动检查配置
 */
export interface AutoCheckProjectConfig {
    projectId: string;              // 项目ID
    targetChatId: string;           // 目标聊天ID
    fetchInterval: number;          // 检查间隔（毫秒）
    enabled: boolean;               // 是否启用
}

/**
 * 自动检查配置数据结构
 */
export interface AutoCheckConfigData {
    projects: AutoCheckProjectConfig[];  // 项目配置列表
    globalEnabled: boolean;              // 全局开关
}

/**
 * 默认配置
 */
const defaultAutoCheckConfig: AutoCheckConfigData = {
    projects: [
        {
            projectId: 'dou-dou',
            targetChatId: 'oc_d6246cc26d983aa19cbbcf28e1cc899a',
            fetchInterval: 1 * 60 * 1000, // 每分钟检查一次
            enabled: true,
        },
    ],
    globalEnabled: true,
};

/**
 * 获取配置文件路径
 */
function getConfigFilePath(): string {
    // 从 server/src/app/config 向上到 server，然后进入 data 目录
    const dataDir = join(__dirname, '../../../data');
    
    // 确保数据目录存在
    try {
        mkdirSync(dataDir, { recursive: true });
    } catch (err) {
        // 目录可能已存在，忽略错误
    }
    
    return join(dataDir, 'autoCheckConfig.json');
}

const configFilePath = getConfigFilePath();

/**
 * 自动检查配置管理器
 */
export const autoCheckConfigManager = new DataManager<AutoCheckConfigData>(
    configFilePath,
    defaultAutoCheckConfig
);

/**
 * 获取所有启用的项目配置
 */
export function getEnabledAutoCheckProjects(): AutoCheckProjectConfig[] {
    const config = autoCheckConfigManager.getData();
    if (!config.globalEnabled) {
        return [];
    }
    return config.projects.filter(p => p.enabled);
}

/**
 * 获取所有项目配置（包括未启用的）
 */
export function getAllAutoCheckProjects(): AutoCheckProjectConfig[] {
    const config = autoCheckConfigManager.getData();
    return config.projects;
}

/**
 * 添加项目配置
 */
export function addAutoCheckProject(projectConfig: AutoCheckProjectConfig): void {
    const config = autoCheckConfigManager.getData();
    // 检查是否已存在
    const exists = config.projects.some(p => p.projectId === projectConfig.projectId);
    if (exists) {
        throw new Error(`项目 ${projectConfig.projectId} 的配置已存在`);
    }
    config.projects.push(projectConfig);
}

/**
 * 更新项目配置
 */
export function updateAutoCheckProject(
    projectId: string,
    updates: Partial<AutoCheckProjectConfig>
): void {
    const config = autoCheckConfigManager.getData();
    const project = config.projects.find(p => p.projectId === projectId);
    if (!project) {
        throw new Error(`未找到项目 ${projectId} 的配置`);
    }
    Object.assign(project, updates);
}

/**
 * 删除项目配置
 */
export function removeAutoCheckProject(projectId: string): void {
    const config = autoCheckConfigManager.getData();
    const index = config.projects.findIndex(p => p.projectId === projectId);
    if (index === -1) {
        throw new Error(`未找到项目 ${projectId} 的配置`);
    }
    config.projects.splice(index, 1);
}

/**
 * 设置全局开关
 */
export function setGlobalEnabled(enabled: boolean): void {
    const config = autoCheckConfigManager.getData();
    config.globalEnabled = enabled;
}

