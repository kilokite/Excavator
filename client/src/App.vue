<script setup lang="ts">
// import { ref } from "vue";
// import { server } from "./server";
import Normal from "./components/frame/Normal.vue";
import routes from "~pages";
// const test = ref("null");
// const input = ref("");
// async function hello() {
// 	const res = await server.hello.query(input.value);
// 	test.value = res;
// }
console.log(routes);
</script>

<template>
  
    <Normal title="Excavator" >
		<template #bar>
			<v-btn icon="mdi-account-card"></v-btn>
		</template>
		<template #drawer>
		<v-list-item link title="首页" prepend-icon="mdi-home" to="/"></v-list-item>
		<v-list-item link title="项目管理" prepend-icon="mdi-folder-multiple" to="/projects"></v-list-item>
		<v-list-item link title="自动检查管理" prepend-icon="mdi-robot" to="/auto-check"></v-list-item>
		<v-list-item link title="报告管理" prepend-icon="mdi-file-document-multiple" to="/reports"></v-list-item>
		<v-list-item link title="AI 记忆" prepend-icon="mdi-brain" to="/ai-memory"></v-list-item>
		<v-list-item link title="关于" prepend-icon="mdi-information" to="/about"></v-list-item>
		</template>
	</Normal>

</template>

<style scoped></style>
