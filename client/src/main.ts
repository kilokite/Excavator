import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";

import { createPinia } from "pinia";
const pinia = createPinia();

// Vuetify

import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import '@mdi/font/css/materialdesignicons.css'
// import { md3 } from 'vuetify/blueprints'

const vuetify = createVuetify({
	// blueprint: md3,
	components,
	directives,
	icons: {
		defaultSet: 'mdi',
	  },
});

import routes from "~pages";
import { createRouter, createWebHistory } from "vue-router";
import { easyKitPlugin } from "./easyKit";

const router = createRouter({
	history: createWebHistory(),
	routes,
});



const app = createApp(App);

// 安装 easyKit 插件
app.use(easyKitPlugin, router);
app.use(pinia);
app.use(vuetify).use(router).mount("#app");
