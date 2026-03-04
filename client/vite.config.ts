import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import vueDevTools from 'vite-plugin-vue-devtools'
// https://vite.dev/config/
export default defineConfig({
  build:{
    outDir: "../dist/public"
  },
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 13421, // 固定端口，避免自动换端口
    strictPort: true, // 端口被占用时直接报错，便于排查
  },
  plugins: [vue(), Pages(), vueDevTools({
    launchEditor: "cursor",
				componentInspector:{
					toggleComboKey: "alt-f", // alt+f 启动组件检查器
				}
  })],
})
