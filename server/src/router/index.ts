import { router, publicPro, needAuth } from '../trpc/trpc.js';
import { z } from 'zod';
import auth from './auth.js';
import projects from './projects.js';
import reports from './reports.js';
import git from './git.js';
import autoCheck from './autoCheck.js';
import stats from './stats.js';
const appRouter = router({
    hello: publicPro.input(z.string()).query(({ input }) => {
        return `Hello, ${input}!`
    }),
    hello2: needAuth.input(z.string()).query(({ input }) => {
        return `Hello, ${input}!`
    }),
    auth,
    projects,
    reports,
    git,
    autoCheck,
    stats,
})
export default appRouter;
export type AppRouter = typeof appRouter;