<template>
	<div class="codex-test-page">
		<v-container>
			<v-row>
				<v-col cols="12">
					<v-card>
						<v-card-title>
							<v-icon icon="mdi-robot" class="mr-2"></v-icon>
							Codex 项目调查测试
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
										clearable
									></v-select>
								</v-col>
								<v-col cols="12" md="6" class="d-flex align-center flex-wrap" style="gap: 8px;">
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

							<v-row class="mt-2">
								<v-col cols="12">
									<v-textarea
										v-model="query"
										label="查询问题"
										placeholder="例如：这是什么项目？"
										rows="3"
										variant="outlined"
										:disabled="!selectedProjectId || isRunning"
									></v-textarea>
								</v-col>
							</v-row>

							<v-row>
								<v-col cols="12" md="6">
									<v-switch
										v-model="options.fullAuto"
										label="全自动模式 (--full-auto)"
										color="primary"
										:disabled="isRunning"
									></v-switch>
								</v-col>
								<v-col cols="12" md="6">
									<v-switch
										v-model="options.useSync"
										label="使用同步模式 (execSync)"
										color="primary"
										:disabled="isRunning"
										hint="同步模式会阻塞直到命令完成"
									></v-switch>
								</v-col>
								<v-col cols="12" md="6">
									<v-switch
										v-model="options.cleanup"
										label="执行后清理输出文件"
										color="primary"
										:disabled="isRunning"
									></v-switch>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model="options.outputFile"
										label="输出文件名"
										variant="outlined"
										density="compact"
										:disabled="isRunning"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model.number="options.timeout"
										label="超时时间（毫秒）"
										type="number"
										variant="outlined"
										density="compact"
										hint="默认 10 分钟 (600000ms)"
										:disabled="isRunning"
									></v-text-field>
								</v-col>
							</v-row>

							<v-row class="mt-2">
								<v-col cols="12" class="d-flex align-center flex-wrap" style="gap: 8px;">
									<v-btn
										color="primary"
										:loading="isRunning"
										@click="handleInvestigate"
										:disabled="!selectedProjectId || !query.trim()"
										size="large"
									>
										<v-icon icon="mdi-play" class="mr-2"></v-icon>
										开始调查
									</v-btn>
									<v-btn
										color="error"
										@click="handleStop"
										:disabled="!isRunning"
										variant="outlined"
									>
										<v-icon icon="mdi-stop" class="mr-2"></v-icon>
										停止
									</v-btn>
									<v-spacer></v-spacer>
									<v-chip
										v-if="isRunning"
										color="warning"
										prepend-icon="mdi-loading mdi-spin"
									>
										执行中...
									</v-chip>
								</v-col>
							</v-row>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>

			<!-- 结果显示 -->
			<v-row v-if="result">
				<v-col cols="12">
					<v-card>
						<v-card-title>
							<v-icon 
								:icon="result.success ? 'mdi-check-circle' : 'mdi-alert-circle'" 
								:color="result.success ? 'success' : 'error'"
								class="mr-2"
							></v-icon>
							调查结果
							<v-spacer></v-spacer>
							<v-btn
								icon="mdi-close"
								variant="text"
								size="small"
								@click="result = null"
							></v-btn>
						</v-card-title>
						<v-card-text>
							<v-alert
								:type="result.success ? 'success' : 'error'"
								class="mb-4"
								variant="tonal"
							>
								<strong>{{ result.success ? '成功' : '失败' }}:</strong> 
								<div style="white-space: pre-line; margin-top: 4px;">{{ result.message }}</div>
							</v-alert>

							<!-- 输出文件内容 -->
							<v-expansion-panels v-if="result.output" class="mb-4">
								<v-expansion-panel>
									<v-expansion-panel-title>
										<v-icon icon="mdi-file-document" class="mr-2"></v-icon>
										输出文件内容
										<v-chip size="small" class="ml-2">
											{{ result.output.length }} 字符
										</v-chip>
									</v-expansion-panel-title>
									<v-expansion-panel-text>
										<pre class="output-content">{{ result.output }}</pre>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>

							<!-- 标准输出 -->
							<v-expansion-panels v-if="result.stdout" class="mb-4">
								<v-expansion-panel>
									<v-expansion-panel-title>
										<v-icon icon="mdi-console" class="mr-2"></v-icon>
										标准输出 (stdout)
									</v-expansion-panel-title>
									<v-expansion-panel-text>
										<pre class="output-content">{{ result.stdout }}</pre>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>

							<!-- 标准错误输出 -->
							<v-expansion-panels v-if="result.stderr">
								<v-expansion-panel>
									<v-expansion-panel-title>
										<v-icon icon="mdi-alert" class="mr-2"></v-icon>
										错误输出 (stderr)
									</v-expansion-panel-title>
									<v-expansion-panel-text>
										<pre class="output-content error-output">{{ result.stderr }}</pre>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>

							<!-- 输出文件路径 -->
							<v-chip
								v-if="result.outputFilePath"
								color="info"
								variant="outlined"
								class="mt-2"
							>
								<v-icon icon="mdi-file-path" class="mr-1"></v-icon>
								输出文件: {{ result.outputFilePath }}
							</v-chip>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>

			<!-- 错误提示 -->
			<v-row v-if="error">
				<v-col cols="12">
					<v-alert 
						type="error" 
						dismissible 
						@click:close="error = ''"
						variant="tonal"
					>
						{{ error }}
					</v-alert>
				</v-col>
			</v-row>

			<!-- 使用说明 -->
			<v-row class="mt-4">
				<v-col cols="12">
					<v-card variant="outlined" color="info">
						<v-card-title class="text-subtitle-1">
							<v-icon icon="mdi-information" class="mr-2"></v-icon>
							使用说明
						</v-card-title>
						<v-card-text>
							<ul class="text-body-2">
								<li>选择要调查的项目</li>
								<li>输入查询问题，例如："这是什么项目？"、"这个项目的主要功能是什么？"</li>
								<li>配置选项（全自动模式、超时时间等）</li>
								<li>点击"开始调查"执行 codex 命令</li>
								<li>结果会显示在下方，包括输出文件内容和命令输出</li>
							</ul>
							<v-alert type="warning" variant="tonal" class="mt-2">
								<strong>注意：</strong> 确保系统已安装 codex CLI 工具，且可以在命令行中执行 <code>codex</code> 命令。
							</v-alert>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>
		</v-container>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { server } from "../server";

interface CodexResult {
	success: boolean;
	message: string;
	output?: string;
	stdout?: string;
	stderr?: string;
	outputFilePath?: string;
}

interface CodexOptions {
	fullAuto: boolean;
	useSync: boolean;
	cleanup: boolean;
	outputFile: string;
	timeout?: number;
}

const selectedProjectId = ref<string>("");
const projectList = ref<Array<{ id: string; name: string }>>([]);
const query = ref("这是什么项目？");
const result = ref<CodexResult | null>(null);
const loadingProjects = ref(false);
const isRunning = ref(false);
const error = ref("");

const options = ref<CodexOptions>({
	fullAuto: true,
	useSync: false,
	cleanup: false,
	outputFile: "answer.txt",
	timeout: 600000, // 10 minutes
});

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
		}
	} catch (err: any) {
		error.value = `加载项目列表失败: ${err.message || String(err)}`;
		console.error("加载项目列表失败:", err);
	} finally {
		loadingProjects.value = false;
	}
}

// 执行 codex 调查
async function handleInvestigate() {
	if (!selectedProjectId.value || !query.value.trim()) {
		error.value = "请选择项目并输入查询问题";
		return;
	}
	
	isRunning.value = true;
	error.value = "";
	result.value = null;
	
	try {
		const resultData = await server.projects.investigateProject.mutate({
			projectId: selectedProjectId.value,
			query: query.value.trim(),
			fullAuto: options.value.fullAuto,
			useSync: options.value.useSync,
			cleanup: options.value.cleanup,
			outputFile: options.value.outputFile,
			timeout: options.value.timeout,
			extraArgs: [],
		});
		
		result.value = resultData;
	} catch (err: any) {
		error.value = `Codex 调查失败: ${err.message || String(err)}`;
		console.error("Codex 调查失败:", err);
		result.value = {
			success: false,
			message: `执行失败: ${err.message || String(err)}`,
			stderr: err.message || String(err),
		};
	} finally {
		isRunning.value = false;
	}
}

// 停止执行（实际上无法真正停止已发送的请求，但可以重置状态）
function handleStop() {
	// 注意：由于是 HTTP 请求，无法真正停止服务器端的执行
	// 这里只是重置 UI 状态
	isRunning.value = false;
	error.value = "已取消执行（注意：服务器端可能仍在执行）";
}

// 组件挂载时加载项目列表
onMounted(() => {
	loadProjectList();
});
</script>

<style scoped>
.codex-test-page {
	padding: 20px 0;
}

.output-content {
	background-color: rgba(0, 0, 0, 0.05);
	padding: 12px;
	border-radius: 4px;
	overflow-x: auto;
	white-space: pre-wrap;
	word-break: break-word;
	font-family: 'Courier New', monospace;
	font-size: 0.9em;
	line-height: 1.5;
	max-height: 400px;
	overflow-y: auto;
}

.error-output {
	background-color: rgba(244, 67, 54, 0.1);
	color: #d32f2f;
}

code {
	background-color: rgba(0, 0, 0, 0.05);
	padding: 2px 6px;
	border-radius: 4px;
	font-family: 'Courier New', monospace;
	font-size: 0.9em;
}

ul {
	padding-left: 20px;
}

ul li {
	margin-bottom: 8px;
}
</style>

