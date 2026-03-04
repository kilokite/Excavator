import type { Middleware } from '../core/app.js';
import type { Context } from '../core/context.js';
import { getReportByMessageId } from '../utils/reportStore.js';
import { REBUTTAL_HANDLER } from '../utils/prompt.js';

/**
 * 处理对代码审查卡片的回复
 * 向上下文中注入反驳处理的 prompt，由 normalReply 统一进行 AI 回复
 */
export const rebuttalMw: Middleware<Context> = async (ctx, next) => {
    const message = ctx.message;
    if (!message) {
        await next();
        return;
    }

    const { textContent, parentId, rootId } = message;
    const messageIdToCheck = parentId || rootId;

    if (!messageIdToCheck) {
        await next();
        return;
    }

    console.log(`[反驳处理] 检测到回复消息，parentId=${parentId}, rootId=${rootId}`);

    const report = getReportByMessageId(messageIdToCheck);

    if (!report) {
        console.log(`[反驳处理] 未找到消息 ${messageIdToCheck} 对应的代码审查报告，不是回复代码审查卡片`);
        await next();
        return;
    }

    console.log(`[反驳处理] 找到对应的代码审查报告: projectId=${report.projectId}, commitHash=${report.commitHash}`);

    // 向上下文中注入反驳处理的 prompt 和上下文信息
    ctx.state.customSystemPrompt = REBUTTAL_HANDLER();
    ctx.message.textContent = `原始代码审查报告：\n\n${report.content}\n\n用户的反驳：\n\n${textContent}\n\n请根据以上内容，生成一个专业、友好、有建设性的回应。`;;

    // 继续执行后续中间件，由 normalReply 统一处理
    await next();
};

