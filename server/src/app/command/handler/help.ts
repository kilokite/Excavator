import { Command } from 'commander';
import { getCommandContext } from '../commandContext.js';
import { addMessageToHistory } from '../../utils/conversationHistory.js';

export async function handleHelp(program: Command): Promise<void> {
    const ctx = getCommandContext();
    const text = program.helpInformation();
    await ctx.replyText(text);
    const chatId = ctx.rawEvent?.message?.chat_id;
    if (chatId) addMessageToHistory(chatId, 'assistant', text);
}
