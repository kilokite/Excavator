import * as lark from '@larksuiteoapi/node-sdk';
import { sendCardMessage, sendTextMessage } from '../services/larkService.js';
import { containsMarkdown } from '../utils/textTools.js';
import { createMarkdownCard } from '../messages/cards/factory.js';
import type { ParsedMessage, MessageData } from './types.js';

export interface Context {
    client: lark.Client;
    rawEvent: MessageData;
    message: ParsedMessage;
    state: Record<string, any>;
    config: {
        baseUrl: string;
    };
    // 快捷发送（无需外部传 client）
    replyText: (text: string) => Promise<boolean>;
    replyCard: (card: Record<string, any>) => Promise<string | null>;
    sendToChat: (chatId: string, text: string) => Promise<boolean>;
    sendCardToChat: (chatId: string, card: Record<string, any>) => Promise<string | null>;
    sendToUser: (userId: string, text: string) => Promise<boolean>;
    // 直接回复当前消息的发送者（私聊）
    replyToSender: (text: string) => Promise<boolean>;
}

export function createContext(params: {
    client: lark.Client;
    rawEvent: MessageData;
    baseUrl: string;
}): Context {
    const { client, rawEvent, baseUrl } = params;
    const defaultChatId = rawEvent.message.chat_id;

    // 定义 sendToUser 函数，供 replyToSender 使用
    const sendToUserFn = async (userId: string, text: string) => {
        try {
            // 检测是否包含 Markdown，如果包含则使用卡片发送
            if (containsMarkdown(text)) {
                const card = createMarkdownCard(text);
                const result = await client.im.v1.message.create({
                    params: { receive_id_type: 'user_id' },
                    data: {
                        receive_id: userId,
                        msg_type: 'interactive',
                        content: JSON.stringify(card),
                    },
                });
                if (result.code === 0 && result.data?.message_id) {
                    console.log(`私聊卡片发送成功: ${result.data.message_id}`);
                    return true;
                }
                console.error('私聊卡片发送失败:', result.msg);
                return false;
            }

            // 普通文本消息
            const result = await client.im.v1.message.create({
                params: { receive_id_type: 'user_id' },
                data: {
                    receive_id: userId,
                    msg_type: 'text',
                    content: JSON.stringify({ text }),
                },
            });
            if (result.code === 0) {
                console.log(`私聊文本发送成功: ${result.data?.message_id}`);
                return true;
            }
            console.error('私聊文本发送失败:', result.msg);
            return false;
        } catch (error) {
            console.error('私聊文本发送异常:', error);
            return false;
        }
    };

    return {
        client,
        rawEvent,
        state: {},
        config: { baseUrl },
        message:{} as any, //UGLY 在中间件中注入 message
        replyText: (text: string) => sendTextMessage(client, defaultChatId, text),
        replyCard: (card: Record<string, any>) => sendCardMessage(client, defaultChatId, card),
        sendToChat: (chatId: string, text: string) => sendTextMessage(client, chatId, text),
        sendCardToChat: (chatId: string, card: Record<string, any>) => sendCardMessage(client, chatId, card),
        sendToUser: sendToUserFn,
        replyToSender: async (text: string) => {
            // Lark 事件中 sender_id 可能包含 open_id 或 user_id
            const senderId = rawEvent?.message?.sender?.sender_id;
            const userId = senderId?.user_id || senderId?.open_id;
            if (!userId) {
                console.error('无法获取消息发送者 ID，replyToSender 失败');
                return false;
            }
            // 使用 sendToUser 方法发送私聊消息
            return sendToUserFn(userId, text);
        },
    };
}

