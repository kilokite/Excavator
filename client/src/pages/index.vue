<template>
	<v-container class="pa-4">
		<div class="d-flex align-center" style="gap: 10px;">
			<v-icon icon="mdi-view-dashboard" size="large" />
			<div class="text-h6 font-weight-bold">工作台</div>
			<v-spacer />
			<v-btn icon="mdi-refresh" variant="text" :loading="loading" @click="reloadAll" />
		</div>

		<!-- 顶部：项目选择 -->
		<v-row class="mt-2" dense>
			<v-col cols="12" md="8">
				<v-select
					v-model="selectedProjectId"
					:items="projectSelectItems"
					item-title="name"
					item-value="id"
					label="项目"
					variant="outlined"
					density="compact"
					hide-details
					:loading="loadingProjects"
					clearable
					@update:model-value="handleProjectChange"
				/>
			</v-col>
			<v-col cols="12" md="4" class="d-flex align-center" style="gap: 8px;">
				<v-btn color="primary" variant="tonal" :disabled="!selectedProjectId" @click="goReports">
					进入报告管理
				</v-btn>
			</v-col>
		</v-row>

		<!-- 统计卡片 -->
		<v-row dense class="mt-2">
			<v-col cols="12" md="3">
				<v-card color="primary" variant="tonal">
					<v-card-title class="d-flex align-center" style="gap: 8px;">
						<v-icon icon="mdi-message-processing" />
						<span class="text-subtitle-2">消息处理</span>
					</v-card-title>
					<v-card-text class="text-h5 font-weight-bold">{{ stats?.counters.messagesProcessed ?? 0 }}</v-card-text>
				</v-card>
			</v-col>
			<v-col cols="12" md="3">
				<v-card color="purple" variant="tonal">
					<v-card-title class="d-flex align-center" style="gap: 8px;">
						<v-icon icon="mdi-source-commit" />
						<span class="text-subtitle-2">Commit 检查</span>
					</v-card-title>
					<v-card-text class="text-h5 font-weight-bold">{{ stats?.counters.commitChecks ?? 0 }}</v-card-text>
				</v-card>
			</v-col>
			<v-col cols="12" md="3">
				<v-card color="teal" variant="tonal">
					<v-card-title class="d-flex align-center" style="gap: 8px;">
						<v-icon icon="mdi-file-document-check" />
						<span class="text-subtitle-2">报告生成</span>
					</v-card-title>
					<v-card-text class="text-h5 font-weight-bold">{{ stats?.counters.reportsGenerated ?? 0 }}</v-card-text>
				</v-card>
			</v-col>
			<v-col cols="12" md="3">
				<v-card color="orange" variant="tonal">
					<v-card-title class="d-flex align-center" style="gap: 8px;">
						<v-icon icon="mdi-robot" />
						<span class="text-subtitle-2">自动检查运行</span>
					</v-card-title>
					<v-card-text class="text-h5 font-weight-bold">{{ stats?.counters.autoCheckRuns ?? 0 }}</v-card-text>
				</v-card>
			</v-col>
		</v-row>

		<!-- 自动检查概览 + 最近报告 -->
		<v-row dense class="mt-2">
			<v-col cols="12" md="6">
				<v-card color="indigo" variant="tonal">
					<v-card-title class="d-flex align-center" style="gap: 8px;">
						<v-icon icon="mdi-robot" />
						自动检查
					</v-card-title>
					<v-card-text>
						<div class="d-flex align-center" style="gap: 12px;">
							<v-chip :color="autoCheck?.globalEnabled ? 'success' : 'grey'" variant="tonal" size="small">
								{{ autoCheck?.globalEnabled ? "全局启用" : "全局关闭" }}
							</v-chip>
							<div class="text-body-2">
								启用项目：{{ autoCheck?.enabledCount ?? 0 }} / {{ autoCheck?.totalCount ?? 0 }}
							</div>
						</div>

						<div class="mt-3" v-if="autoCheck?.projects?.length">
							<div class="text-subtitle-2 mb-1">项目列表</div>
							<v-table density="compact">
								<thead>
									<tr>
										<th>项目</th>
										<th>间隔</th>
										<th>启用</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="p in autoCheck.projects.slice(0, 8)" :key="p.projectId">
										<td>{{ p.projectId }}</td>
										<td>{{ formatInterval(p.fetchInterval) }}</td>
										<td>
											<v-chip :color="p.enabled ? 'success' : 'grey'" size="x-small" variant="tonal">
												{{ p.enabled ? "是" : "否" }}
											</v-chip>
										</td>
									</tr>
								</tbody>
							</v-table>
						</div>
					</v-card-text>
				</v-card>
			</v-col>

			<v-col cols="12" md="6">
				<v-card color="blue" variant="tonal">
					<v-card-title class="d-flex align-center" style="gap: 8px;">
						<v-icon icon="mdi-file-document-multiple" />
						最近报告
					</v-card-title>
					<v-card-text>
						<div v-if="recentReports.length === 0" class="text-body-2 text-medium-emphasis">暂无</div>
						<v-list v-else density="compact">
							<v-list-item
								v-for="r in recentReports"
								:key="r.id"
								:title="`${r.projectId} · ${r.commitHash?.slice(0,8) || ''}`"
								:subtitle="`${formatTs(r.updatedAt)} · ${r.authorName || r.authorEmail || '未知作者'}`"
								@click="openReport(r.id)"
							>
								<template #append>
									<v-btn size="small" variant="text" @click.stop="openReport(r.id)">打开</v-btn>
								</template>
							</v-list-item>
						</v-list>
					</v-card-text>
				</v-card>
			</v-col>
		</v-row>
		<!-- 运行时性能信息 -->
		<!-- 运行时性能信息 -->
<v-row dense class="mt-2">
	<v-col></v-col>
  <v-col cols="12" md="6">
    <v-card color="deep-purple" variant="tonal">
      <v-card-title class="d-flex align-center" style="gap: 8px;">
        <v-icon icon="mdi-chip" />
        运行时信息
      </v-card-title>
      <v-card-text class="text-body-2">
        <div>Node 版本：{{ stats?.runtime?.nodeVersion || "-" }}</div>
        <div>运行时间：{{ formatUptime(stats?.runtime?.uptimeSec) }}</div>
        <div>进程：PID {{ stats?.runtime?.pid ?? "-" }} · 平台 {{ stats?.runtime?.platform || "-" }}</div>
        <div>
          内存：RSS {{ stats?.runtime?.rssMB ?? "-" }} MB，
          Heap {{ stats?.runtime?.heapUsedMB ?? "-" }} / {{ stats?.runtime?.heapTotalMB ?? "-" }} MB，
          External {{ stats?.runtime?.externalMB ?? "-" }} MB
        </div>
        <div>
          CPU：总 {{ stats?.runtime?.cpuTotalMs ?? "-" }} ms（≈
          {{ stats?.runtime?.cpuPerSec ?? "-" }} ms/s）
        </div>
        <div>
          Load：
          {{ stats?.runtime?.load1 ?? "-" }}/{{ stats?.runtime?.load5 ?? "-" }}/{{ stats?.runtime?.load15 ?? "-" }}
        </div>
      </v-card-text>
    </v-card>
  </v-col>
</v-row>
	</v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { server } from "../server";type ProjectInfo = {
	id: string;
	name?: string;
	isGitRepository?: boolean;
	config?: { name?: string } | null;
};

type RuntimeInfo = {
	rssMB: number;
	heapUsedMB: number;
	heapTotalMB: number;
	externalMB: number;
	uptimeSec: number;
	nodeVersion: string;
	cpuUserMs: number;
	cpuSystemMs: number;
	cpuTotalMs: number;
	cpuPerSec: number;
	load1: number;
	load5: number;
	load15: number;
	pid: number;
	platform: string;
};

type StatsData = {
	startedAt: string;
	updatedAt: string;
	counters: Record<string, number>;
	perProject: Record<string, Record<string, number>>;
	runtime?: RuntimeInfo;
};

type AutoCheckList = {
	globalEnabled: boolean;
	enabledCount: number;
	totalCount: number;
	projects: Array<{ projectId: string; fetchInterval: number; enabled: boolean }>;
};

type RecentReport = {
	id: string;
	projectId: string;
	commitHash: string;
	updatedAt: number;
	authorName?: string | null;
	authorEmail?: string | null;
};

const router = useRouter();

const STORAGE_PROJECT_KEY = "excavator.reports.selectedProjectId.v1";

function safeGetStorage(): Storage | null {
	try {
		return typeof window !== "undefined" ? window.localStorage : null;
	} catch {
		return null;
	}
}

function loadPersistedProjectId(): string {
	const s = safeGetStorage();
	return (s?.getItem(STORAGE_PROJECT_KEY) || "").trim();
}

function savePersistedProjectId(projectId: string) {
	const s = safeGetStorage();
	if (!s) return;
	s.setItem(STORAGE_PROJECT_KEY, String(projectId || ""));
}

const loading = ref(false);
const loadingProjects = ref(false);

const projects = ref<ProjectInfo[]>([]);
const selectedProjectId = ref<string>("");

const stats = ref<StatsData | null>(null);
const autoCheck = ref<AutoCheckList | null>(null);
const recentReports = ref<RecentReport[]>([]);

const projectSelectItems = computed(() =>
	projects.value.map((p) => ({
		id: p.id,
		name: p.config?.name || p.name || p.id,
	}))
);

function formatInterval(ms: number): string {
	if (!ms) return "-";
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.round(s / 60);
	return `${m}min`;
}

function formatTs(ts?: number): string {
	if (!ts) return "";
	try {
		return new Date(ts).toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return String(ts);
	}
}

function formatUptime(sec?: number): string {
	if (!sec) return "-";
	const s = Math.floor(sec);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m`;
	return `${s}s`;
}

async function loadProjects() {
	loadingProjects.value = true;
	try {
		const all = (await server.projects.getAllProjectsInfo.query()) as any[];
		projects.value = (all || []).filter((p) => p.isGitRepository);
	} finally {
		loadingProjects.value = false;
	}
}

async function loadStats() {
	stats.value = (await server.stats.getSummary.query()) as any;
}

async function loadAutoCheck() {
	autoCheck.value = (await server.autoCheck.getAutoCheckList.query()) as any;
}

async function loadRecentReports() {
	const res = (await server.reports.recentReports.query({ limit: 10 })) as any[];
	recentReports.value = (res || []) as any;
}

async function handleProjectChange() {
	if (selectedProjectId.value) savePersistedProjectId(selectedProjectId.value);
}

function openReport(reportId: string) {
	router.push(`/report/${reportId}`);
}

function goReports() {
	router.push("/reports");
}

async function reloadAll() {
	loading.value = true;
	try {
		await Promise.all([loadStats(), loadAutoCheck(), loadRecentReports()]);
	} finally {
		loading.value = false;
	}
}

onMounted(async () => {
	loading.value = true;
	try {
		await loadProjects();

		const pid = loadPersistedProjectId();
		if (pid && projects.value.some((p) => p.id === pid)) {
			selectedProjectId.value = pid;
		}

		await Promise.all([loadStats(), loadAutoCheck(), loadRecentReports()]);
	} finally {
		loading.value = false;
	}
});
</script>

<style scoped>
</style>
