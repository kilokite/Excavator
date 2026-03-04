import { getCommandContext } from '../commandContext.js';

export async function handleChatId(): Promise<void> {
    const ctx = getCommandContext();
    const chatId = ctx.rawEvent.message.chat_id;
    
    console.log(`执行 chatId 指令: chatId=${chatId}`);
    await ctx.replyText(`当前 Chat ID: \`${chatId}\``);
}
