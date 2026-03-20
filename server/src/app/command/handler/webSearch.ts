import { getCommandContext } from '../commandContext.js';
import { addMessageToHistory } from '../../utils/conversationHistory.js';
import { webSearch, formatSearchResults, type SearchEngine } from '../tools/webSearch.js';

export interface WebSearchOptions {
    engine?: SearchEngine;
    count?: number;
}

export async function handleWebSearch(query: string, options?: WebSearchOptions): Promise<void> {
    const ctx = getCommandContext();
    try {
        const response = await webSearch({
            search_query: query,
            search_engine: options?.engine ?? 'search_std',
            search_intent: false,
            count: Math.min(50, Math.max(1, options?.count ?? 10)),
        });
        const text = formatSearchResults(response);
        await ctx.replyText(text);
        const chatId = ctx.rawEvent?.message?.chat_id;
        if (chatId) addMessageToHistory(chatId, 'assistant', text);
    } catch (err: any) {
        const msg = err?.message || String(err);
        await ctx.replyText(`网络搜索失败：${msg}`);
    }
}
