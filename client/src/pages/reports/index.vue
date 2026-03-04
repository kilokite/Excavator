<template>
	<div class="reports-page">
		<!-- 顶部工具栏（页面级） -->
		<div class="page-toolbar">
			<div class="d-flex align-center" style="gap: 10px;">
				<v-icon icon="mdi-file-document-multiple" size="large" />
				<div class="toolbar-title">报告管理</div>
			</div>
			<v-spacer />

			<v-btn-toggle
				v-model="activeView"
				mandatory
				variant="outlined"
				density="compact"
				class="mr-2"
			>
				<v-btn value="reports" prepend-icon="mdi-database">数据库报告</v-btn>
				<v-btn value="commits" prepend-icon="mdi-source-branch">从 Commit 生成</v-btn>
			</v-btn-toggle>

			<v-btn
				icon="mdi-refresh"
				variant="text"
				:loading="loading"
				@click="reloadCurrent"
			/>
		</div>

		<div class="page-body">
			<!-- 左侧子菜单 -->
			<div class="side">
				<div class="side-section">
					<div class="side-section-title">项目</div>
					<v-select
						v-model="selectedProjectId"
						:items="projects"
						item-title="name"
						item-value="id"
						label="选择项目"
						variant="outlined"
						density="compact"
						hide-details
						:loading="loadingProjects"
						@update:model-value="handleProjectChange"
					>
						<template #item="{ props, item }">
							<v-list-item v-bind="props">
								<template #prepend>
									<v-icon
										:icon="item.raw.isGitRepository ? 'mdi-git' : 'mdi-folder'"
										:color="item.raw.isGitRepository ? 'primary' : 'grey'"
									/>
								</template>
								<v-list-item-title>{{ item.raw.config?.name || item.raw.name }}</v-list-item-title>
								<v-list-item-subtitle>{{ item.raw.id }}</v-list-item-subtitle>
							</v-list-item>
						</template>
					</v-select>
				</div>

				<div v-if="activeView === 'commits'" class="side-section">
					<div class="side-section-title">分支</div>
					<v-select
						v-model="selectedBranch"
						:items="branches"
						item-title="title"
						item-value="value"
						label="选择分支"
						variant="outlined"
						density="compact"
						hide-details
						:loading="loadingBranches"
						@update:model-value="handleBranchChange"
					>
						<template #prepend-inner>
							<v-icon icon="mdi-source-branch" />
						</template>
					</v-select>

					<v-btn
						v-if="selectedBranch"
						color="primary"
						variant="flat"
						block
						class="mt-3"
						:loading="switchingBranch"
						@click="switchBranch"
					>
						切换分支
					</v-btn>
				</div>
			</div>

			<!-- 右侧内容区 -->
			<div class="content">
				<!-- 数据库报告 -->
				<div v-if="activeView === 'reports'" class="pane">
					<div class="pane-toolbar">
						<v-text-field
							v-model="reportsKeyword"
							label="搜索报告（commit / 摘要）"
							prepend-inner-icon="mdi-magnify"
							variant="outlined"
							density="compact"
							hide-details
							clearable
							style="max-width: 420px;"
							@update:model-value="debouncedResetReports"
						/>
						<v-spacer />
						<div class="muted-text" v-if="selectedProjectId">
							显示 {{ filteredReportsCount }} / {{ reportsTotal }} 条
						</div>
					</div>

					<div class="pane-toolbar pane-toolbar-sub" v-if="selectedProjectId">
						<v-btn-toggle
							v-model="reportsQuickFilter"
							mandatory
							variant="outlined"
							density="compact"
							class="mr-2"
						>
							<v-btn value="all" prepend-icon="mdi-format-list-bulleted">全部</v-btn>
							<v-btn value="favorites" prepend-icon="mdi-star-outline">收藏</v-btn>
							<v-btn value="pinned" prepend-icon="mdi-pin-outline">置顶</v-btn>
							<v-btn value="recents" prepend-icon="mdi-history">最近</v-btn>
						</v-btn-toggle>

						<v-select
							v-model="levelFilter"
							:items="levelFilterItems"
							label="等级"
							variant="outlined"
							density="compact"
							hide-details
							style="max-width: 200px;"
							class="mr-2"
						/>

						<v-select
							v-model="mergeFilter"
							:items="mergeFilterItems"
							item-title="title"
							item-value="value"
							label="合并建议"
							variant="outlined"
							density="compact"
							hide-details
							style="max-width: 220px;"
							class="mr-2"
						/>

						<v-switch
							v-model="onlyCriticalWarnings"
							inset
							color="error"
							hide-details
							label="仅重大警告"
							class="mr-2"
						/>

						<v-combobox
							v-model="authorKeyword"
							:items="reportAuthorOptions"
							item-title="title"
							item-value="value"
							:return-object="false"
							label="作者（下拉/可输入）"
							prepend-inner-icon="mdi-account"
							variant="outlined"
							density="compact"
							hide-details
							clearable
							style="max-width: 260px;"
							class="mr-2"
							@focus="loadReportAuthors()"
						/>

						<v-spacer />
						<v-btn variant="text" size="small" @click="resetReportFilters">重置筛选</v-btn>
					</div>

					<v-progress-linear v-if="loadingReports" indeterminate color="primary" />

					<div v-if="!selectedProjectId" class="empty-state">
						请先在左侧选择项目
					</div>

					<div v-else>
						<div v-if="recentItems.length > 0 && reportsQuickFilter !== 'recents'" class="recents-panel">
							<div class="recents-title">最近访问</div>
							<div class="recents-chips">
								<v-chip
									v-for="x in recentItems.slice(0, 8)"
									:key="x.id"
									size="small"
									variant="outlined"
									class="mr-2 mb-2"
									@click="openReportById(x.id)"
									style="cursor: pointer;"
								>
									{{ getRecentLabel(x.id) }}
								</v-chip>
							</div>
						</div>

						<div v-if="displayReportItems.length > 0" class="report-list">
							<div
								v-for="r in displayReportItems"
								:key="r.id"
								class="report-row"
							>
							<div class="report-row-main">
								<div class="report-row-left">
									<div class="d-flex align-center" style="gap: 10px; flex-wrap: wrap;">
										<code class="hash">{{ r.commitHash?.substring(0, 7) }}</code>
										<div class="report-title">
											{{ r.projectInfo?.name || r.projectId }}
										</div>
										<div class="muted-text" v-if="r.projectInfo?.description">
											· {{ r.projectInfo.description }}
										</div>
									</div>

									<div class="report-meta">
										<span class="muted-text">commit：</span>
										<span class="mono">{{ r.commitHash }}</span>
										<span class="dot" v-if="r.authorName || r.authorEmail">·</span>
										<span class="muted-text" v-if="r.authorName || r.authorEmail">作者：</span>
										<span v-if="r.authorName || r.authorEmail">
											<span>{{ r.authorName || "（未知）" }}</span>
											<span v-if="r.authorEmail" class="mono muted-text"> &lt;{{ r.authorEmail }}&gt;</span>
										</span>
										<span class="dot">·</span>
										<span class="muted-text">更新：</span>
										<span>{{ formatTs(r.updatedAt) }}</span>
										<span class="dot">·</span>
										<span class="muted-text">创建：</span>
										<span>{{ formatTs(r.createdAt) }}</span>
										<span class="dot" v-if="r.messageId">·</span>
										<span class="muted-text" v-if="r.messageId">messageId：</span>
										<span class="mono" v-if="r.messageId">{{ r.messageId }}</span>
									</div>

									<div class="report-chips">
										<v-chip
											v-if="extractTiebaLevel(r.tiebaSummary || '')"
											size="small"
											:color="getCodeLevelColor(extractTiebaLevel(r.tiebaSummary || ''))"
											variant="tonal"
										>
											等级：{{ extractTiebaLevel(r.tiebaSummary || '') }}
											<span v-if="getCodeLevelRank(extractTiebaLevel(r.tiebaSummary || '')) !== null">
												（{{ (getCodeLevelRank(extractTiebaLevel(r.tiebaSummary || '')) as number) + 1 }}/4）
											</span>
										</v-chip>
										<v-chip
											v-if="r.mergeRecommendation"
											size="small"
											color="secondary"
											variant="tonal"
										>
											建议：{{ r.mergeRecommendation }}
										</v-chip>
										<v-chip
											v-if="(r.criticalWarningsCount || 0) > 0"
											size="small"
											color="error"
											variant="tonal"
										>
											重大警告：{{ r.criticalWarningsCount }}
										</v-chip>
										<v-chip
											size="small"
											color="grey"
											variant="outlined"
										>
											报告ID：{{ r.id }}
										</v-chip>
										<v-chip
											v-if="r.projectInfo?.updatedAt"
											size="small"
											color="grey"
											variant="outlined"
										>
											项目更新：{{ formatIso(r.projectInfo.updatedAt) }}
										</v-chip>
									</div>
								</div>

								<div class="report-row-actions">
									<v-btn
										:icon="isPinnedReport(r.id) ? 'mdi-pin' : 'mdi-pin-outline'"
										variant="text"
										size="small"
										@click.stop="togglePin(r.id)"
									/>
									<v-btn
										:icon="isFavoriteReport(r.id) ? 'mdi-star' : 'mdi-star-outline'"
										variant="text"
										size="small"
										@click.stop="toggleFav(r.id)"
									/>
									<v-btn
										variant="text"
										size="small"
										@click.stop="copyToClipboard(r.commitHash)"
									>
										复制 commit
									</v-btn>
									<v-btn
										variant="text"
										size="small"
										@click.stop="copyToClipboard(r.id)"
									>
										复制报告ID
									</v-btn>
									<v-btn
										variant="text"
										size="small"
										@click.stop="openReport(r)"
									>
										打开
									</v-btn>
									<v-btn
										variant="text"
										size="small"
										@click.stop="toggleReportExpand(r.id)"
									>
										{{ expandedReports[r.id] ? '收起' : '展开' }}
									</v-btn>
								</div>
							</div>

							<div class="report-row-preview">
								<div class="preview-col">
									<div class="preview-title">Executive Summary</div>
									<MarkdownRenderer
										:content="r.executiveSummary || '（无）'"
										variant="preview"
									/>
								</div>
								<div class="preview-col">
									<div class="preview-title">Tieba Summary</div>
									<MarkdownRenderer
										:content="r.tiebaSummary || '（无）'"
										variant="preview"
									/>
								</div>
							</div>

							<div v-if="expandedReports[r.id]" class="report-row-detail">
								<div class="detail-grid">
									<div class="detail-block">
										<div class="preview-title">Executive Summary（完整）</div>
										<div class="detail-md">
											<MarkdownRenderer :content="r.executiveSummary || ''" variant="full" />
										</div>
									</div>
									<div class="detail-block">
										<div class="preview-title">Tieba Summary（完整）</div>
										<div class="detail-md">
											<MarkdownRenderer :content="r.tiebaSummary || ''" variant="full" />
										</div>
									</div>
								</div>
							</div>
						</div>
						</div>

						<div v-else-if="!loadingReports" class="empty-state">
							暂无报告
						</div>
					</div>

					<div class="load-more-row" v-if="selectedProjectId">
						<v-btn
							variant="text"
							:disabled="loadingReports || !reportsHasMore"
							@click="loadMoreReports"
						>
							{{ reportsHasMore ? '加载更多' : '已加载全部' }}
						</v-btn>
					</div>

					<div ref="reportsSentinel" class="sentinel" />
				</div>

				<!-- Commit 列表（无限加载 + 搜索 + 批量生成） -->
				<div v-else class="pane">
					<div class="pane-toolbar">
						<v-text-field
							v-model="commitSearch"
							label="搜索 commit message"
							prepend-inner-icon="mdi-magnify"
							variant="outlined"
							density="compact"
							hide-details
							clearable
							style="max-width: 320px;"
							@update:model-value="debouncedResetCommits"
						/>
						<v-combobox
							v-model="commitAuthorFilter"
							:items="commitAuthorOptions"
							item-title="title"
							item-value="value"
							:return-object="false"
							label="作者（下拉/可输入）"
							prepend-inner-icon="mdi-account"
							variant="outlined"
							density="compact"
							hide-details
							clearable
							style="max-width: 240px;"
							class="ml-2"
							@focus="loadCommitAuthors()"
						/>
						<v-switch
							v-model="onlyNoReport"
							inset
							color="primary"
							hide-details
							label="仅显示无报告"
							class="ml-2"
						/>
						<v-spacer />
						<div class="muted-text mr-3">
							已选 {{ selectedCommits.length }} 项
						</div>
						<v-btn
							color="primary"
							:disabled="!selectedProjectId || selectedCommits.length === 0"
							:loading="generatingReports"
							@click="showBatchGenerateDialog = true"
						>
							批量生成报告
						</v-btn>
					</div>

					<v-progress-linear v-if="loadingCommits" indeterminate color="primary" />

					<div v-if="!selectedProjectId" class="empty-state">
						请先在左侧选择项目
					</div>
					<div v-else-if="!selectedBranch" class="empty-state">
						请先选择分支
					</div>

					<v-list v-else-if="filteredCommitItems.length > 0" density="compact" class="lined-list">
						<v-list-item
							v-for="c in filteredCommitItems"
							:key="c.hash"
							class="lined-item"
						>
							<template #prepend>
								<v-checkbox
									v-model="selectedCommits"
									:value="c.hash"
									hide-details
									class="mr-2"
								/>
							</template>

							<v-list-item-title>
								<div class="d-flex align-center" style="gap: 10px;">
									<code class="hash">{{ c.shortHash || c.hash.substring(0, 7) }}</code>
									<span>{{ c.message || '无提交信息' }}</span>
								</div>
							</v-list-item-title>

							<v-list-item-subtitle>
								<span v-if="c.author">{{ c.author }}</span>
								<span v-if="c.author && c.date" class="mx-2">·</span>
								<span v-if="c.date">{{ formatDate(c.date) }}</span>
							</v-list-item-subtitle>

							<template #append>
								<v-chip
									v-if="hasReport(c.hash)"
									size="small"
									color="success"
									variant="outlined"
									@click.stop="$router.push(`/report/${getReportId(c.hash)}`)"
									style="cursor: pointer;"
								>
									已有报告
								</v-chip>
								<v-chip v-else size="small" color="grey" variant="outlined">
									无报告
								</v-chip>
							</template>
						</v-list-item>
					</v-list>

					<div v-else-if="selectedProjectId && selectedBranch && !loadingCommits" class="empty-state">
						暂无 commit
					</div>

					<div class="load-more-row" v-if="selectedProjectId && selectedBranch">
						<v-btn
							variant="text"
							:disabled="loadingCommits || !commitsHasMore"
							@click="loadMoreCommits"
						>
							{{ commitsHasMore ? '加载更多' : '已加载全部' }}
						</v-btn>
					</div>

					<div ref="commitsSentinel" class="sentinel" />
				</div>
			</div>
		</div>

		<!-- 批量生成报告对话框 -->
		<v-dialog v-model="showBatchGenerateDialog" max-width="600">
			<v-sheet class="dialog-sheet">
				<div class="dialog-title">
					<v-icon icon="mdi-file-document-plus" class="mr-2" />
					批量生成报告
				</div>
				<v-divider />
				<div class="dialog-body">
					<div class="muted-text mb-3">
						将为选中的 {{ selectedCommits.length }} 个 commit 生成报告
					</div>
					<v-list density="compact" class="lined-list">
						<v-list-item v-for="hash in selectedCommits" :key="hash" class="lined-item">
							<template #prepend>
								<code class="hash">{{ hash.substring(0, 7) }}</code>
							</template>
							<v-list-item-title>{{ getCommitMessage(hash) || '（无提交信息）' }}</v-list-item-title>
						</v-list-item>
					</v-list>
				</div>
				<v-divider />
				<div class="dialog-actions">
					<v-spacer />
					<v-btn variant="text" @click="showBatchGenerateDialog = false">取消</v-btn>
					<v-btn color="primary" :loading="generatingReports" @click="handleBatchGenerate">开始生成</v-btn>
				</div>
			</v-sheet>
		</v-dialog>

		<!-- 错误提示 -->
		<v-snackbar
			v-model="showError"
			color="error"
			:timeout="5000"
		>
			{{ errorMessage }}
		</v-snackbar>

		<!-- 成功提示 -->
		<v-snackbar
			v-model="showSuccess"
			color="success"
			:timeout="3000"
		>
			{{ successMessage }}
		</v-snackbar>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";
import { server } from "../../server";
import MarkdownRenderer from "../../components/reports/MarkdownRenderer.vue";
import {
	loadReportPrefs,
	toggleFavorite,
	togglePinned,
	addRecent,
	getRecents,
} from "../../reportPrefs";

interface ProjectInfo {
	id: string;
	name: string;
	isGitRepository: boolean;
	path?: string;
	exists?: boolean;
	config?: {
		id?: string;
		name?: string;
		description?: string;
		gitRemote?: string;
		tags?: string[];
		createdAt?: string;
		updatedAt?: string;
	} | null;
}

interface CommitInfo {
	hash: string;
	shortHash?: string;
	author?: string;
	email?: string;
	date?: string;
	message?: string;
	body?: string;
}

interface ReportInfo {
	id: string;
	projectId: string;
	commitHash: string;
	createdAt: number;
	updatedAt: number;
	executiveSummary?: string;
	tiebaSummary?: string;
	messageId?: string | null;
	codeLevel?: string | null;
	mergeRecommendation?: string | null;
	mergeClass?: "needFix" | "canMerge" | "noMerge" | "unknown" | null;
	criticalWarningsCount?: number | null;
	overallScoreValue?: number | null;
	overallScoreText?: string | null;
	authorName?: string | null;
	authorEmail?: string | null;
	projectInfo?: {
		id: string;
		name?: string;
		description?: string;
		createdAt?: string;
		updatedAt?: string;
	} | null;
}

const loading = ref(false);
const loadingProjects = ref(false);
const loadingBranches = ref(false);
const loadingCommits = ref(false);
const switchingBranch = ref(false);
const generatingReports = ref(false);
const loadingReports = ref(false);

const projects = ref<ProjectInfo[]>([]);
const selectedProjectId = ref<string>("");
type BranchOption = { title: string; value: string; kind: "local" | "remote" };
const branches = ref<BranchOption[]>([]);
const selectedBranch = ref<string>("");
const commitItems = ref<CommitInfo[]>([]);
const reportItems = ref<ReportInfo[]>([]);
const selectedCommits = ref<string[]>([]);

type ViewMode = "reports" | "commits";
const activeView = ref<ViewMode>("reports");

// 报告：分页/搜索（无限加载）
const reportsKeyword = ref("");
const reportsTotal = ref(0);
const reportsOffset = ref(0);
const reportsLimit = 50;
const reportsHasMore = ref(true);
const expandedReports = ref<Record<string, boolean>>({});

// commits：分页/搜索（无限加载）
const commitsSkip = ref(0);
const commitsLimit = 50;
const commitsHasMore = ref(true);
const commitSearch = ref("");
const onlyNoReport = ref(false);
const commitAuthorFilter = ref<string>("");

const showBatchGenerateDialog = ref(false);
const showError = ref(false);
const showSuccess = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const reportsSentinel = ref<HTMLElement | null>(null);
const commitsSentinel = ref<HTMLElement | null>(null);
let reportsObserver: IntersectionObserver | null = null;
let commitsObserver: IntersectionObserver | null = null;
let reportsDebounceTimer: number | null = null;
let commitsDebounceTimer: number | null = null;
let authorDebounceTimer: number | null = null;
let backendReportsFilterTimer: number | null = null;

const router = useRouter();

// 记住用户选择的项目/分支（localStorage）
const STORAGE_PROJECT_KEY = "excavator.reports.selectedProjectId.v1";
const STORAGE_BRANCH_MAP_KEY = "excavator.reports.selectedBranchByProject.v1";

function safeGetStorage(): Storage | null {
	try {
		return typeof window !== "undefined" ? window.localStorage : null;
	} catch {
		return null;
	}
}

function loadPersistedProjectId(): string {
	const s = safeGetStorage();
	if (!s) return "";
	return (s.getItem(STORAGE_PROJECT_KEY) || "").trim();
}

function savePersistedProjectId(projectId: string) {
	const s = safeGetStorage();
	if (!s) return;
	s.setItem(STORAGE_PROJECT_KEY, String(projectId || ""));
}

function loadPersistedBranchMap(): Record<string, string> {
	const s = safeGetStorage();
	if (!s) return {};
	const raw = s.getItem(STORAGE_BRANCH_MAP_KEY);
	if (!raw) return {};
	try {
		const obj = JSON.parse(raw);
		return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
	} catch {
		return {};
	}
}

function savePersistedBranch(projectId: string, branch: string) {
	const s = safeGetStorage();
	if (!s) return;
	const map = loadPersistedBranchMap();
	map[projectId] = branch;
	s.setItem(STORAGE_BRANCH_MAP_KEY, JSON.stringify(map));
}

function getPersistedBranch(projectId: string): string {
	return (loadPersistedBranchMap()[projectId] || "").trim();
}

const persistedProjectId = ref<string>(loadPersistedProjectId());

// 报告偏好（本地 localStorage）
const reportPrefs = ref(loadReportPrefs());

function refreshPrefs() {
	reportPrefs.value = loadReportPrefs();
}

watch(
	() => selectedProjectId.value,
	() => {
		refreshPrefs();
		loadReportAuthors();
	},
	{ immediate: true }
);

function isFavoriteReport(reportId: string): boolean {
	const pid = selectedProjectId.value;
	if (!pid) return false;
	return (reportPrefs.value.favorites?.[pid] || []).includes(reportId);
}

function isPinnedReport(reportId: string): boolean {
	const pid = selectedProjectId.value;
	if (!pid) return false;
	return (reportPrefs.value.pinned?.[pid] || []).includes(reportId);
}

function toggleFav(reportId: string) {
	const pid = selectedProjectId.value;
	if (!pid) return;
	reportPrefs.value = toggleFavorite(reportPrefs.value, pid, reportId);
}

function togglePin(reportId: string) {
	const pid = selectedProjectId.value;
	if (!pid) return;
	reportPrefs.value = togglePinned(reportPrefs.value, pid, reportId);
}

function openReport(r: ReportInfo) {
	const pid = selectedProjectId.value || r.projectId;
	if (pid) reportPrefs.value = addRecent(reportPrefs.value, pid, r.id);
	router.push(`/report/${r.id}`);
}

function openReportById(reportId: string) {
	const pid = selectedProjectId.value;
	if (pid) reportPrefs.value = addRecent(reportPrefs.value, pid, reportId);
	router.push(`/report/${reportId}`);
}

function getRecentLabel(reportId: string): string {
	const hit = reportItems.value.find((r) => r.id === reportId);
	if (hit?.commitHash) return hit.commitHash.substring(0, 7);
	const parts = String(reportId).split("_");
	const maybeHash = parts.length >= 3 ? parts[1] : "";
	if (maybeHash && /^[a-f0-9]{7,40}$/i.test(maybeHash)) return maybeHash.substring(0, 7);
	return reportId;
}

const recentItems = computed(() => {
	const pid = selectedProjectId.value;
	if (!pid) return [];
	return getRecents(reportPrefs.value, pid);
});

// 报告筛选
type ReportsQuickFilter = "all" | "favorites" | "pinned" | "recents";
const reportsQuickFilter = ref<ReportsQuickFilter>("all");
const levelFilterItems = ["全部", "有机肥", "不可回收垃圾", "可回收垃圾", "非垃圾"];
const levelFilter = ref<string>("全部");

type MergeFilter = "all" | "needFix" | "canMerge" | "noMerge" | "unknown";
const mergeFilterItems: Array<{ title: string; value: MergeFilter }> = [
	{ title: "全部", value: "all" },
	{ title: "需要修复", value: "needFix" },
	{ title: "可直接合并", value: "canMerge" },
	{ title: "不建议/拒绝", value: "noMerge" },
	{ title: "未知", value: "unknown" },
];
const mergeFilter = ref<MergeFilter>("all");
const onlyCriticalWarnings = ref(false);
const authorKeyword = ref<string>("");

type AuthorOption = { title: string; value: string };
const reportAuthorOptions = ref<AuthorOption[]>([]);
const commitAuthorOptions = ref<AuthorOption[]>([]);

function formatAuthorTitle(name?: string | null, email?: string | null, count?: number | null): string {
	const n = (name || "").trim();
	const e = (email || "").trim();
	const base = e ? `${n || "（未知）"} <${e}>` : (n || "（未知）");
	return typeof count === "number" ? `${base} · ${count}` : base;
}

async function loadReportAuthors() {
	if (!selectedProjectId.value) return;
	try {
		const res: any[] = await server.reports.listAuthors.query({
			projectId: selectedProjectId.value,
			limit: 50, // 下拉候选一次性拉取，combobox 本地过滤，避免选中时 items 抖动
		});
		reportAuthorOptions.value = (res || [])
			.map((x: any) => ({
				title: formatAuthorTitle(x.name, x.email, x.count),
				// value：优先用 email（更稳定），没有则用 name
				value: (x.email || x.name || "").trim(),
			}))
			.filter((x) => !!x.value);
	} catch {
		// ignore
	}
}

async function loadCommitAuthors() {
	if (!selectedProjectId.value || !selectedBranch.value) return;
	try {
		const res: any = await server.git.authors.query({
			projectId: selectedProjectId.value,
			branch: selectedBranch.value,
			limitCommits: 800,
			limitAuthors: 50,
		});
		if (!res?.success || !Array.isArray(res.authors)) return;
		commitAuthorOptions.value = res.authors
			.map((a: any) => ({
				title: formatAuthorTitle(a.name, a.email, a.count),
				// git.log 的 author 过滤参数匹配 author name，所以 value 用 name
				value: (a.name || "").trim(),
			}))
			.filter((x: any) => !!x.value);
	} catch {
		// ignore
	}
}

function resetReportFilters() {
	reportsQuickFilter.value = "all";
	levelFilter.value = "全部";
	mergeFilter.value = "all";
	onlyCriticalWarnings.value = false;
	authorKeyword.value = "";
}

const displayReportItems = computed(() => {
	const pid = selectedProjectId.value;
	if (!pid) return [];

	const favSet = new Set<string>(reportPrefs.value.favorites?.[pid] || []);
	const pinList = reportPrefs.value.pinned?.[pid] || [];
	const pinOrder = new Map<string, number>(pinList.map((id, idx) => [id, idx]));
	const recentSet = new Set<string>((recentItems.value || []).map((x) => x.id));

	let items = [...reportItems.value];

	if (reportsQuickFilter.value === "favorites") {
		items = items.filter((r) => favSet.has(r.id));
	}
	if (reportsQuickFilter.value === "pinned") {
		items = items.filter((r) => pinOrder.has(r.id));
	}
	if (reportsQuickFilter.value === "recents") {
		items = items.filter((r) => recentSet.has(r.id));
	}

	items.sort((a, b) => {
		const aPinned = pinOrder.has(a.id);
		const bPinned = pinOrder.has(b.id);
		if (aPinned && bPinned) {
			return (pinOrder.get(a.id) || 0) - (pinOrder.get(b.id) || 0);
		}
		if (aPinned) return -1;
		if (bPinned) return 1;
		return (b.updatedAt || 0) - (a.updatedAt || 0);
	});
	return items;
});

const filteredReportsCount = computed(() => displayReportItems.value.length);

// 加载项目列表
async function loadProjects() {
	loadingProjects.value = true;
	try {
		const allProjects = await server.projects.getAllProjectsInfo.query();
		projects.value = allProjects.filter(p => p.isGitRepository);
	} catch (err: any) {
		showErrorMessage(`加载项目列表失败: ${err.message || String(err)}`);
	} finally {
		loadingProjects.value = false;
	}
}

// 加载分支列表
async function loadBranches() {
	if (!selectedProjectId.value) return;
	
	loadingBranches.value = true;
	try {
		const result = await server.git.branch.query({
			projectId: selectedProjectId.value,
			all: true,
		});
		
		if (result.success) {
			const lines = result.output
				.split('\n')
				.map(line => line.trim().replace(/^\*\s*/, ''))
				.filter(line => line.length > 0 && !line.includes('->'));

			const seen = new Set<string>();
			const opts: BranchOption[] = [];
			for (const b of lines) {
				const isRemote = b.startsWith('remotes/');
				const title = isRemote ? `远程 · ${b.replace(/^remotes\//, '')}` : `本地 · ${b}`;
				const value = b;
				if (seen.has(value)) continue;
				seen.add(value);
				opts.push({ title, value, kind: isRemote ? "remote" : "local" });
			}
			// 本地在前，远程在后
			opts.sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : (a.kind === "local" ? -1 : 1)));
			branches.value = opts;
		} else {
			throw new Error(result.error || '获取分支列表失败');
		}
	} catch (err: any) {
		showErrorMessage(`加载分支列表失败: ${err.message || String(err)}`);
	} finally {
		loadingBranches.value = false;
	}
}

function resetCommits() {
	commitItems.value = [];
	selectedCommits.value = [];
	commitsSkip.value = 0;
	commitsHasMore.value = true;
}

async function loadMoreCommits() {
	if (!selectedProjectId.value || !selectedBranch.value) return;
	if (loadingCommits.value || !commitsHasMore.value) return;
	loadingCommits.value = true;
	try {
		const authorStr = commitAuthorFilter.value?.trim() ? commitAuthorFilter.value.trim() : "";
		const result = await server.git.log.query({
			projectId: selectedProjectId.value,
			branch: selectedBranch.value,
			limit: commitsLimit,
			skip: commitsSkip.value,
			format: "json",
			search: commitSearch.value?.trim() ? commitSearch.value.trim() : undefined,
			author: authorStr ? authorStr : undefined,
		});

		if (result.success && "commits" in result) {
			const next = (result.commits || []) as CommitInfo[];
			commitItems.value = [...commitItems.value, ...next];
			commitsSkip.value += next.length;
			if (next.length < commitsLimit) {
				commitsHasMore.value = false;
			}
		} else {
			const err = ("error" in result && result.error) ? result.error : "获取 commit 列表失败";
			throw new Error(err);
		}
	} catch (err: any) {
		showErrorMessage(`加载 commit 列表失败: ${err.message || String(err)}`);
		commitsHasMore.value = false;
	} finally {
		loadingCommits.value = false;
	}
}

// 加载报告列表
function resetReports() {
	reportItems.value = [];
	reportsOffset.value = 0;
	reportsHasMore.value = true;
	reportsTotal.value = 0;
}

async function loadMoreReports() {
	if (!selectedProjectId.value) return;
	if (loadingReports.value || !reportsHasMore.value) return;

	loadingReports.value = true;
	try {
		const authorStr = authorKeyword.value?.trim() ? authorKeyword.value.trim() : "";
		const res = await server.reports.listReports.query({
			projectId: selectedProjectId.value,
			limit: reportsLimit,
			offset: reportsOffset.value,
			keyword: reportsKeyword.value?.trim() ? reportsKeyword.value.trim() : undefined,
			codeLevel: levelFilter.value !== "全部" ? levelFilter.value : undefined,
			mergeClass: mergeFilter.value !== "all" ? (mergeFilter.value as any) : undefined,
			onlyCriticalWarnings: onlyCriticalWarnings.value ? true : undefined,
			authorKeyword: authorStr ? authorStr : undefined,
		});

		const items = Array.isArray(res) ? (res as ReportInfo[]) : ((res as any).items as ReportInfo[]);
		const total = Array.isArray(res) ? undefined : (res as any).total;

		if (typeof total === "number") {
			reportsTotal.value = total;
		} else if (reportsOffset.value === 0) {
			// 兼容旧返回：无 total 时只展示已加载数
			reportsTotal.value = items.length;
		} else {
			reportsTotal.value = reportItems.value.length + items.length;
		}

		reportItems.value = [...reportItems.value, ...items];
		reportsOffset.value += items.length;
		if (items.length < reportsLimit) {
			reportsHasMore.value = false;
		}
	} catch (err: any) {
		console.error("加载报告列表失败:", err);
		reportsHasMore.value = false;
	} finally {
		loadingReports.value = false;
	}
}

// 切换分支
async function switchBranch() {
	if (!selectedProjectId.value || !selectedBranch.value) return;
	
	switchingBranch.value = true;
	try {
		const result = await server.git.checkout.mutate({
			projectId: selectedProjectId.value,
			branch: selectedBranch.value,
		});
		
		if (result.success) {
			showSuccessMessage(`成功切换到分支: ${selectedBranch.value}`);
			resetCommits();
			resetReports();
			await loadMoreReports();
			await loadMoreCommits();
		} else {
			throw new Error(result.error || '切换分支失败');
		}
	} catch (err: any) {
		showErrorMessage(`切换分支失败: ${err.message || String(err)}`);
	} finally {
		switchingBranch.value = false;
	}
}

// 批量生成报告
async function handleBatchGenerate() {
	if (!selectedProjectId.value || selectedCommits.value.length === 0) return;
	
	generatingReports.value = true;
	try {
		const result = await server.reports.batchGenerate.mutate({
			projectId: selectedProjectId.value,
			commitHashes: selectedCommits.value,
		});
		
		if (result.success) {
			showSuccessMessage(
				`批量生成完成: 成功 ${result.successCount} 个，失败 ${result.failCount} 个`
			);
			showBatchGenerateDialog.value = false;
			selectedCommits.value = [];
			resetReports();
			await loadMoreReports();
		} else {
			throw new Error('批量生成失败');
		}
	} catch (err: any) {
		showErrorMessage(`批量生成报告失败: ${err.message || String(err)}`);
	} finally {
		generatingReports.value = false;
	}
}

// 项目变更处理
async function handleProjectChange() {
	// 记住项目
	if (selectedProjectId.value) {
		savePersistedProjectId(selectedProjectId.value);
		persistedProjectId.value = selectedProjectId.value;
	}

	selectedBranch.value = "";
	branches.value = [];
	resetCommits();
	resetReports();
	selectedCommits.value = [];
	
	if (selectedProjectId.value) {
		await loadBranches();
		// 尝试恢复该项目的上次分支（如果还存在）
		const saved = getPersistedBranch(selectedProjectId.value);
		if (saved && branches.value.some((b) => b.value === saved)) {
			selectedBranch.value = saved;
		}
		await loadMoreReports();
		// 如果当前就在 commits 视图且恢复到了分支，顺手加载 commits
		if (activeView.value === "commits" && selectedBranch.value) {
			resetCommits();
			await loadMoreCommits();
		}
	}
}

// 分支变更处理
async function handleBranchChange() {
	resetCommits();
	selectedCommits.value = [];
	
	if (selectedBranch.value) {
		// 记住该项目的分支选择
		if (selectedProjectId.value) {
			savePersistedBranch(selectedProjectId.value, selectedBranch.value);
		}
		// 分支切换时更新作者候选
		loadCommitAuthors();
		await loadMoreCommits();
	}
}

async function loadData() {
	loading.value = true;
	try {
		await loadProjects();

		// 初次进入：如果当前未选择项目，则尝试恢复上次选择
		if (!selectedProjectId.value && persistedProjectId.value) {
			const ok = projects.value.some((p) => p.id === persistedProjectId.value);
			if (ok) {
				selectedProjectId.value = persistedProjectId.value;
			}
		}

		if (selectedProjectId.value) {
			await loadBranches();
			// 恢复该项目的分支（如果还存在）
			if (!selectedBranch.value) {
				const saved = getPersistedBranch(selectedProjectId.value);
				if (saved && branches.value.some((b) => b.value === saved)) {
					selectedBranch.value = saved;
				}
			}
			resetReports();
			await loadMoreReports();
			if (selectedBranch.value && activeView.value === "commits") {
				resetCommits();
				await loadMoreCommits();
			}
		}
	} finally {
		loading.value = false;
	}
}

// 检查commit是否有报告
function hasReport(commitHash: string): boolean {
	return reportItems.value.some(r => r.commitHash === commitHash);
}

// 获取报告的ID
function getReportId(commitHash: string): string | undefined {
	const report = reportItems.value.find(r => r.commitHash === commitHash);
	return report?.id;
}

// 获取commit的message
function getCommitMessage(commitHash: string): string {
	const commit = commitItems.value.find(c => c.hash === commitHash);
	return commit?.message || '';
}

// 格式化日期
function formatDate(dateString: string): string {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		return date.toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateString;
	}
}

function formatTs(ts: number): string {
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

function formatIso(iso?: string): string {
	if (!iso) return "";
	try {
		return new Date(iso).toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return iso;
	}
}

function extractTiebaLevel(text?: string): string | null {
	if (!text) return null;
	const m = text.match(/当前代码等级[:：]\s*([^\n\r，,]+)/);
	const raw = m?.[1]?.trim();
	if (!raw) return null;
	// 规范化到固定枚举
	if (raw.includes("有机肥")) return "有机肥";
	if (raw.includes("不可回收垃圾")) return "不可回收垃圾";
	if (raw.includes("可回收垃圾")) return "可回收垃圾";
	if (raw.includes("非垃圾")) return "非垃圾";
	return raw;
}

type CodeLevel = "有机肥" | "不可回收垃圾" | "可回收垃圾" | "非垃圾";
const CODE_LEVEL_ORDER: CodeLevel[] = ["有机肥", "不可回收垃圾", "可回收垃圾", "非垃圾"];

function getCodeLevelColor(level: string | null): string {
	// 低 -> 高: [有机肥，不可回收垃圾，可回收垃圾，非垃圾]
	switch (level) {
		case "有机肥":
			return "error";
		case "不可回收垃圾":
			return "warning";
		case "可回收垃圾":
			return "info";
		case "非垃圾":
			return "success";
		default:
			return "grey";
	}
}

function getCodeLevelRank(level: string | null): number | null {
	if (!level) return null;
	const idx = CODE_LEVEL_ORDER.indexOf(level as CodeLevel);
	return idx >= 0 ? idx : null;
}

function toggleReportExpand(id: string) {
	expandedReports.value = {
		...expandedReports.value,
		[id]: !expandedReports.value[id],
	};
}

async function copyToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		showSuccessMessage("已复制");
	} catch {
		// 兜底：尽量不打断操作
	}
}

const filteredCommitItems = computed(() => {
	let items = commitItems.value;
	if (onlyNoReport.value) {
		items = items.filter(c => !hasReport(c.hash));
	}
	return items;
});

function debouncedResetReports() {
	if (reportsDebounceTimer) window.clearTimeout(reportsDebounceTimer);
	reportsDebounceTimer = window.setTimeout(async () => {
		resetReports();
		await loadMoreReports();
	}, 250);
}

function debouncedResetCommits() {
	if (commitsDebounceTimer) window.clearTimeout(commitsDebounceTimer);
	commitsDebounceTimer = window.setTimeout(async () => {
		resetCommits();
		await loadMoreCommits();
	}, 250);
}

watch(commitAuthorFilter, async () => {
	if (authorDebounceTimer) window.clearTimeout(authorDebounceTimer);
	authorDebounceTimer = window.setTimeout(async () => {
		resetCommits();
		await loadMoreCommits();
	}, 250);
});

watch([levelFilter, mergeFilter, onlyCriticalWarnings, authorKeyword], async () => {
	if (backendReportsFilterTimer) window.clearTimeout(backendReportsFilterTimer);
	backendReportsFilterTimer = window.setTimeout(async () => {
		resetReports();
		await loadMoreReports();
	}, 250);
});

async function reloadCurrent() {
	if (!selectedProjectId.value) {
		await loadData();
		return;
	}
	if (activeView.value === "reports") {
		resetReports();
		await loadMoreReports();
		return;
	}
	resetCommits();
	await loadMoreCommits();
}

function setupInfiniteObservers() {
	if ("IntersectionObserver" in window) {
		reportsObserver = new IntersectionObserver((entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					loadMoreReports();
				}
			}
		}, { root: null, rootMargin: "300px 0px" });

		commitsObserver = new IntersectionObserver((entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					loadMoreCommits();
				}
			}
		}, { root: null, rootMargin: "300px 0px" });

		if (reportsSentinel.value) reportsObserver.observe(reportsSentinel.value);
		if (commitsSentinel.value) commitsObserver.observe(commitsSentinel.value);
	}
}

watch(activeView, async (v) => {
	// 切换到 commits 视图时，确保有分支并加载数据
	if (v === "commits" && selectedProjectId.value) {
		if (branches.value.length === 0) {
			await loadBranches();
		}
		if (selectedBranch.value) {
			// 预加载作者候选：保证下拉一打开就有内容
			loadCommitAuthors();
		}
		if (selectedBranch.value && commitItems.value.length === 0) {
			await loadMoreCommits();
		}
	}
});

// 显示错误消息
function showErrorMessage(message: string) {
	errorMessage.value = message;
	showError.value = true;
}

// 显示成功消息
function showSuccessMessage(message: string) {
	successMessage.value = message;
	showSuccess.value = true;
}

// 组件挂载时加载数据
onMounted(() => {
	loadData();
	setupInfiniteObservers();
});

onBeforeUnmount(() => {
	reportsObserver?.disconnect();
	commitsObserver?.disconnect();
	reportsObserver = null;
	commitsObserver = null;
	if (reportsDebounceTimer) window.clearTimeout(reportsDebounceTimer);
	if (commitsDebounceTimer) window.clearTimeout(commitsDebounceTimer);
	if (authorDebounceTimer) window.clearTimeout(authorDebounceTimer);
	if (backendReportsFilterTimer) window.clearTimeout(backendReportsFilterTimer);
});
</script>

<style scoped>
.reports-page {
	min-height: 100%;
	background: #ffffff;
}

.page-toolbar {
	position: sticky;
	top: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 16px;
	background: #fff;
	border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.toolbar-title {
	font-size: 18px;
	font-weight: 600;
	letter-spacing: 0.2px;
}

.page-body {
	display: flex;
	min-height: calc(100vh - 56px);
}

.side {
	width: 300px;
	flex: 0 0 300px;
	padding: 12px;
	border-right: 1px solid rgba(0, 0, 0, 0.12);
	background: #fff;
}

.side-section + .side-section {
	margin-top: 16px;
	padding-top: 16px;
	border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.side-section-title {
	font-size: 12px;
	opacity: 0.7;
	margin-bottom: 8px;
	letter-spacing: 0.6px;
	text-transform: uppercase;
}

.content {
	flex: 1 1 auto;
	padding: 12px;
	background: #fff;
}

.pane {
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 10px;
	overflow: hidden;
}

.pane-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 12px;
	border-bottom: 1px solid rgba(0, 0, 0, 0.12);
	background: #fff;
}

.pane-toolbar-sub {
	flex-wrap: wrap;
	gap: 10px;
}

.recents-panel {
	border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	padding: 10px 12px;
	background: #fff;
}

.recents-title {
	font-size: 12px;
	font-weight: 600;
	opacity: 0.75;
	margin-bottom: 8px;
}

.recents-chips {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
}

.lined-list {
	padding: 0;
}

.lined-item {
	border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.lined-item:last-child {
	border-bottom: none;
}

.hash {
	background: rgba(0, 0, 0, 0.04);
	padding: 2px 6px;
	border-radius: 6px;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-size: 12px;
}

.empty-state {
	padding: 16px 12px;
	color: rgba(0, 0, 0, 0.6);
}

.load-more-row {
	display: flex;
	justify-content: center;
	padding: 8px 12px;
	border-top: 1px solid rgba(0, 0, 0, 0.08);
	background: #fff;
}

.sentinel {
	height: 1px;
}

.muted-text {
	color: rgba(0, 0, 0, 0.6);
	font-size: 12px;
}

.dialog-sheet {
	background: #fff;
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 12px;
	overflow: hidden;
}

.dialog-title {
	display: flex;
	align-items: center;
	padding: 12px 14px;
	font-size: 16px;
	font-weight: 600;
}

.dialog-body {
	padding: 12px 14px;
}

.dialog-actions {
	display: flex;
	align-items: center;
	padding: 10px 14px;
}

.report-list {
	background: #fff;
	padding: 12px 12px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.report-row {
	padding: 12px 12px;
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.report-row:hover {
	box-shadow: 0 3px 10px rgba(0, 0, 0, 0.10);
	border-color: rgba(0, 0, 0, 0.18);
}

.report-row-main {
	display: flex;
	gap: 12px;
	align-items: flex-start;
	justify-content: space-between;
}

.report-row-left {
	min-width: 0;
	flex: 1 1 auto;
}

.report-title {
	font-weight: 600;
}

.report-meta {
	margin-top: 6px;
	font-size: 12px;
	color: rgba(0, 0, 0, 0.72);
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
}

.mono {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-size: 12px;
}

.dot {
	opacity: 0.5;
}

.report-chips {
	margin-top: 8px;
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.report-row-actions {
	flex: 0 0 auto;
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	justify-content: flex-end;
}

.report-row-actions :deep(.v-btn) {
	/* 让图标按钮更紧凑，减少视觉噪音 */
	min-width: 36px;
}

.report-row-preview {
	margin-top: 10px;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.preview-col {
	border: 1px dashed rgba(0, 0, 0, 0.14);
	border-radius: 10px;
	padding: 10px 10px;
	min-width: 0;
}

.preview-title {
	font-size: 12px;
	font-weight: 600;
	opacity: 0.75;
	margin-bottom: 6px;
}

.report-row-detail {
	margin-top: 10px;
	border-top: 1px solid rgba(0, 0, 0, 0.08);
	padding-top: 10px;
}

.detail-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.detail-block {
	min-width: 0;
}

.detail-md {
	margin: 0;
	padding: 10px 10px;
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 10px;
	background: rgba(0, 0, 0, 0.02);
	max-height: 320px;
	overflow: auto;
	font-size: 12px;
}

@media (max-width: 960px) {
	.report-row-preview {
		grid-template-columns: 1fr;
	}
	.detail-grid {
		grid-template-columns: 1fr;
	}
	.report-row-main {
		flex-direction: column;
	}
	.report-row-actions {
		justify-content: flex-start;
	}
}
</style>
