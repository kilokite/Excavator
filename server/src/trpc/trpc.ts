import { initTRPC , TRPCError } from '@trpc/server';
import type { Context } from './context.js';
/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create();
 
/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
const needAuth = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.authenticated) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({ ctx });
})

export const router = t.router;
export const publicPro = t.procedure;
export { needAuth }