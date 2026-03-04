export type Middleware<Ctx> = (ctx: Ctx, next: () => Promise<void>) => Promise<void>;

function compose<Ctx>(middleware: Middleware<Ctx>[]) {
    return function (ctx: Ctx, next?: () => Promise<void>) {
        let index = -1;
        async function dispatch(i: number): Promise<void> {
            if (i <= index) throw new Error('next() called multiple times');
            index = i;
            const fn = middleware[i] || next;
            if (!fn) return;
            return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
        }
        return dispatch(0);
    };
}

export class App<Ctx> {
    private middleware: Middleware<Ctx>[] = [];

    use(fn: Middleware<Ctx>): this {
        this.middleware.push(fn);
        return this;
    }

    async handle(ctx: Ctx): Promise<void> {
        const fn = compose(this.middleware);
        await fn(ctx);
    }
}

