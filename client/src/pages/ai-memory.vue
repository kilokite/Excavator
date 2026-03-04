<template>
	<v-container class="pa-4">
		<div class="d-flex align-center" style="gap: 10px;">
			<v-icon icon="mdi-brain" size="large" />
			<div class="text-h6 font-weight-bold">AI 记忆</div>
			<v-spacer />
			<v-btn
				icon="mdi-refresh"
				variant="text"
				:loading="loading"
				title="刷新"
				@click="fetchMemory"
			/>
			<v-btn
				color="error"
				variant="tonal"
				:loading="clearing"
				:disabled="!chatIds.length"
				@click="clearAll"
			>
				清空全部记忆
			</v-btn>
		</div>

		<v-alert v-if="error" type="error" class="mt-3" closable>{{ error }}</v-alert>

		<v-card class="mt-4" variant="tonal" color="deep-purple">
			<v-card-title class="d-flex align-center" style="gap: 8px;">
				<v-icon icon="mdi-format-list-bulleted" />
				当前记忆概览
				<v-chip v-if="chatIds.length >= 0" size="small" variant="flat" class="ml-2">
					{{ chatIds.length }} 个会话
				</v-chip>
			</v-card-title>
			<v-card-text>
				<div v-if="chatIds.length === 0" class="text-body-2 text-medium-emphasis">
					暂无对话记忆（每个会话最多保留最近 10 条）
				</div>
				<v-expansion-panels v-else variant="accordion" class="mt-2">
					<v-expansion-panel
						v-for="chatId in chatIds"
						:key="chatId"
						:value="chatId"
					>
						<v-expansion-panel-title>
							<span class="text-body-2 font-mono">{{ chatId }}</span>
							<v-chip size="x-small" variant="tonal" class="ml-2">
								{{ (byChat[chatId] || []).length }} 条
							</v-chip>
							<v-spacer />
							<v-btn
								size="small"
								variant="text"
								color="error"
								@click.stop="clearChat(chatId)"
							>
								清空此会话
							</v-btn>
						</v-expansion-panel-title>
						<v-expansion-panel-text>
							<v-list density="compact" class="bg-transparent">
								<v-list-item
									v-for="(msg, idx) in (byChat[chatId] || [])"
									:key="idx"
									:class="msg.role === 'user' ? 'user-msg' : 'assistant-msg'"
								>
									<template #prepend>
										<v-icon
											:icon="msg.role === 'user' ? 'mdi-account' : 'mdi-robot'"
											size="small"
											:color="msg.role === 'user' ? 'primary' : 'teal'"
										/>
									</template>
									<v-list-item-title class="text-body-2">
										{{ msg.role === 'user' ? '用户' : 'AI' }}
										<span class="text-caption text-medium-emphasis ml-2">
											{{ formatTs(msg.timestamp) }}
										</span>
									</v-list-item-title>
									<v-list-item-subtitle class="text-body-2 mt-1 wrap-text">
										{{ msg.content }}
									</v-list-item-subtitle>
								</v-list-item>
							</v-list>
						</v-expansion-panel-text>
					</v-expansion-panel>
				</v-expansion-panels>
			</v-card-text>
		</v-card>

		<div class="text-caption text-medium-emphasis mt-3">
			页面每 {{ pollInterval / 1000 }} 秒自动刷新，也可点击刷新按钮立即更新。
		</div>
	</v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { server } from '../server';

type MessageEntry = { role: string; content: string; timestamp: number };
type Snapshot = { chatIds: string[]; byChat: Record<string, MessageEntry[]> };

const loading = ref(false);
const clearing = ref(false);
const error = ref('');

const chatIds = ref<string[]>([]);
const byChat = ref<Record<string, MessageEntry[]>>({});

const pollInterval = 3000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function formatTs(ts: number): string {
	try {
		return new Date(ts).toLocaleString('zh-CN', {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	} catch {
		return String(ts);
	}
}

async function fetchMemory() {
	loading.value = true;
	error.value = '';
	try {
		const data = (await server.memory.getSnapshot.query()) as Snapshot;
		chatIds.value = data.chatIds || [];
		byChat.value = data.byChat || {};
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		error.value = msg.includes('UNAUTHORIZED') ? '请先登录' : msg;
		chatIds.value = [];
		byChat.value = {};
	} finally {
		loading.value = false;
	}
}

async function clearAll() {
	if (!confirm('确定要清空所有 AI 记忆吗？此操作不可恢复。')) return;
	clearing.value = true;
	error.value = '';
	try {
		await server.memory.clearAll.mutate();
		await fetchMemory();
	} catch (e: unknown) {
		error.value = e instanceof Error ? e.message : String(e);
	} finally {
		clearing.value = false;
	}
}

async function clearChat(chatId: string) {
	if (!confirm(`确定清空会话 ${chatId} 的记忆吗？`)) return;
	error.value = '';
	try {
		await server.memory.clearChat.mutate({ chatId });
		await fetchMemory();
	} catch (e: unknown) {
		error.value = e instanceof Error ? e.message : String(e);
	}
}

onMounted(() => {
	fetchMemory();
	pollTimer = setInterval(fetchMemory, pollInterval);
});

onBeforeUnmount(() => {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
});
</script>

<style scoped>
.wrap-text {
	white-space: pre-wrap;
	word-break: break-word;
}
.user-msg {
	border-left: 3px solid rgb(var(--v-theme-primary));
}
.assistant-msg {
	border-left: 3px solid rgb(var(--v-theme-teal));
}
</style>
