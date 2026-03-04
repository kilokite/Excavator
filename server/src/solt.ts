import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

async function auth(opts: CreateHTTPContextOptions) {
    const { req } = opts;
    const token = req.headers.token == "123456";
    if (!token) {
        return false;
    }
    return true;
}

export { auth };