import type { Router } from "vue-router";
import type { App } from "vue";

let globalRouter: Router | null = null;

// 导航函数，可以直接使用
const uigo = (path: string) => {
    if (!globalRouter) {
        console.error('Router not initialized. Please install the plugin first.');
        return;
    }
    globalRouter.push(path);
}

// Vue 插件
export const easyKitPlugin = {
    install(app: App, router: Router) {
        globalRouter = router;
        // 全局属性，可以在模板中使用
        app.config.globalProperties.$uigo = uigo;
        // 也可以注入到组件中
        app.provide('uigo', uigo);
    }
}

export { uigo }