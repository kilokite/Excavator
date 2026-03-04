<template>
	<div class="git-test-page">
		<v-container>
			<v-row>
				<v-col cols="12">
					<v-card>
						<v-card-title>
							<v-icon icon="mdi-git" class="mr-2"></v-icon>
							Git 项目提交测试
						</v-card-title>
						<v-card-text>
							<v-row>
								<v-col cols="12" md="6">
									<v-select
										v-model="selectedProjectId"
										:items="projectList"
										label="选择项目"
										item-title="name"
										item-value="id"
										:loading="loadingProjects"
										@update:model-value="loadCommit"
									></v-select>
								</v-col>
								<v-col cols="12" md="6" class="d-flex align-center flex-wrap" style="gap: 8px;">
									<v-btn
										color="primary"
										:loading="loadingCommit"
										@click="loadCommit"
										:disabled="!selectedProjectId"
									>
										<v-icon icon="mdi-refresh" class="mr-2"></v-icon>
										刷新提交信息
									</v-btn>
									<v-btn
										color="success"
										:loading="loadingFetch"
										@click="handleFetch"
										:disabled="!selectedProjectId"
									>
										<v-icon icon="mdi-download" class="mr-2"></v-icon>
										Git Fetch
									</v-btn>
									<v-btn
										color="secondary"
										:loading="loadingProjects"
										@click="loadProjectList"
									>
										<v-icon icon="mdi-reload" class="mr-2"></v-icon>
										刷新项目列表
									</v-btn>
								</v-col>
							</v-row>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>

			<v-row v-if="commitInfo">
				<v-col cols="12">
					<v-card>
						<v-card-title>
							<v-icon icon="mdi-source-commit" class="mr-2"></v-icon>
							最新提交信息
						</v-card-title>
						<v-card-text>
							<v-alert
								v-if="commitInfo"
								type="success"
								class="mb-4"
							>
								项目 <strong>{{ selectedProjectId }}</strong> 的最新提交
							</v-alert>
							<v-simple-table>
								<tbody>
									<tr>
										<td class="font-weight-bold" style="width: 150px">分支</td>
										<td>
											<v-chip color="primary" size="small">
												{{ commitInfo.branch }}
											</v-chip>
										</td>
									</tr>
									<tr>
										<td class="font-weight-bold">提交 Hash</td>
										<td>
											<code class="text-primary">{{ commitInfo.hash }}</code>
										</td>
									</tr>
									<tr>
										<td class="font-weight-bold">作者</td>
										<td>{{ commitInfo.author }}</td>
									</tr>
									<tr>
										<td class="font-weight-bold">提交信息</td>
										<td>{{ commitInfo.message }}</td>
									</tr>
									<tr>
										<td class="font-weight-bold">提交时间</td>
										<td>
											{{ formatDate(commitInfo.committedAt) }}
										</td>
									</tr>
								</tbody>
							</v-simple-table>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>

			<v-row v-else-if="!loadingCommit && selectedProjectId">
				<v-col cols="12">
					<v-alert type="warning">
						未找到该项目的 Git 提交信息，可能该项目不是 Git 仓库或没有提交记录。
					</v-alert>
				</v-col>
			</v-row>

			<v-row v-if="fetchResult">
				<v-col cols="12">
					<v-alert 
						:type="fetchResult.success ? 'success' : 'error'" 
						dismissible 
						@click:close="fetchResult = null"
					>
						<strong>{{ fetchResult.success ? '成功' : '失败' }}:</strong> {{ fetchResult.message }}
						<pre v-if="fetchResult.output" class="mt-2 text-caption">{{ fetchResult.output }}</pre>
					</v-alert>
				</v-col>
			</v-row>

			<v-row v-if="error">
				<v-col cols="12">
					<v-alert type="error" dismissible @click:close="error = ''">
						{{ error }}
					</v-alert>
				</v-col>
			</v-row>
		</v-container>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { server } from "../server";

interface CommitInfo {
	branch: string;
	hash: string;
	author: string;
	message: string;
	committedAt: string;
}

interface FetchResult {
	success: boolean;
	message: string;
	output?: string;
}

const selectedProjectId = ref<string>("");
const projectList = ref<Array<{ id: string; name: string }>>([]);
const commitInfo = ref<CommitInfo | null>(null);
const fetchResult = ref<FetchResult | null>(null);
const loadingProjects = ref(false);
const loadingCommit = ref(false);
const loadingFetch = ref(false);
const error = ref("");

// 加载项目列表
async function loadProjectList() {
	loadingProjects.value = true;
	error.value = "";
	try {
		const projects = await server.projects.getProjectList.query();
		projectList.value = projects.map((id: string) => ({
			id,
			name: `项目 ${id}`,
		}));
		
		// 如果列表不为空且没有选中项目，自动选择第一个
		if (projects.length > 0 && !selectedProjectId.value) {
			selectedProjectId.value = projects[0];
			loadCommit();
		}
	} catch (err: any) {
		error.value = `加载项目列表失败: ${err.message || String(err)}`;
		console.error("加载项目列表失败:", err);
	} finally {
		loadingProjects.value = false;
	}
}

// 加载指定项目的最新提交
async function loadCommit() {
	if (!selectedProjectId.value) {
		return;
	}
	
	loadingCommit.value = true;
	error.value = "";
	commitInfo.value = null;
	
	try {
		const commit = await server.projects.getSelectedProjectLatestCommit.query(
			selectedProjectId.value
		);
		commitInfo.value = commit;
	} catch (err: any) {
		error.value = `加载提交信息失败: ${err.message || String(err)}`;
		console.error("加载提交信息失败:", err);
		commitInfo.value = null;
	} finally {
		loadingCommit.value = false;
	}
}

// 执行 git fetch
async function handleFetch() {
	if (!selectedProjectId.value) {
		return;
	}
	
	loadingFetch.value = true;
	error.value = "";
	fetchResult.value = null;
	
	try {
		const result = await server.projects.fetchProject.mutate({
			projectId: selectedProjectId.value,
			prune: true,
			all: true,
		});
		fetchResult.value = result;
		
		// 如果 fetch 成功，自动刷新提交信息
		if (result.success) {
			// 等待一小段时间让 fetch 完成
			setTimeout(() => {
				loadCommit();
			}, 500);
		}
	} catch (err: any) {
		fetchResult.value = {
			success: false,
			message: `Git fetch 失败: ${err.message || String(err)}`,
		};
		console.error("Git fetch 失败:", err);
	} finally {
		loadingFetch.value = false;
	}
}

// 格式化日期
function formatDate(dateString: string): string {
	if (!dateString) return "";
	const date = new Date(dateString);
	return date.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

// 组件挂载时加载项目列表
onMounted(() => {
	loadProjectList();
});
</script>

<style scoped>
.git-test-page {
	padding: 20px 0;
}

code {
	background-color: rgba(0, 0, 0, 0.05);
	padding: 2px 6px;
	border-radius: 4px;
	font-family: 'Courier New', monospace;
}

pre {
	background-color: rgba(0, 0, 0, 0.05);
	padding: 8px;
	border-radius: 4px;
	overflow-x: auto;
	white-space: pre-wrap;
	word-break: break-all;
}
</style>

