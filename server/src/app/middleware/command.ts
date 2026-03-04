import type { Middleware } from '../core/app.js';
import type { Context } from '../core/context.js';
import { handleCommand } from '../command/index.js';

/**
 * 命令解析与处理
 */
export const commandMw: Middleware<Context> = async (ctx, next) => {
    const message = ctx.message;
    if (!message) return;

    const handled = await handleCommand(message.textContent, ctx);

    if (handled) return;
    await next();
};
