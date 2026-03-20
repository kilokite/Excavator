/**
 * 主应用（挖掘机）
 * 飞书自动回复机器人
 */
import * as lark from '@larksuiteoapi/node-sdk';
import { LARK_APP_ID , LARK_APP_SECRET } from '../config.js';
import { DEFAULT_FRONTEND_URL } from './config/constants.js';
import { App } from './core/app.js';
import { createContext } from './core/context.js';
import type { MessageData } from './core/types.js';
import { parseMessageMw } from './middleware/parseMessage.js';
import { messageContextMw } from './middleware/messageContext.js';
import { dedupeMw } from './middleware/dedupe.js';
import { rebuttalMw } from './middleware/rebuttal.js';
import { commandMw } from './middleware/command.js';
import { normalReplyMw } from './middleware/AIReply.js';
import { getAutoCheckTaskCount, initAutoCheckTasks, stopAutoCheckTasks } from './services/autoCheckService.js';

// ==================== 主函数 ====================

function main() {
    console.log("启动飞书自动回复机器人...");

    // 检查配置
    if (!LARK_APP_ID || !LARK_APP_SECRET) {
        console.warn('警告: 未配置 LARK_APP_ID 或 LARK_APP_SECRET，飞书机器人将不会启动');
        console.warn('请设置环境变量 LARK_APP_ID 和 LARK_APP_SECRET');
        return;
    }

    // 初始化飞书客户端
    const client = new lark.Client({
        appId: LARK_APP_ID,
        appSecret: LARK_APP_SECRET,
    });

    // 初始化 WebSocket 客户端
    const wsClient = new lark.WSClient({
        appId: LARK_APP_ID,
        appSecret: LARK_APP_SECRET,
    });

    // 构建 Koa 风格应用
    const app = new App<ReturnType<typeof createContext>>();
    app
        .use(parseMessageMw)
        .use(messageContextMw)
        .use(dedupeMw)
        .use(rebuttalMw)
        .use(commandMw)
        .use(normalReplyMw);

    // 创建事件分发器
    const eventDispatcher = new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data: MessageData) => {
            try {
                const ctx = createContext({
                    client,
                    rawEvent: data,
                    baseUrl: DEFAULT_FRONTEND_URL,
                });
                await app.handle(ctx);
            } catch (error) {
                console.error('处理消息事件失败:', error);
            }
        },
    });

    // 启动 WebSocket 客户端
    wsClient.start({ eventDispatcher })
        .then(() => {
            console.log('飞书机器人已启动，等待接收消息...');
            
            // 启动自动检查任务
            initAutoCheckTasks(client);
            
            // 优雅关闭
            const cleanup = () => {
                console.log('正在关闭飞书机器人...');
                const taskCount = getAutoCheckTaskCount();
                stopAutoCheckTasks();
                if (taskCount > 0) {
                    console.log(`已停止 ${taskCount} 个自动检查任务`);
                }
                // wsClient.stop();
                process.exit(0);
            };
            
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
        })
        .catch((error) => {
            console.error('启动飞书机器人失败:', error);
        });
}

export default main;
export { main };