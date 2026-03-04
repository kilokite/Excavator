<template>
	<div class="auto-check-page">
		<v-container fluid class="pa-4">
			<!-- 头部操作栏 -->
			<v-row>
				<v-col cols="12">
					<v-sheet class="pane" :elevation="0" rounded="lg" border>
						<div class="pane-title d-flex align-center">
							<v-icon icon="mdi-robot" class="mr-2" />
							<div class="d-flex flex-column">
								<span class="text-subtitle-1 font-weight-medium">自动检查管理</span>
								<span class="text-body-2 text-medium-emphasis">
									配置自动检查项目、通知目标以及执行频率
								</span>
							</div>
							<v-spacer />
							<v-chip
								size="small"
								:color="autoCheck?.globalEnabled ? 'success' : 'grey'"
								variant="tonal"
								class="mr-2"
							>
								{{ autoCheck?.globalEnabled ? "全局启用" : "全局关闭" }}
							</v-chip>
							<v-switch
								:disabled="loading"
								inset
								color="primary"
								class="mr-2"
								hide-details
								:loading="savingGlobal"
								:label="autoCheck?.globalEnabled ? '点击关闭' : '点击开启'"
								:model-value="autoCheck?.globalEnabled ?? false"
								@update:model-value="toggleGlobal"
							/>
							<v-btn
								icon="mdi-refresh"
								variant="text"
								:loading="loading"
								@click="loadAll"
							/>
							<v-btn
								color="primary"
								class="ml-2"
								prepend-icon="mdi-plus"
								@click="openAddDialog"
							>
								添加项目
							</v-btn>
						</div>
					</v-sheet>
				</v-col>
			</v-row>

			<!-- 配置列表 -->
			<v-row>
				<v-col cols="12">
					<v-sheet class="pane" :elevation="0" rounded="lg" border>
						<div class="pane-body">
							<v-progress-linear
								v-if="loading"
								indeterminate
								color="primary"
								class="mb-3"
							/>

							<v-alert
								v-else-if="!autoCheck?.projects?.length"
								type="info"
								variant="tonal"
							>
								尚未配置自动检查项目，点击右上角“添加项目”开始配置。
							</v-alert>

							<v-table v-else density="comfortable">
								<thead>
									<tr>
										<th>项目</th>
										<th>目标聊天</th>
										<th>间隔</th>
										<th class="text-center">启用</th>
										<th class="text-center">操作</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="item in autoCheck?.projects" :key="item.projectId">
										<td>
											<div class="d-flex align-center" style="gap: 8px;">
												<v-icon icon="mdi-git" color="primary" size="small" />
												<div class="d-flex flex-column">
													<span class="font-weight-medium">{{ getProjectName(item.projectId) }}</span>
													<span class="text-caption text-medium-emphasis">{{ item.projectId }}</span>
												</div>
											</div>
										</td>
										<td>
											<div class="text-body-2">
												{{ item.targetChatId }}
											</div>
										</td>
										<td>
											{{ formatInterval(item.fetchInterval) }}
										</td>
										<td class="text-center">
											<v-switch
												density="compact"
												inset
												hide-details
												color="primary"
												:disabled="loading"
												:model-value="item.enabled"
												@update:model-value="(val) => toggleProjectEnabled(item.projectId, val)"
											/>
										</td>
										<td class="text-center">
											<v-btn
												variant="text"
												icon="mdi-pencil"
												size="small"
												@click="openEditDialog(item)"
											/>
											<v-btn
												variant="text"
												icon="mdi-delete"
												size="small"
												color="error"
												@click="confirmDelete(item)"
											/>
										</td>
									</tr>
								</tbody>
							</v-table>
						</div>
					</v-sheet>
				</v-col>
			</v-row>
		</v-container>

		<!-- 新增/编辑对话框 -->
		<v-dialog v-model="showEditDialog" max-width="640">
			<v-card>
				<v-card-title>
					<v-icon :icon="isEditing ? 'mdi-pencil' : 'mdi-plus'" class="mr-2" />
					{{ isEditing ? "编辑自动检查项目" : "添加自动检查项目" }}
				</v-card-title>
				<v-card-text>
					<v-form ref="formRef">
						<v-select
							v-model="form.projectId"
							:items="projectOptions"
							item-title="label"
							item-value="value"
							label="项目 *"
							variant="outlined"
							:disabled="isEditing"
							:rules="[v => !!v || '请选择项目']"
							hide-details="auto"
							class="mb-3"
						/>
						<v-text-field
							v-model="form.targetChatId"
							label="目标聊天 ID *"
							variant="outlined"
							:rules="[v => !!String(v).trim() || '必填']"
							hide-details="auto"
							class="mb-3"
						/>
						<v-text-field
							v-model.number="form.intervalSeconds"
							type="number"
							min="10"
							step="10"
							label="检查间隔（秒）"
							variant="outlined"
							hide-details="auto"
							class="mb-3"
							hint="最小 10 秒，推荐 60 秒以上"
							persistent-hint
						/>
						<v-switch
							v-model="form.enabled"
							inset
							color="primary"
							label="启用该项目"
							hide-details
						/>
					</v-form>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="closeEditDialog">取消</v-btn>
					<v-btn
						color="primary"
						:loading="savingProject"
						@click="saveProject"
					>
						保存
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- 删除确认 -->
		<v-dialog v-model="showDeleteDialog" max-width="420">
			<v-card>
				<v-card-title class="text-h6">确认删除</v-card-title>
				<v-card-text>
					确定要删除项目
					<strong>{{ deleteTarget?.projectId }}</strong>
					的自动检查配置吗？
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="showDeleteDialog = false">取消</v-btn>
					<v-btn color="error" :loading="deleting" @click="handleDelete">删除</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- 反馈提示 -->
		<v-snackbar
			v-model="snackbar.show"
			:color="snackbar.color"
			:timeout="2600"
		>
			{{ snackbar.message }}
		</v-snackbar>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { server } from "../../server";

type AutoCheckProjectConfig = {
	projectId: string;
	targetChatId: string;
	fetchInterval: number;
	enabled: boolean;
};

type AutoCheckList = {
	globalEnabled: boolean;
	projects: AutoCheckProjectConfig[];
	enabledCount: number;
	totalCount: number;
};

type ProjectInfo = {
	id: string;
	name?: string;
	isGitRepository?: boolean;
	config?: { name?: string } | null;
};

const loading = ref(false);
const savingGlobal = ref(false);
const savingProject = ref(false);
const deleting = ref(false);

const autoCheck = ref<AutoCheckList | null>(null);
const projects = ref<ProjectInfo[]>([]);

const showEditDialog = ref(false);
const showDeleteDialog = ref(false);
const deleteTarget = ref<AutoCheckProjectConfig | null>(null);
const editingId = ref<string | null>(null);

const form = reactive({
	projectId: "",
	targetChatId: "",
	intervalSeconds: 60,
	enabled: true,
});

const snackbar = reactive({
	show: false,
	message: "",
	color: "success",
});

const projectOptions = computed(() =>
	projects.value.map((p) => ({
		label: p.config?.name || p.name || p.id,
		value: p.id,
	}))
);

const projectNameMap = computed(() => {
	const map: Record<string, string> = {};
	projects.value.forEach((p) => {
		map[p.id] = p.config?.name || p.name || p.id;
	});
	return map;
});

const isEditing = computed(() => !!editingId.value);

function notify(message: string, color: "success" | "error" | "warning" = "success") {
	snackbar.message = message;
	snackbar.color = color;
	snackbar.show = true;
}

function formatInterval(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.round(s / 60);
	if (m < 60) return `${m} 分钟`;
	const h = Math.round(m / 60);
	return `${h} 小时`;
}

function getProjectName(projectId: string): string {
	return projectNameMap.value[projectId] || projectId;
}

async function loadAutoCheck() {
	autoCheck.value = (await server.autoCheck.getAutoCheckList.query()) as AutoCheckList;
}

async function loadProjects() {
	const all = (await server.projects.getAllProjectsInfo.query()) as any[];
	projects.value = (all || []).filter((p) => p.isGitRepository);
}

async function loadAll() {
	loading.value = true;
	try {
		await Promise.all([loadAutoCheck(), loadProjects()]);
	} catch (error: any) {
		notify(error?.message || "加载失败", "error");
	} finally {
		loading.value = false;
	}
}

async function toggleGlobal(value: boolean) {
	if (!autoCheck.value) return;
	savingGlobal.value = true;
	try {
		await server.autoCheck.setGlobalEnabled.mutate(value);
		await loadAutoCheck();
		notify(value ? "已启用自动检查" : "已关闭自动检查");
	} catch (error: any) {
		await loadAutoCheck();
		notify(error?.message || "切换失败", "error");
	} finally {
		savingGlobal.value = false;
	}
}

async function toggleProjectEnabled(projectId: string, enabled: boolean) {
	try {
		await server.autoCheck.updateAutoCheckProject.mutate({ projectId, enabled });
		await loadAutoCheck();
		notify(enabled ? "已启用该项目" : "已禁用该项目");
	} catch (error: any) {
		await loadAutoCheck();
		notify(error?.message || "更新失败", "error");
	}
}

function resetForm() {
	form.projectId = "";
	form.targetChatId = "";
	form.intervalSeconds = 60;
	form.enabled = true;
}

function openAddDialog() {
	resetForm();
	editingId.value = null;
	showEditDialog.value = true;
}

function openEditDialog(item: AutoCheckProjectConfig) {
	editingId.value = item.projectId;
	form.projectId = item.projectId;
	form.targetChatId = item.targetChatId;
	form.intervalSeconds = Math.max(10, Math.round(item.fetchInterval / 1000));
	form.enabled = item.enabled;
	showEditDialog.value = true;
}

function closeEditDialog() {
	showEditDialog.value = false;
}

async function saveProject() {
	if (!form.projectId || !String(form.targetChatId).trim()) {
		notify("请填写必填项", "error");
		return;
	}
	const intervalSeconds = Math.max(10, Number(form.intervalSeconds) || 0);
	const payload = {
		projectId: form.projectId,
		targetChatId: String(form.targetChatId).trim(),
		fetchInterval: intervalSeconds * 1000,
		enabled: form.enabled,
	};

	savingProject.value = true;
	try {
		if (isEditing.value) {
			await server.autoCheck.updateAutoCheckProject.mutate(payload);
			notify("配置已更新");
		} else {
			await server.autoCheck.addAutoCheckProject.mutate(payload);
			notify("已添加自动检查项目");
		}
		await loadAutoCheck();
		showEditDialog.value = false;
	} catch (error: any) {
		notify(error?.message || "保存失败", "error");
	} finally {
		savingProject.value = false;
	}
}

function confirmDelete(item: AutoCheckProjectConfig) {
	deleteTarget.value = item;
	showDeleteDialog.value = true;
}

async function handleDelete() {
	if (!deleteTarget.value) return;
	deleting.value = true;
	try {
		await server.autoCheck.removeAutoCheckProject.mutate(deleteTarget.value.projectId);
		await loadAutoCheck();
		notify("已删除该项目");
		showDeleteDialog.value = false;
	} catch (error: any) {
		notify(error?.message || "删除失败", "error");
	} finally {
		deleting.value = false;
	}
}

onMounted(async () => {
	await loadAll();
});
</script>

<style scoped>
.pane-title {
	padding: 12px 14px;
	border-bottom: 1px solid var(--ui-border);
}

.pane-body {
	padding: 12px 14px;
}

.auto-check-page {
	background: var(--ui-bg);
}
</style>
