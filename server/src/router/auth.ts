import { router, publicPro, needAuth } from '../trpc/trpc.js';
import { z } from 'zod';
export default router({
    login: publicPro.input(z.object({
        username: z.string(),
        password: z.string(),
    })).mutation(({ input }) => {
        return {
            success: input.username === "admin" && input.password === "123456"
        }
    }),
})