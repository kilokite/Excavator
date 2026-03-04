import { readdirSync, statSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { isGitRepository } from "./gitTools.js";
import { DataManager } from "../../utils/data.js";
import { getProjectsRoot, getProjectPathById } from "./pathUtils.js";

export interface ProjectConfig {
    id: string;
    name?: string;
    description?: string;
    gitRemote?: string;
    tags?: string[];
    commitDetailUrlTemplate?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Project {
    id: string;
    path: string;
    name: string;
    isGitRepository: boolean;
    exists: boolean;
    config: ProjectConfig | null;
}

interface ProjectConfigStore {
    [projectId: string]: ProjectConfig;
}


function getDataFilePath(): string {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const dataDir = join(currentDir, '../../../data');
    mkdirSync(dataDir, { recursive: true });
    return join(dataDir, 'projects.json');
}

const projectsRoot = getProjectsRoot();
const configManager = new DataManager<ProjectConfigStore>(getDataFilePath(), {});

export const configs = configManager.getData();

function validateId(id: string): { valid: boolean; error?: string } {
    if (!id?.trim()) return { valid: false, error: '项目ID不能为空' };
    if (/[<>:"|?*\x00-\x1f]/.test(id)) return { valid: false, error: '项目ID包含非法字符' };
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reserved.includes(id.toUpperCase())) return { valid: false, error: '项目ID不能使用系统保留名称' };
    if (id.length > 255) return { valid: false, error: '项目ID过长（最大255个字符）' };
    return { valid: true };
}

function dirExists(id: string): boolean {
    try {
        return statSync(getProjectPathById(id, projectsRoot)).isDirectory();
    } catch {
        return false;
    }
}

export function exists(id: string): boolean {
    return dirExists(id);
}

export function get(id: string): Project | null {
    const config = configs[id];
    if (!config) return null;
    const path = getProjectPathById(id, projectsRoot);
    const dirExists = (() => {
        try {
            return statSync(path).isDirectory();
        } catch {
            return false;
        }
    })();
    return {
        id,
        path,
        name: config.name || id,
        isGitRepository: dirExists && isGitRepository(path),
        exists: dirExists,
        config,
    };
}

export function list(): Project[] {
    return Object.keys(configs)
        .map(id => get(id))
        .filter((p): p is Project => p !== null);
}

export function search(keyword: string): Project[] {
    if (!keyword?.trim()) return list();
    const lower = keyword.toLowerCase();
    return list().filter(p => {
        const text = [p.id, p.name, p.config?.name, p.config?.description, ...(p.config?.tags || [])]
            .filter(Boolean).join(' ').toLowerCase();
        return text.includes(lower);
    });
}

export interface AddResult {
    success: boolean;
    message: string;
    projectId?: string;
    projectPath?: string;
}

export function add(id: string, options: {
    gitRemote?: string;
    name?: string;
    description?: string;
    tags?: string[];
} = {}): AddResult {
    const validation = validateId(id);
    if (!validation.valid) {
        return { success: false, message: validation.error || '验证失败' };
    }
    if (id in configs) {
        return { success: false, message: `项目 ${id} 已存在` };
    }
    if (dirExists(id)) {
        return { success: false, message: `项目目录 ${id} 已存在` };
    }
    const path = getProjectPathById(id, projectsRoot);
    try {
        if (options.gitRemote) {
            execSync(`git clone "${options.gitRemote}" "${path}"`, {
                stdio: ['ignore', 'pipe', 'pipe'],
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024,
            });
        } else {
            mkdirSync(path, { recursive: true });
        }
        const now = new Date().toISOString();
        configs[id] = {
            id,
            name: options.name,
            description: options.description,
            gitRemote: options.gitRemote,
            tags: options.tags,
            createdAt: now,
            updatedAt: now,
        };
        return { success: true, message: `成功添加项目 ${id}`, projectId: id, projectPath: path };
    } catch (error: any) {
        return { success: false, message: `添加失败: ${error.message || String(error)}` };
    }
}

export function remove(id: string): { success: boolean; message: string } {
    if (!(id in configs)) {
        return { success: false, message: `项目 ${id} 不存在` };
    }
    try {
        const path = getProjectPathById(id, projectsRoot);
        if (dirExists(id)) {
            rmSync(path, { recursive: true, force: true });
        }
        delete configs[id];
        return { success: true, message: `已删除项目 ${id}` };
    } catch (error: any) {
        return { success: false, message: `删除失败: ${error.message || String(error)}` };
    }
}
