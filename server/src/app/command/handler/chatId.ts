import { getCommandContext } from '../commandContext.js';
import { addMessageToHistory } from '../../utils/conversationHistory.js';

export async function handleChatId(): Promise<void> {
    const ctx = getCommandContext();
    const chatId = ctx.rawEvent.message.chat_id;
    const text = `当前 Chat ID: \`${chatId}\``;
    console.log(`执行 chatId 指令: chatId=${chatId}`);
    await ctx.replyText(text);
    if (chatId) addMessageToHistory(chatId, 'assistant', text);
}
