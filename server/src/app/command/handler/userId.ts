import { getCommandContext } from '../commandContext.js';
import { addMessageToHistory } from '../../utils/conversationHistory.js';

export async function handleUserId(): Promise<void> {
    const ctx = getCommandContext();
    const payload = {
        rawEvent: ctx.rawEvent,
        parsedMessage: ctx.message,
    };
    const text = '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
    console.log('执行 userId 指令: 输出完整消息 payload');
    await ctx.replyText(text);
    const chatId = ctx.rawEvent.message.chat_id;
    if (chatId) addMessageToHistory(chatId, 'assistant', text);
}
