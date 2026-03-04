import { defineStore } from "pinia";
export const useMainStore = defineStore("main", {
    state: () => ({
        authenticated: false,
    }),
});