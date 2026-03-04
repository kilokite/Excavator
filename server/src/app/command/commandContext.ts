import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from '../core/context.js';

// 使用 AsyncLocalStorage 存储当前请求的 context
export const commandContextStorage = new AsyncLocalStorage<Context>();

/**
 * 获取当前命令执行上下文
 * 在 action handler 中调用此函数获取 context
 */
export function getCommandContext(): Context {
    const ctx = commandContextStorage.getStore();
    if (!ctx) {
        throw new Error('命令上下文未初始化，请确保在 runWithContext 中执行');
    }
    return ctx;
}

/**
 * 在指定 context 下执行回调
 */
export function runWithContext<T>(ctx: Context, fn: () => T): T {
    return commandContextStorage.run(ctx, fn);
}




















