import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import { auth } from '../solt.js';
async function createContext(opts: CreateHTTPContextOptions) {
    const authContext = await auth(opts);
    return {
        "authenticated": authContext
    }
}

export type Context = Awaited<ReturnType<typeof createContext>>;
export { createContext };