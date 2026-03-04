<template>
	<div class="claude-test-page">
		<v-container>
			<v-row>
				<v-col cols="12">
					<v-card>
						<v-card-title>
							<v-icon icon="mdi-brain" class="mr-2"></v-icon>
							Claude 项目分析测试
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
									<v-select
										v-model="options.outputFormat"
										:items="outputFormatOptions"
										label="输出格式"
										variant="outlined"
										density="compact"
										:disabled="isRunning"
									></v-select>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model="options.model"
										label="模型"
										variant="outlined"
										density="compact"
										hint="如: sonnet, opus, claude-sonnet-4-5-20250929"
										:disabled="isRunning"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model.number="options.maxTurns"
										label="最大轮次"
										type="number"
										variant="outlined"
										density="compact"
										hint="限制非交互模式下的轮次"
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
										v-model="options.verbose"
										label="详细日志 (--verbose)"
										color="primary"
										:disabled="isRunning"
									></v-switch>
								</v-col>
							</v-row>

							<!-- 高级选项 -->
							<v-expansion-panels class="mt-2">
								<v-expansion-panel>
									<v-expansion-panel-title>
										<v-icon icon="mdi-cog" class="mr-2"></v-icon>
										高级选项
									</v-expansion-panel-title>
									<v-expansion-panel-text>
										<v-row>
											<v-col cols="12">
												<v-textarea
													v-model="options.systemPrompt"
													label="自定义系统提示 (--system-prompt)"
													variant="outlined"
													density="compact"
													rows="2"
													hint="替换整个默认系统提示"
													:disabled="isRunning"
												></v-textarea>
											</v-col>
											<v-col cols="12">
												<v-textarea
													v-model="options.appendSystemPrompt"
													label="追加系统提示 (--append-system-prompt)"
													variant="outlined"
													density="compact"
													rows="2"
													hint="追加到默认系统提示"
													:disabled="isRunning"
												></v-textarea>
											</v-col>
											<v-col cols="12" md="6">
												<v-text-field
													v-model="options.systemPromptFile"
													label="系统提示文件 (--system-prompt-file)"
													variant="outlined"
													density="compact"
													:disabled="isRunning"
												></v-text-field>
											</v-col>
											<v-col cols="12" md="6">
												<v-text-field
													v-model="options.permissionMode"
													label="权限模式 (--permission-mode)"
													variant="outlined"
													density="compact"
													hint="如: plan"
													:disabled="isRunning"
												></v-text-field>
											</v-col>
											<v-col cols="12">
												<v-textarea
													v-model="options.agents"
													label="自定义子代理 (--agents)"
													variant="outlined"
													density="compact"
													rows="3"
													hint="JSON 格式，定义自定义子代理"
													:disabled="isRunning"
												></v-textarea>
											</v-col>
											<v-col cols="12" md="6">
												<v-switch
													v-model="options.continue"
													label="继续最近对话 (--continue)"
													color="primary"
													:disabled="isRunning"
												></v-switch>
											</v-col>
											<v-col cols="12" md="6">
												<v-text-field
													v-model="options.resume"
													label="恢复会话ID (--resume)"
													variant="outlined"
													density="compact"
													:disabled="isRunning"
												></v-text-field>
											</v-col>
											<v-col cols="12" md="6">
												<v-switch
													v-model="options.dangerouslySkipPermissions"
													label="跳过权限提示 (--dangerously-skip-permissions)"
													color="error"
													:disabled="isRunning"
													hint="谨慎使用"
												></v-switch>
											</v-col>
										</v-row>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>

							<v-row class="mt-2">
								<v-col cols="12" class="d-flex align-center flex-wrap" style="gap: 8px;">
									<v-btn
										color="primary"
										:loading="isRunning"
										@click="handleAnalyze"
										:disabled="!selectedProjectId || !query.trim()"
										size="large"
									>
										<v-icon icon="mdi-play" class="mr-2"></v-icon>
										开始分析
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
							分析结果
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

							<!-- 贴吧老哥总结 -->
							<v-expansion-panels v-if="result.tiebaSummary" class="mb-4">
								<v-expansion-panel>
									<v-expansion-panel-title>
										<v-icon icon="mdi-emoticon-happy" class="mr-2" color="warning"></v-icon>
										贴吧老哥总结
										<v-chip size="small" color="warning" class="ml-2">
											{{ result.tiebaSummary.length }} 字符
										</v-chip>
									</v-expansion-panel-title>
									<v-expansion-panel-text>
										<v-alert type="info" variant="tonal" class="mb-2">
											<strong>💡 提示：</strong> 这是使用 AI 将分析结果转换为贴吧老哥风格的幽默总结
										</v-alert>
										<pre class="output-content tieba-summary">{{ result.tiebaSummary }}</pre>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>

							<!-- 输出内容 -->
							<v-expansion-panels v-if="result.output" class="mb-4">
								<v-expansion-panel>
									<v-expansion-panel-title>
										<v-icon icon="mdi-file-document" class="mr-2"></v-icon>
										分析输出
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
								<li>选择要分析的项目</li>
								<li>输入查询问题，例如："这是什么项目？"、"这个项目的主要功能是什么？"</li>
								<li>配置选项（输出格式、模型、最大轮次等）</li>
								<li>点击"开始分析"执行 Claude CLI 命令</li>
								<li>结果会显示在下方，包括输出内容和命令输出</li>
							</ul>
							<v-alert type="warning" variant="tonal" class="mt-2">
								<strong>注意：</strong> 确保系统已安装 Claude CLI 工具，且可以在命令行中执行 <code>claude</code> 命令。
							</v-alert>
							<v-alert type="info" variant="tonal" class="mt-2">
								<strong>提示：</strong> 使用 <code>-p</code> 标志进行非交互式查询。支持多种输出格式：text、json、stream-json。
							</v-alert>
						</v-card-text>
					</v-card>
				</v-col>
			</v-row>
		</v-container>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { server } from "../server";

interface ClaudeResult {
	success: boolean;
	message: string;
	output?: string;
	stdout?: string;
	stderr?: string;
	tiebaSummary?: string;
}

interface ClaudeOptions {
	outputFormat: 'text' | 'json' | 'stream-json';
	model?: string;
	maxTurns?: number;
	timeout?: number;
	useSync: boolean;
	verbose: boolean;
	// Advanced options
	systemPrompt?: string;
	systemPromptFile?: string;
	appendSystemPrompt?: string;
	permissionMode?: string;
	agents?: string;
	continue?: boolean;
	resume?: string;
	dangerouslySkipPermissions?: boolean;
}

const selectedProjectId = ref<string>("");
const projectList = ref<Array<{ id: string; name: string }>>([]);
const query = ref("这是什么项目？");
const result = ref<ClaudeResult | null>(null);
const loadingProjects = ref(false);
const isRunning = ref(false);
const error = ref("");

const outputFormatOptions = [
	{ title: '文本 (text)', value: 'text' },
	{ title: 'JSON (json)', value: 'json' },
	{ title: '流式 JSON (stream-json)', value: 'stream-json' },
];

const options = ref<ClaudeOptions>({
	outputFormat: 'text',
	useSync: false,
	verbose: false,
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

// 执行 Claude 分析
async function handleAnalyze() {
	if (!selectedProjectId.value || !query.value.trim()) {
		error.value = "请选择项目并输入查询问题";
		return;
	}
	
	isRunning.value = true;
	error.value = "";
	result.value = null;
	
	try {
		const resultData = await server.projects.analyzeProject.mutate({
			projectId: selectedProjectId.value,
			query: query.value.trim(),
			outputFormat: options.value.outputFormat,
			model: options.value.model,
			maxTurns: options.value.maxTurns,
			useSync: options.value.useSync,
			timeout: options.value.timeout,
			verbose: options.value.verbose,
			systemPrompt: options.value.systemPrompt,
			systemPromptFile: options.value.systemPromptFile,
			appendSystemPrompt: options.value.appendSystemPrompt,
			permissionMode: options.value.permissionMode,
			agents: options.value.agents,
			continue: options.value.continue,
			resume: options.value.resume,
			dangerouslySkipPermissions: options.value.dangerouslySkipPermissions,
			extraArgs: [],
		});
		
		result.value = resultData;
	} catch (err: any) {
		error.value = `Claude 分析失败: ${err.message || String(err)}`;
		console.error("Claude 分析失败:", err);
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
.claude-test-page {
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

.tieba-summary {
	background-color: rgba(255, 152, 0, 0.05);
	border-left: 3px solid #ff9800;
	padding-left: 16px;
	font-weight: 500;
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


