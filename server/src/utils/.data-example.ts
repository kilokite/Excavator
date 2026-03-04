import { DataManager } from './data';

// 示例1：用户配置数据
interface UserConfig {
    theme: 'light' | 'dark';
    language: string;
    notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
    };
    preferences: {
        autoSave: boolean;
        syncInterval: number;
    };
}

const defaultUserConfig: UserConfig = {
    theme: 'light',
    language: 'zh-CN',
    notifications: {
        email: true,
        push: false,
        sms: false
    },
    preferences: {
        autoSave: true,
        syncInterval: 300
    }
};

// 创建用户配置管理器
const userConfigManager = new DataManager<UserConfig>('user-config.json', defaultUserConfig);

// 示例2：应用状态数据
interface AppState {
    currentUser: string | null;
    isLoggedIn: boolean;
    lastLoginTime: string | null;
    sessionData: {
        token: string | null;
        expiresAt: number | null;
    };
}

const defaultAppState: AppState = {
    currentUser: null,
    isLoggedIn: false,
    lastLoginTime: null,
    sessionData: {
        token: null,
        expiresAt: null
    }
};

// 创建应用状态管理器
const appStateManager = new DataManager<AppState>('app-state.json', defaultAppState);

// 示例3：缓存数据
interface CacheData {
    [key: string]: {
        value: any;
        timestamp: number;
        ttl: number;
    };
}

const defaultCacheData: CacheData = {};

// 创建缓存数据管理器
const cacheManager = new DataManager<CacheData>('cache.json', defaultCacheData);

// 使用示例
export function exampleUsage() {
    // 1. 用户配置使用示例
    const userConfig = userConfigManager.getData();
    
    // 修改配置（自动保存）
    userConfig.theme = 'dark';
    userConfig.notifications.push = true;
    
    // 批量更新
    userConfigManager.updateData({
        language: 'en-US',
        preferences: {
            autoSave: false,
            syncInterval: 600
        }
    });

    // 2. 应用状态使用示例
    const appState = appStateManager.getData();
    
    // 登录状态更新
    appState.currentUser = 'john_doe';
    appState.isLoggedIn = true;
    appState.lastLoginTime = new Date().toISOString();
    appState.sessionData.token = 'abc123';
    appState.sessionData.expiresAt = Date.now() + 3600000;

    // 3. 缓存数据使用示例
    const cache = cacheManager.getData();
    
    // 添加缓存项
    cache['user_profile_123'] = {
        value: { name: 'John', email: 'john@example.com' },
        timestamp: Date.now(),
        ttl: 3600000 // 1小时
    };

    // 4. 高级操作示例
    // 重新加载数据
    userConfigManager.reload();
    
    // 重置为默认值
    appStateManager.resetData(defaultAppState);
    
    // 获取原始数据（非代理）
    const rawUserConfig = userConfigManager.getRawData();
    console.log('Raw user config:', rawUserConfig);
}

// 导出管理器实例供其他模块使用
export {
    userConfigManager,
    appStateManager,
    cacheManager
};
