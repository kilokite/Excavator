import os from 'os';

export const MESSAGE_LENGTH_LIMITS = {
    MAIN: 4000,
    SUMMARY: 2000,
} as const;

export const CHECK_COMMIT_TIMEOUT = 10 * 60 * 1000; // 10分钟

// 注意：AUTO_CHECK_CONFIG 已废弃，请使用 autoCheckConfigManager
// 保留此导出以保持向后兼容，但建议迁移到新的配置系统
export const AUTO_CHECK_CONFIG = {
    projectId: 'dou-dou', // 项目1
    targetChatId: 'oc_d6246cc26d983aa19cbbcf28e1cc899a', // 目标聊天ID
    fetchInterval: 1 * 60 * 1000, // 每分钟检查一次
    enabled: true, // 是否启用自动检查
} as const;

/**
 * 获取本机首个非内网回环 IPv4 地址
 */
function getLocalIPv4(): string | null {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const ifaceList = interfaces[name] || [];
        for (const iface of ifaceList) {
            if (iface?.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}

// 判断是否是 dev 环境，优先使用可配置的 FRONTEND_PORT
const PORT = Number(process.env.FRONTEND_PORT) || (process.env.NODE_ENV === 'development' ? 23421 : 13431);

/**
 * 计算默认前端地址：
 * 1. 若显式指定 FRONTEND_URL 则直接使用
 * 2. 否则使用本机 IP 拼接端口，找不到时回退 localhost
 */
export function resolveDefaultFrontendUrl(): string {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
    }
    const localIp = getLocalIPv4();
    const host = localIp || 'localhost';
    return `http://${host}:${PORT}`;
}

export const DEFAULT_FRONTEND_URL = resolveDefaultFrontendUrl();

