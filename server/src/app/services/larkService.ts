import * as lark from '@larksuiteoapi/node-sdk';
import { containsMarkdown } from '../utils/textTools.js';
import { createMarkdownCard } from '../messages/cards/factory.js';

/**
 * 发送文本消息
 * 如果文本包含 Markdown 格式，自动使用卡片发送
 */
export async function sendTextMessage(
    client: lark.Client,
    chatId: string,
    text: string
): Promise<boolean> {
    try {
        // 检测是否包含 Markdown，如果包含则使用卡片发送
        if (containsMarkdown(text)) {
            const card = createMarkdownCard(text);
            const messageId = await sendCardMessage(client, chatId, card);
            return messageId !== null;
        }

        // 普通文本消息
        const result = await client.im.v1.message.create({
            params: {
                receive_id_type: 'chat_id',
            },
            data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ text }),
            },
        });

        if (result.code === 0) {
            console.log(`文本消息发送成功: ${result.data?.message_id}`);
            return true;
        } else {
            console.error(`文本消息发送失败:`, result.msg);
            return false;
        }
    } catch (error) {
        console.error('发送文本消息异常:', error);
        return false;
    }
}

/**
 * 发送卡片消息
 * @returns 成功返回消息ID，失败返回 null
 */
export async function sendCardMessage(
    client: lark.Client,
    chatId: string,
    cardContent: Record<string, any>
): Promise<string | null> {
    try {
        const result = await client.im.v1.message.create({
            params: {
                receive_id_type: 'chat_id',
            },
            data: {
                receive_id: chatId,
                msg_type: 'interactive',
                content: JSON.stringify(cardContent),
            },
        });

        if (result.code === 0 && result.data?.message_id) {
            console.log(`卡片消息发送成功: ${result.data.message_id}`);
            return result.data.message_id;
        } else {
            console.error(`卡片消息发送失败:`, result.msg);
            return null;
        }
    } catch (error) {
        console.error('发送卡片消息异常:', error);
        return null;
    }
}

/**
 * 兼容旧接口
 */
export async function sendMessage(
    client: lark.Client,
    chatId: string,
    text: string
): Promise<boolean> {
    return sendTextMessage(client, chatId, text);
}

