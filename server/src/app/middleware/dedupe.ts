import type { Middleware } from '../core/app.js';
import type { Context } from '../core/context.js';

class MessageDeduplicationQueue {
    private readonly maxSize: number;
    private queue: string[];
    private messageSet: Set<string>;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
        this.queue = [];
        this.messageSet = new Set<string>();
    }

    has(messageId: string): boolean {
        return this.messageSet.has(messageId);
    }

    add(messageId: string): void {
        if (this.messageSet.has(messageId)) {
            const index = this.queue.indexOf(messageId);
            if (index !== -1) {
                this.queue.splice(index, 1);
            }
            this.messageSet.delete(messageId);
        }

        if (this.queue.length >= this.maxSize) {
            const oldestMessage = this.queue.shift();
            if (oldestMessage) {
                this.messageSet.delete(oldestMessage);
            }
        }

        this.queue.push(messageId);
        this.messageSet.add(messageId);
    }

    checkAndAdd(messageId: string): boolean {
        if (this.has(messageId)) {
            return false;
        }
        this.add(messageId);
        return true;
    }

    size(): number {
        return this.queue.length;
    }
}

const messageQueue = new MessageDeduplicationQueue(100);

/**
 * 消息去重
 */
export const dedupeMw: Middleware<Context> = async (ctx, next) => {
    const messageId = ctx.message?.messageId;
    if (!messageId) return;

    if (!messageQueue.checkAndAdd(messageId)) {
        console.log(`消息 ${messageId} 已处理过，跳过重复处理`);
        return;
    }

    console.log(`消息队列大小: ${messageQueue.size()}`);
    await next();
};

