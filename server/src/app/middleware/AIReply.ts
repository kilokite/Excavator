import type { Middleware } from '../core/app.js';
import type { Context } from '../core/context.js';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../../config.js';
import { TIEBA_OLD_BROTHER_DAILY } from '../utils/prompt.js';
import { getFunctionCallTools, functionHandlers } from '../fun_call/index.js';
import {
    getConversationHistory,
    addMessageToHistory,
    convertToOpenAIMessages,
} from '../utils/conversationHistory.js';
import { incCounter } from '../utils/stats.js';

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: OPENAI_API_KEY,
});

/**
 * 处理 Function Call 并返回结果
 */
async function handleFunctionCall(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    ctx: Context
): Promise<string> {
    // 类型守卫：检查是否是 function call
    if (toolCall.type !== 'function') {
        return `错误: 不支持的工具类型 ${toolCall.type}`;
    }
    
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
    incCounter('toolCalls', 1);

    // 为需要 chatId 的函数自动注入 chatId
    if(!functionArgs.chatId){
        functionArgs.chatId = ctx.rawEvent.message.chat_id;
    }
    
    const handler = functionHandlers[functionName];
    if (!handler) {
        return `错误: 未找到函数 ${functionName}`;
    }
    
    try {
        // 对于 custom_code_check，需要特殊处理参数顺序
        // 因为 Object.values() 的顺序可能不稳定，特别是当有可选参数时
        if (functionName === 'custom_code_check') {
            const result = await handler(
                functionArgs.projectId,
                functionArgs.checkPrompt,
                functionArgs.timeout, // 可能是 undefined
                functionArgs.chatId,  // 可能是 undefined
                ctx
            );
            return result;
        }

        // send_message / send_image 需要依赖当前会话上下文（ctx）执行发送，并写入记忆
        const targetChatId = functionArgs.chatId || ctx.rawEvent?.message?.chat_id;
        if (functionName === 'send_message') {
            const result = await handler(
                functionArgs.text,
                functionArgs.chatId, // 可能是 undefined
                ctx
            );
            if (targetChatId && typeof result === 'string' && result.includes('已发送')) {
                addMessageToHistory(targetChatId, 'assistant', functionArgs.text);
            }
            return result;
        }

        if (functionName === 'send_image') {
            const result = await handler(
                functionArgs.fileName,
                functionArgs.chatId, // 可能是 undefined
                ctx
            );
            if (targetChatId && typeof result === 'string' && result.includes('已发送')) {
                addMessageToHistory(targetChatId, 'assistant', `[已发送图片: ${functionArgs.fileName}]`);
            }
            return result;
        }
        
        // 其他函数：只传递 functionArgs 中的参数，不传递 ctx
        // 因为大部分函数不需要 ctx，多余参数可能导致问题
        const result = await handler(...Object.values(functionArgs));
        return result;
    } catch (error) {
        console.error(`执行函数 ${functionName} 时发生错误:`, error);
        return `执行函数 ${functionName} 时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 使用 Function Calling 进行对话
 */
async function chatWithFunctionCalling(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    ctx: Context
): Promise<string | null> {
    const tools = getFunctionCallTools();
    const maxIterations = 20; // 最多迭代 20 次，避免无限循环
    let iteration = 0;
    
    while (iteration < maxIterations) {
        const response = await openai.chat.completions.create({
            model: "deepseek-reasoner",
            messages: messages,
            tools: tools,
        });
        
        const message = response.choices[0].message;
        
        // 如果没有 tool calls，返回最终回复
        if (!message.tool_calls || message.tool_calls.length === 0) {
            return message.content;
        }
        
        // 将模型的回复添加到消息历史
        messages.push(message);
        
        // 处理所有 tool calls
        for (const toolCall of message.tool_calls) {
            console.log('toolCall', toolCall);
            console.log('ctx0', typeof ctx);
            const functionResult = await handleFunctionCall(toolCall, ctx);
            // 将函数执行结果添加到消息历史
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: functionResult,
            });
        }
        
        iteration++;
    }
    
    return '抱歉，处理您的请求时达到了最大迭代次数。';
}

/**
 * 兜底普通消息回复（支持 Function Calling）
 */
export const normalReplyMw: Middleware<Context> = async (ctx) => {
    const message = ctx.message;
    if (!message) return;

    const chatId = message.chatId;

    try {
        // 获取对话历史（最近 10 条）
        const history = getConversationHistory(chatId, 10);
        const historyMessages = convertToOpenAIMessages(history);

        // 检查是否有自定义的 system prompt（例如反驳处理）
        const systemPrompt = ctx.state.customSystemPrompt || TIEBA_OLD_BROTHER_DAILY();
        
        // 构建用户消息内容
        let userContent = message.textContent;
        if (ctx.state.rebuttalContext) {
            // 如果是反驳处理，构建包含原始审查报告的用户消息
            const { reviewContent, userRebuttal } = ctx.state.rebuttalContext;
            userContent = `原始代码审查报告：\n\n${reviewContent}\n\n用户的反驳：\n\n${userRebuttal}\n\n请根据以上内容，生成一个专业、友好、有建设性的回应。`;
        }

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: systemPrompt,
            },
            // 添加历史对话作为上下文
            ...historyMessages,
            // 添加当前用户消息
            {
                role: "user",
                content: userContent,
            },
        ];
        
        // 保存用户消息到历史记录（保存原始消息内容，而不是处理后的内容）
        addMessageToHistory(chatId, 'user', message.textContent);
        
        const aiReply = await chatWithFunctionCalling(messages, ctx);
        if (!aiReply) return;
        const content = aiReply;
        
        // 保存 AI 回复到历史记录
        addMessageToHistory(chatId, 'assistant', content);
        
        await ctx.replyText(content);
        incCounter('aiReplies', 1);
    } catch (error) {
        console.error('AI 生成回复失败:', error);
        await ctx.replyText(`收到您的消息: ${message.textContent}`);
        incCounter('aiReplies', 1);
    }
};

