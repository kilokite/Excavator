import type { Middleware } from '../core/app.js';
import type { Context } from '../core/context.js';
import type { ParsedMessage } from '../core/types.js';
import { incCounter } from '../utils/stats.js';

/**
 * 解析原始事件为标准消息
 */
export const parseMessageMw: Middleware<Context> = async (ctx, next) => {
    const { message } = ctx.rawEvent;
    const senderId = message.sender?.sender_id?.user_id;
    const parentId = message.parent_id;
    const rootId = message.root_id;

    if (message.message_type !== 'text') {
        console.log(`忽略非文本消息: ${message.message_type}`);
        return;
    }

    let textContent = '';
    try {
        const content = JSON.parse(message.content);
        textContent = content.text || '';
    } catch (e) {
        console.error('解析消息内容失败:', e);
        return;
    }

    if (!textContent.trim()) {
        console.log('消息内容为空，跳过回复');
        return;
    }

    const parsed: ParsedMessage = {
        chatId: message.chat_id,
        messageId: message.message_id,
        textContent: textContent.trim(),
        senderId,
        parentId,
        rootId,
    };

    ctx.message = parsed;
    incCounter('messagesProcessed', 1);
    await next();
};

