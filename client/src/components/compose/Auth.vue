<template>
    <transition name="slide-fade" mode="out-in">
        <div class="auth-background">
            <div class="auth-container">
                <div class="auth-title">
                    <h1>Auth</h1>
                </div>
                <div class="auth-form">
                    <v-text-field v-model="username" label="username" />
                    <v-text-field v-model="password" label="Password" type="password" />
                    <v-btn @click="login" class="auth-button"> Login</v-btn>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../../store/mainStore';
const username = ref('');
const password = ref('');
import { server } from '../../server';
const login = async () => {
    const res = await server.auth.login.mutate({
        username: username.value,
        password: password.value
    });
    if (res.success) {
        useMainStore().authenticated = true;
    } else {
        alert('Login failed');
    }
}
</script>

<style>
.auth-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.731);
    /* z-index: 1000; */
    display: flex;
    /* flex-direction: column; */
    align-items: center;
    justify-content: center;
}

.auth-container {
    width: 400px;
    height: 300px;
    background-color: white;
    border-radius: 10px;
    padding: 20px;
}

.auth-button {
    width: 100%;
}
</style>