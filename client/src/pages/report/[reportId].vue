<template>
	<div class="report-workbench">
		<!-- 顶部工具栏 -->
		<div class="page-toolbar">
			<div class="d-flex align-center" style="gap: 10px; min-width: 0;">
				<v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" />
				<div class="toolbar-title">报告详情</div>
				<div class="muted-text" v-if="reportId" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
					· {{ reportId }}
				</div>
			</div>
			<v-spacer />
			<v-btn
				v-if="report?.commitHash"
				variant="text"
				color="primary"
				prepend-icon="mdi-source-branch"
				@click="copyToClipboard(report.commitHash)"
			>
				复制 commit
			</v-btn>
			<v-btn
				v-if="report?.id"
				variant="text"
				color="secondary"
				prepend-icon="mdi-file-document-outline"
				@click="copyToClipboard(report.id)"
			>
				复制报告ID
			</v-btn>
			<v-btn
				v-if="report?.fullReport"
				variant="text"
				color="teal"
				prepend-icon="mdi-content-copy"
				@click="copyToClipboard(report.fullReport)"
			>
				复制全文
			</v-btn>
		</div>

		<div class="workbench-body">
			<!-- 左侧目录 -->
			<div class="aside">
				<div class="toc-panel">
					<div class="toc-title">
						<v-icon icon="mdi-format-list-bulleted" size="small" class="mr-2" />
						目录
					</div>
					<v-divider />
					<div v-if="toc.length === 0" class="toc-empty muted-text">
						暂无可用目录（需要 Markdown 标题）
					</div>
					<v-list v-else density="compact" class="toc-list">
						<v-list-item
							v-for="item in toc"
							:key="item.id"
							:class="['toc-item', item.id === activeHeadingId ? 'toc-item-active' : '']"
							@click="scrollToHeading(item.id)"
						>
							<v-list-item-title
								:style="{ paddingLeft: `${Math.max(0, (item.level - 1) * 12)}px` }"
							>
								<v-icon
									v-if="getTocIcon(item.text)"
									:icon="getTocIcon(item.text)"
									size="x-small"
									class="mr-1"
								/>
								{{ item.text }}
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</div>
			</div>

			<!-- 左侧正文区 -->
			<div class="main">
				<!-- 加载/错误 -->
				<div v-if="loading" class="state">
					<v-progress-circular indeterminate color="primary" size="48" />
					<div class="muted-text mt-3">正在加载报告...</div>
				</div>
				<div v-else-if="error" class="state">
					<v-alert type="error" variant="tonal" :title="error" />
					<div v-if="reportId" class="muted-text mt-2">报告 ID：{{ reportId }}</div>
				</div>

				<!-- 内容 -->
				<div v-else-if="report" class="content-wrap">
					<!-- 基本信息（高信息密度） -->
					<div class="info-panel">
						<div class="info-title">
							<v-icon icon="mdi-information-outline" size="small" class="mr-2" />
							基本信息
						</div>
						<v-divider />
						<div class="info-grid">
							<div class="info-item">
								<div class="info-k">项目</div>
								<div class="info-v">
									<div class="d-flex align-center" style="gap: 8px; flex-wrap: wrap;">
										<v-chip size="small" color="primary" variant="outlined">{{ report.projectId }}</v-chip>
										<span class="muted-text" v-if="report.projectInfo?.name">{{ report.projectInfo.name }}</span>
										<span class="muted-text" v-if="report.projectInfo?.description">· {{ report.projectInfo.description }}</span>
									</div>
								</div>
							</div>
							<div class="info-item">
								<div class="info-k">commit</div>
								<div class="info-v mono">{{ report.commitHash }}</div>
							</div>
							<div class="info-item">
								<div class="info-k">创建</div>
								<div class="info-v">{{ formatTs(report.createdAt) }}</div>
							</div>
							<div class="info-item">
								<div class="info-k">更新</div>
								<div class="info-v">{{ formatTs(report.updatedAt) }}</div>
							</div>
							<div class="info-item" v-if="report.messageId">
								<div class="info-k">messageId</div>
								<div class="info-v mono">{{ report.messageId }}</div>
							</div>
							<div class="info-item">
								<div class="info-k">代码等级</div>
								<div class="info-v">
									<v-chip
										v-if="extractTiebaLevel(report.tiebaSummary || '')"
										size="small"
										:color="getCodeLevelColor(extractTiebaLevel(report.tiebaSummary || ''))"
										variant="tonal"
									>
										{{ extractTiebaLevel(report.tiebaSummary || '') }}
									</v-chip>
									<span v-else class="muted-text">（未识别）</span>
								</div>
							</div>
						</div>
					</div>

					<!-- 评分与建议（专项解析卡片） -->
					<div class="highlights-grid">
						<div class="highlight-card">
							<div class="highlight-title">
								<v-icon icon="mdi-chart-box-outline" size="small" class="mr-2" />
								综合评分
							</div>
							<v-divider />
							<div class="highlight-body">
								<div class="highlight-score">
									{{ highlights.overallScoreText || "—" }}
								</div>
							</div>
						</div>

						<div class="highlight-card">
							<div class="highlight-title">
								<v-icon icon="mdi-source-merge" size="small" class="mr-2" />
								合并建议
							</div>
							<v-divider />
							<div class="highlight-body">
								<v-chip
									v-if="highlights.mergeRecommendation"
									size="small"
									:color="highlights.mergeRecommendation.includes('修复') || highlights.mergeRecommendation.includes('不') ? 'warning' : 'success'"
									variant="tonal"
								>
									{{ highlights.mergeRecommendation }}
								</v-chip>
								<div v-else class="muted-text">（未识别）</div>
							</div>
						</div>

						<div v-if="highlights.criticalWarnings.length" class="highlight-card highlight-card-wide">
							<div class="highlight-title">
								<v-icon icon="mdi-alert-decagram-outline" size="small" class="mr-2" />
								重大BUG警告
							</div>
							<v-divider />
							<div class="highlight-body">
								<div class="priority-groups">
									<div
										v-for="w in highlights.criticalWarnings.slice(0, 2)"
										:key="w.title"
										class="priority-group priority-group-clickable"
										@click="scrollToHeadingByText(w.title)"
									>
										<div class="priority-title">
											<v-chip size="x-small" color="error" variant="tonal" class="mr-2">警告</v-chip>
											<span class="muted-text priority-title-text">{{ w.title }}</span>
											<v-spacer />
											<v-icon icon="mdi-chevron-right" size="small" class="priority-chevron" />
										</div>
										<div class="priority-body">
											<MarkdownRenderer :content="w.markdown || '（无）'" variant="preview" />
										</div>
									</div>
								</div>
							</div>
						</div>

						<div class="highlight-card highlight-card-wide">
							<div class="highlight-title">
								<v-icon icon="mdi-chart-timeline-variant" size="small" class="mr-2" />
								改进建议
							</div>
							<v-divider />
							<div class="highlight-body">
								<div v-if="highlights.priorityGroups.length" class="priority-groups">
									<div
										v-for="g in highlights.priorityGroups.slice(0, 2)"
										:key="g.key"
										class="priority-group priority-group-clickable"
										@click="scrollToHeadingByText(g.title)"
									>
										<div class="priority-title">
											<v-chip size="x-small" variant="outlined" class="mr-2">{{ g.key }}</v-chip>
											<span class="muted-text priority-title-text">{{ g.title }}</span>
											<v-spacer />
											<v-icon icon="mdi-chevron-right" size="small" class="priority-chevron" />
										</div>
										<div class="priority-body">
											<MarkdownRenderer :content="g.markdown || '（无）'" variant="preview" />
										</div>
									</div>
								</div>
								<div v-else class="muted-text">
									（未识别）
								</div>
							</div>
						</div>
					</div>

					<!-- 摘要区 -->
					<div class="summary-grid">
						<div class="summary-col">
							<div class="summary-title">Executive Summary</div>
							<v-divider />
							<div class="summary-body">
								<MarkdownRenderer :content="report.executiveSummary || '（无）'" variant="full" />
							</div>
						</div>
						<div class="summary-col">
							<div class="summary-title">Tieba Summary</div>
							<v-divider />
							<div class="summary-body">
								<MarkdownRenderer :content="report.tiebaSummary || '（无）'" variant="full" />
							</div>
						</div>
					</div>

					<!-- 正文 -->
					<div class="article-panel">
						<div class="article-title">
							<v-icon icon="mdi-file-document-outline" size="small" class="mr-2" />
							详细报告
						</div>
						<v-divider />
						<div class="article-body" ref="articleRef">
							<MarkdownRenderer :content="report.fullReport || ''" variant="full" />
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { server } from "../../server";
import MarkdownRenderer from "../../components/reports/MarkdownRenderer.vue";
import { extractTocFromMarkdown, type TocItem } from "../../components/reports/markdownUtils";
import { parseReviewHighlights } from "../../components/reports/reviewHighlights";

interface ReportData {
	id: string;
	projectId: string;
	commitHash: string;
	createdAt: number;
	updatedAt: number;
	executiveSummary?: string | null;
	tiebaSummary?: string | null;
	fullReport: string;
	messageId?: string | null;
	projectInfo?: {
		id?: string;
		name?: string;
		description?: string;
		createdAt?: string;
		updatedAt?: string;
		// 兼容后端 parseProjectInfo 可能返回更宽泛的对象
		[k: string]: any;
	} | null;
}

const route = useRoute();
const reportId = ref<string>(route.params.reportId as string);
const report = ref<ReportData | null>(null);
const loading = ref(true);
const error = ref("");
const articleRef = ref<HTMLElement | null>(null);

const toc = ref<TocItem[]>([]);
const activeHeadingId = ref<string>("");
let headingObserver: IntersectionObserver | null = null;

// 目录标题图标：基于“关键词/模式”的模糊检测
function normalizeTitle(raw: string): string {
	return raw
		.replace(/[：:]/g, "") // 去掉中英文冒号
		.replace(/【|】/g, "") // 去掉书名号
		.replace(/\s+/g, "") // 去掉空格
		.toLowerCase();
}

function getTocIcon(title: string): string | undefined {
	const raw = title || "";
	const norm = normalizeTitle(raw);

	// 1. Bug 列表（Bug 1 ~ Bug 5）
	const bugMatch = raw.match(/Bug\s*(\d+)/i);
	if (bugMatch) {
		const n = bugMatch[1];
		if (n === "1") return "mdi-numeric-1-circle-outline";
		if (n === "2") return "mdi-numeric-2-circle-outline";
		if (n === "3") return "mdi-numeric-3-circle-outline";
		if (n === "4") return "mdi-numeric-4-circle-outline";
		if (n === "5") return "mdi-numeric-5-circle-outline";
		return "mdi-bug-outline";
	}

	// 2. 优先级
	if (norm.includes("优先级p0")) return "mdi-alert-circle-outline";
	if (norm.includes("优先级p1")) return "mdi-alert-outline";
	if (norm.includes("优先级p2")) return "mdi-progress-clock";

	// 3. 严重/警告类
	if (norm.includes("重大bug警告")) return "mdi-alert-decagram-outline";
	if (norm.includes("shitbugwarning")) return "mdi-alert-decagram-outline";
	if (norm.includes("严重问题")) return "mdi-alert-octagon-outline";
	if (norm.includes("风险评估") || norm.includes("bug风险")) return "mdi-bug-outline";

	// 4. 分析类
	if (norm.includes("问题分析")) return "mdi-magnify-scan";

	// 5. 概要/摘要类
	if (norm.includes("执行摘要") || norm.includes("summary")) return "mdi-file-document-outline";

	// 6. 评估类
	if (norm.includes("可维护性评估")) return "mdi-wrench-outline";
	if (norm.includes("最佳实践评估")) return "mdi-lightbulb-on-outline";
	if (norm.includes("易读性评估")) return "mdi-format-font";

	// 7. 基本信息
	if (norm.includes("提交基本信息") || norm.includes("基本信息")) return "mdi-clipboard-text-outline";

	// 8. 建议/操作/时间
	if (norm.includes("改进建议")) return "mdi-chart-timeline-variant";
	if (norm.includes("建议操作")) return "mdi-gesture-tap-button";
	if (norm.includes("修复预计时间")) return "mdi-timer-sand";

	// 9. 结论/评分/优点
	if (norm.includes("代码优点")) return "mdi-star-outline";
	if (norm.includes("综合评分")) return "mdi-chart-box-outline";
	if (norm.includes("结论")) return "mdi-check-decagram-outline";

	// 10. 是否合并/理由
	if (norm.includes("是否需要修复再合并")) return "mdi-source-merge";
	if (norm === "理由" || norm.startsWith("理由")) return "mdi-comment-text-outline";

	// 11. 附录
	if (norm.startsWith("附录")) return "mdi-note-multiple-outline";

	return undefined;
}

const highlights = computed(() => {
	const full = report.value?.fullReport || "";
	return parseReviewHighlights(full);
});

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

async function copyToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// ignore
	}
}

function extractTiebaLevel(text?: string | null): string | null {
	if (!text) return null;
	const m = text.match(/当前代码等级[:：]\s*([^\n\r，,]+)/);
	const raw = m?.[1]?.trim();
	if (!raw) return null;
	if (raw.includes("有机肥")) return "有机肥";
	if (raw.includes("不可回收垃圾")) return "不可回收垃圾";
	if (raw.includes("可回收垃圾")) return "可回收垃圾";
	if (raw.includes("非垃圾")) return "非垃圾";
	return raw;
}

function getCodeLevelColor(level: string | null): string {
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

// 加载报告数据
async function loadReport() {
	if (!reportId.value) {
		error.value = "报告ID不能为空";
		loading.value = false;
		return;
	}

	loading.value = true;
	error.value = "";

	try {
		const data = await server.reports.getReport.query(reportId.value);
		report.value = data;
		toc.value = extractTocFromMarkdown((data as any).fullReport || "", 4);
	} catch (err: any) {
		error.value = `加载报告失败: ${err.message || String(err)}`;
		console.error("加载报告失败:", err);
		report.value = null;
	} finally {
		loading.value = false;
	}
}

function scrollToHeading(id: string) {
	const el = document.getElementById(id);
	if (!el) return;
	el.scrollIntoView({ behavior: "smooth", block: "start" });
	activeHeadingId.value = id;
}

function scrollToHeadingByText(title: string) {
	if (!articleRef.value) return;
	const targetNorm = normalizeTitle(title || "");
	if (!targetNorm) return;

	const headings = Array.from(
		articleRef.value.querySelectorAll<HTMLElement>(
			"h1.md-heading, h2.md-heading, h3.md-heading, h4.md-heading, h5.md-heading, h6.md-heading"
		)
	);
	const hit =
		headings.find((h) => normalizeTitle(h.textContent || "") === targetNorm) ||
		headings.find((h) => normalizeTitle(h.textContent || "").includes(targetNorm));
	if (!hit?.id) return;
	scrollToHeading(hit.id);
}

function applyHeadingIcons(headings: HTMLElement[]) {
	// 清理旧的图标，避免重复插入
	for (const h of headings) {
		const old = h.querySelector(".md-heading-icon");
		if (old && old.parentElement === h) {
			old.remove();
		}
		const title = h.textContent?.trim() ?? "";
		const icon = getTocIcon(title);
		if (!icon) continue;

		const i = document.createElement("i");
		// 使用 MDI 字体类名，Vuetify 默认会加载
		i.className = `md-heading-icon mdi ${icon}`;
		h.insertBefore(i, h.firstChild);
	}
}

async function setupHeadingObserver() {
	await nextTick();
	headingObserver?.disconnect();
	headingObserver = null;
	if (!articleRef.value) return;

	const headings = Array.from(
		articleRef.value.querySelectorAll<HTMLElement>(
			"h1.md-heading, h2.md-heading, h3.md-heading, h4.md-heading, h5.md-heading, h6.md-heading"
		)
	);
	if (headings.length === 0) return;

	// 先为正文标题加上图标
	applyHeadingIcons(headings);

	headingObserver = new IntersectionObserver(
		(entries) => {
			const visible = entries
				.filter((e) => e.isIntersecting)
				.map((e) => e.target as HTMLElement)
				.filter((el) => !!el.id);
			if (visible.length === 0) return;
			// 取最靠上的一个
			visible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
			activeHeadingId.value = visible[0].id;
		},
		{
			root: null,
			rootMargin: "-80px 0px -70% 0px",
			threshold: [0, 1],
		}
	);

	for (const h of headings) headingObserver.observe(h);
}

// 组件挂载时加载报告
onMounted(() => {
	loadReport();
});

// 监听路由参数变化，当 reportId 改变时重新加载
watch(
	() => route.params.reportId,
	(newId) => {
		if (newId && newId !== reportId.value) {
			reportId.value = newId as string;
			loadReport();
		}
	}
);

watch(
	() => report.value?.fullReport,
	() => {
		setupHeadingObserver();
	},
	{ flush: "post" }
);

onBeforeUnmount(() => {
	headingObserver?.disconnect();
	headingObserver = null;
});
</script>

<style scoped>
.report-workbench {
	min-height: 100%;
	background: #fff;
}

.page-toolbar {
	position: sticky;
	top: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 16px;
	background: #fff;
	border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.toolbar-title {
	font-size: 16px;
	font-weight: 600;
}

.muted-text {
	color: rgba(0, 0, 0, 0.6);
	font-size: 13px;
}

.mono {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-size: 13px;
}

.workbench-body {
	display: grid;
	grid-template-columns: 320px minmax(0, 1fr);
	gap: 12px;
	padding: 12px;
}

.main {
	min-width: 0;
}

.aside {
	min-width: 0;
}

.state {
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 12px;
	padding: 24px 16px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.content-wrap {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.highlights-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}

.highlight-card-wide {
	grid-column: 1 / -1;
}

.highlight-card {
	border: 1px solid rgba(0, 0, 0, 0.1);
	border-radius: 12px;
	overflow: hidden;
	background: #fff;
	min-width: 0;
	transition: none;
}

.highlight-title {
	display: flex;
	align-items: center;
	padding: 10px 12px;
	font-size: 13px;
	font-weight: 600;
}

.highlight-body {
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
}

.highlight-score {
	font-size: 24px;
	font-weight: 700;
	line-height: 1.1;
}

.priority-groups {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
}

.priority-title {
	display: flex;
	align-items: center;
	min-width: 0;
}

.priority-title-text {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.priority-chevron {
	opacity: 0.65;
	transition: transform 0.15s ease, opacity 0.15s ease;
}

.priority-group-clickable {
	cursor: pointer;
	border-radius: 10px;
	padding: 6px 8px;
	transition: background-color 0.15s ease;
}

.priority-group-clickable:hover {
	background: rgba(25, 118, 210, 0.06);
}

.priority-group-clickable:hover .priority-chevron {
	transform: translateX(2px);
	opacity: 1;
}

.priority-body {
	padding-left: 2px;
}

.priority-body :deep(.md-preview) {
	/* 只展示部分内容，但不做渐变遮罩 */
	max-height: 120px;
	overflow: hidden;
	position: relative;
}

.priority-body :deep(.md-preview::after) {
	display: none;
}

.info-panel,
.article-panel,
.toc-panel,
.summary-col {
	border: 1px solid rgba(0, 0, 0, 0.12);
	border-radius: 12px;
	overflow: hidden;
	background: #fff;
}

.info-title,
.article-title,
.toc-title,
.summary-title {
	display: flex;
	align-items: center;
	padding: 10px 12px;
	font-size: 13px;
	font-weight: 600;
}

.info-grid {
	padding: 10px 12px;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px 12px;
}

.info-item {
	min-width: 0;
}

.info-k {
	font-size: 12px;
	color: rgba(0, 0, 0, 0.6);
	margin-bottom: 4px;
}

.info-v {
	font-size: 13px;
	color: rgba(0, 0, 0, 0.82);
	word-break: break-word;
}

.summary-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.summary-body {
	padding: 10px 12px;
}

.article-body {
	padding: 12px 12px;
}

.article-body :deep(.md-heading) {
	display: flex;
	align-items: center;
}

.article-body :deep(.md-heading-icon) {
	margin-right: 6px;
	font-size: 0.9em;
}

.toc-panel {
	position: sticky;
	top: 64px;
	max-height: calc(100vh - 80px);
	overflow: auto;
}

.toc-empty {
	padding: 10px 12px;
}

.toc-item :deep(.v-list-item-title) {
	font-size: 13px;
	line-height: 1.4;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.toc-item-active {
	background: rgba(25, 118, 210, 0.08);
}

@media (max-width: 1100px) {
	.workbench-body {
		grid-template-columns: minmax(0, 1fr);
	}
	.toc-panel {
		position: static;
		max-height: none;
	}
	.summary-grid {
		grid-template-columns: 1fr;
	}
	.info-grid {
		grid-template-columns: 1fr;
	}
	.highlights-grid {
		grid-template-columns: 1fr;
	}
}
</style>

