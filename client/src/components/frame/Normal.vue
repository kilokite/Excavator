<template>
    <v-app>
        <v-app-bar :elevation="0" class="app-bar">
            <v-btn icon="mdi-menu" @click="drawer = !drawer"></v-btn>
            <img src="../../assets/logo.jpg" alt="logo" class="logo">
            <v-toolbar-title class="title">{{ title }}</v-toolbar-title>
            <slot name="bar" />
        </v-app-bar>
        <v-navigation-drawer
            v-model="drawer"
            :elevation="0"
            class="drawer"
            expand-on-hover
            :permanent="!isMobile"
            :rail="!isMobile"
            :temporary="isMobile">
            <slot name="drawer" />
        </v-navigation-drawer>
        <v-main>
            <div class="main">
                <slot />
                <router-view v-slot="{ Component }">
                    <transition name="slide-fade" mode="out-in">
                        <component :is="Component" />
                    </transition>
                </router-view>
            </div>
        </v-main>
        <!-- <Auth v-if="!mainStore.authenticated" /> -->
    </v-app>

</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue';
// import Auth from '../compose/Auth.vue';
// import { useMainStore } from '../../store/mainStore';
// const mainStore = useMainStore();
// const auth = ref(true);
const drawer = ref(false);
defineProps<{
    title: string;
}>();
const isMobile = ref(false);
let onResize: (() => void) | null = null;
onMounted(() => {
    isMobile.value = window.innerWidth < 1000;
    onResize = () => {
        isMobile.value = window.innerWidth < 1000;
    };
    addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
    if (onResize) {
        removeEventListener('resize', onResize);
        onResize = null;
    }
});
</script>

<style scoped>
.main {
    padding: 12px;
    background: var(--ui-bg);
}

.app-bar {
    border-bottom: 1px solid var(--ui-border);
}

.drawer {
    border-right: 1px solid var(--ui-border);
}

.logo {
    transform: translateX(2px);
    height: 100%px;
    filter: brightness(0.5);
    max-width: 1000px;
    &:hover + .title {
        font-weight: 900;
    }
}

.title {
    transform: translateX(-250px);
    font-size: 34px;
    font-weight: 100;
    color: white;
    /* 文字间距 */
    letter-spacing: 2px;
    /* backdrop-filter: blur(10px); */
    transition: all 0.1s cubic-bezier(0.4, 2.02, 1, 0.15);
    &:hover {
        font-weight: 900;
    }
}
</style>