/**
 * 对话历史管理
 * 在内存中保存最近10条对话，用于普通对话时的上下文
 */

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

// 内存中存储对话历史：chatId -> 消息数组
const conversationHistory: Map<string, ConversationMessage[]> = new Map();

// 默认保留的对话条数
const MAX_HISTORY_LENGTH = 10;

/**
 * 获取指定聊天的对话历史
 * @param chatId 聊天ID
 * @param limit 返回的最大条数，默认返回全部（最多10条）
 * @returns 对话历史数组
 */
export function getConversationHistory(
    chatId: string,
    limit?: number
): ConversationMessage[] {
    const history = conversationHistory.get(chatId) || [];
    
    if (limit && limit > 0) {
        // 返回最近的 limit 条消息
        return history.slice(-limit);
    }
    
    return history;
}

/**
 * 添加消息到对话历史
 * @param chatId 聊天ID
 * @param role 消息角色
 * @param content 消息内容
 */
export function addMessageToHistory(
    chatId: string,
    role: 'user' | 'assistant',
    content: string
): void {
    if (!chatId || !content) {
        return;
    }

    let history = conversationHistory.get(chatId);
    
    if (!history) {
        history = [];
        conversationHistory.set(chatId, history);
    }

    // 添加新消息
    history.push({
        role,
        content,
        timestamp: Date.now(),
    });

    // 保持最多 MAX_HISTORY_LENGTH 条消息
    if (history.length > MAX_HISTORY_LENGTH) {
        // 移除最旧的消息
        history.shift();
    }
}

/**
 * 将对话历史转换为 OpenAI API 格式的消息数组
 * @param history 对话历史
 * @returns OpenAI 格式的消息数组
 */
export function convertToOpenAIMessages(
    history: ConversationMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
    return history.map(msg => ({
        role: msg.role,
        content: msg.content,
    }));
}

/**
 * 清空指定聊天的对话历史
 * @param chatId 聊天ID
 */
export function clearConversationHistory(chatId: string): void {
    conversationHistory.delete(chatId);
}

/**
 * 清空所有对话历史
 */
export function clearAllConversationHistory(): void {
    conversationHistory.clear();
}

/**
 * 获取所有有历史记录的聊天ID
 * @returns 聊天ID数组
 */
export function getAllChatIds(): string[] {
    return Array.from(conversationHistory.keys());
}

/**
 * 获取指定聊天的历史记录数量
 * @param chatId 聊天ID
 * @returns 历史记录数量
 */
export function getHistoryCount(chatId: string): number {
    const history = conversationHistory.get(chatId);
    return history ? history.length : 0;
}





















