import { router, needAuth } from '../trpc/trpc.js';
import { z } from 'zod';
import {
	getAllChatIds,
	getConversationHistory,
	clearAllConversationHistory,
	clearConversationHistory,
} from '../app/utils/conversationHistory.js';

export default router({
	/** 获取当前 AI 记忆快照（所有会话的对话历史） */
	getSnapshot: needAuth.query(() => {
		const chatIds = getAllChatIds();
		const byChat: Record<string, Array<{ role: string; content: string; timestamp: number }>> = {};
		for (const id of chatIds) {
			byChat[id] = getConversationHistory(id);
		}
		return { chatIds, byChat };
	}),

	/** 清空所有 AI 记忆 */
	clearAll: needAuth.mutation(() => {
		clearAllConversationHistory();
		return { ok: true };
	}),

	/** 清空指定会话的记忆 */
	clearChat: needAuth.input(z.object({ chatId: z.string() })).mutation(({ input }) => {
		clearConversationHistory(input.chatId);
		return { ok: true };
	}),
});
