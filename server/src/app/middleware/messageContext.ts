import type { Middleware } from '../core/app.js';
import type { Context } from '../core/context.js';

/**
 * 将当前消息的完整信息（rawEvent + parsedMessage）写入 ctx.state.messageContext，
 * 供后续中间件（如 AI 回复）注入到大模型上下文中。
 * 需在 parseMessageMw 之后执行，以便 ctx.message 已就绪。
 */
export const messageContextMw: Middleware<Context> = async (ctx, next) => {
    ctx.state.messageContext = {
        rawEvent: ctx.rawEvent,
        parsedMessage: ctx.message,
    };
    await next();
};
