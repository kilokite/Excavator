import type { AppRouter } from '@zkit/server';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
let serverURL = "/trpc"
if(import.meta.env.MODE == "development"){
  serverURL = `http://localhost:${13431}/trpc`
}
const server = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({ url: serverURL,
    headers:{
      token:"123456"
    }}),
  ],
})
export {
    server,
}