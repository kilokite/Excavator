<template>
	<div
		ref="rootRef"
		class="md-root"
		:class="variant === 'preview' ? 'md-preview' : 'md-full'"
		v-html="renderedHtml"
	></div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { slugifyHeading, uniqueSlug } from "./markdownUtils";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

const props = withDefaults(
	defineProps<{
		content: string;
		variant?: "preview" | "full";
	}>(),
	{
		variant: "full",
	}
);

function escapeHtml(text: string) {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
}

let mermaidInited = false;
function ensureMermaid() {
	if (mermaidInited) return;
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "strict",
		theme: "default",
	});
	mermaidInited = true;
}

const md = new MarkdownIt({
	html: true,
	linkify: true,
	breaks: true,
	typographer: true,
	highlight: (str, lang) => {
		try {
			if (lang && hljs.getLanguage(lang)) {
				return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
			}
			// 没有语言或语言不支持时，尝试自动识别
			return hljs.highlightAuto(str).value;
		} catch {
			return escapeHtml(str);
		}
	},
});

// 给标题加 id，方便目录跳转
const defaultHeadingOpen =
	md.renderer.rules.heading_open ||
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
	const next = tokens[idx + 1];
	// heading_open 后一般是 inline token
	const title = next && next.type === "inline" ? (next.content || "") : "";
	const base = slugifyHeading(title);
	const id = uniqueSlug(env, base);
	tokens[idx].attrSet("id", id);
	tokens[idx].attrJoin("class", "md-heading");
	return defaultHeadingOpen(tokens, idx, options, env, self);
};

// 支持 ```mermaid``` 代码块：输出 <div class="mermaid">...</div>，由 mermaid.run() 负责渲染
const defaultFence =
	md.renderer.rules.fence ||
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.fence = (tokens, idx, options, _env, self) => {
	const token = tokens[idx];
	const info = (token.info || "").trim().toLowerCase();
	if (info === "mermaid") {
		return `<div class="mermaid">${escapeHtml(token.content)}</div>`;
	}
	return defaultFence(tokens, idx, options, _env, self);
};

// 将形如 "src/components/common/MainHeader.vue:235-240" 的文本渲染为可复制的小卡片
const fileRefRE = /[A-Za-z0-9_./-]+\.[A-Za-z0-9_]+:\d+(?:-\d+)?/g;

md.renderer.rules.text = (tokens, idx) => {
	const token = tokens[idx];
	const content = token.content || "";
	if (!fileRefRE.test(content)) {
		return escapeHtml(content);
	}

	fileRefRE.lastIndex = 0;
	let result = "";
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = fileRefRE.exec(content))) {
		const matchText = match[0];
		const start = match.index;
		if (start > lastIndex) {
			result += escapeHtml(content.slice(lastIndex, start));
		}
		const escaped = escapeHtml(matchText);
		result += `<span class="md-file-ref" data-copy="${escaped}">${escaped}</span>`;
		lastIndex = start + matchText.length;
	}

	if (lastIndex < content.length) {
		result += escapeHtml(content.slice(lastIndex));
	}

	return result;
};

const renderedHtml = computed(() => {
	// 每次 render 使用新的 env，保证 slug 计数从 1 开始且稳定
	const env: any = {};
	const raw = md.render(props.content || "", env);
	// 先清理一次：允许常见 markdown 生成的标签/属性
	return DOMPurify.sanitize(raw, {
		USE_PROFILES: { html: true },
	});
});

const rootRef = ref<HTMLElement | null>(null);
let disposed = false;
let clickHandler: ((e: MouseEvent) => void) | null = null;

async function renderMermaidDiagrams() {
	if (!rootRef.value) return;
	ensureMermaid();
	try {
		// mermaid v11 支持传 nodes 列表；只在当前容器内渲染，避免扫全局
		const nodes = Array.from(rootRef.value.querySelectorAll<HTMLElement>(".mermaid"));
		if (nodes.length === 0) return;
		await mermaid.run({ nodes });
	} catch {
		// 渲染失败时不阻塞页面
	}
}

async function rerender() {
	await nextTick();
	if (disposed) return;
	await renderMermaidDiagrams();
}

watch(
	() => props.content,
	() => {
		rerender();
	},
	{ immediate: true }
);

onMounted(() => {
	if (rootRef.value) {
		clickHandler = async (e: MouseEvent) => {
			const target = (e.target as HTMLElement | null)?.closest(".md-file-ref") as HTMLElement | null;
			if (!target) return;
			const text = target.dataset.copy || target.textContent || "";
			if (!text) return;
			// 无论复制结果如何，先触发动画反馈
			target.classList.add("md-file-ref-copied");
			setTimeout(() => target.classList.remove("md-file-ref-copied"), 800);
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				// 忽略复制失败，不打断正常阅读
			}
		};
		rootRef.value.addEventListener("click", clickHandler);
	}
	rerender();
});

onBeforeUnmount(() => {
	disposed = true;
	if (rootRef.value && clickHandler) {
		rootRef.value.removeEventListener("click", clickHandler);
	}
	clickHandler = null;
});
</script>

<style scoped>
.md-root {
	color: rgba(0, 0, 0, 0.78);
	font-size: 14px;
	line-height: 1.75;
	word-break: break-word;
}

.md-preview {
	max-height: 120px;
	overflow: hidden;
	position: relative;
}

.md-preview::after {
	content: "";
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 36px;
	background: linear-gradient(to bottom, rgba(255, 255, 255, 0), #fff);
	pointer-events: none;
}

.md-root :deep(p) {
	margin: 0 0 8px 0;
}

.md-root :deep(ul),
.md-root :deep(ol) {
	margin: 0 0 8px 0;
	padding-left: 18px;
}

.md-root :deep(li) {
	margin: 2px 0;
}

.md-root :deep(code) {
	background: rgba(0, 0, 0, 0.04);
	padding: 2px 6px;
	border-radius: 6px;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-size: 13px;
}

.md-root :deep(pre) {
	margin: 0 0 10px 0;
	padding: 10px;
	border-radius: 10px;
	background: rgba(0, 0, 0, 0.03);
	overflow: auto;
	border: 1px solid rgba(0, 0, 0, 0.12);
}

.md-root :deep(pre code) {
	background: transparent;
	padding: 0;
	display: block;
}

.md-root :deep(blockquote) {
	margin: 0 0 10px 0;
	padding: 8px 10px;
	border-left: 3px solid rgba(0, 0, 0, 0.18);
	background: rgba(0, 0, 0, 0.02);
	border-radius: 8px;
}

/* 表格：高信息密度 + 横向可滚动 */
.md-root :deep(table) {
	width: 100%;
	border-collapse: collapse;
	margin: 8px 0 12px 0;
	display: block;
	overflow-x: auto;
}

.md-root :deep(thead) {
	background: rgba(0, 0, 0, 0.03);
}

.md-root :deep(th),
.md-root :deep(td) {
	border: 1px solid rgba(0, 0, 0, 0.12);
	padding: 6px 8px;
	text-align: left;
	vertical-align: top;
	white-space: nowrap;
}

.md-root :deep(tbody tr:nth-child(even) td) {
	background: rgba(0, 0, 0, 0.015);
}

.md-root :deep(hr) {
	border: none;
	border-top: 1px solid rgba(0, 0, 0, 0.12);
	margin: 12px 0;
}

.md-root :deep(img) {
	max-width: 100%;
	height: auto;
	border-radius: 10px;
	border: 1px solid rgba(0, 0, 0, 0.08);
}

.md-root :deep(a) {
	color: #1976d2;
	text-decoration: none;
}

.md-root :deep(a:hover) {
	text-decoration: underline;
}

.md-root :deep(.mermaid) {
	display: block;
	overflow-x: auto;
	padding: 8px 8px;
	border-radius: 10px;
	border: 1px dashed rgba(0, 0, 0, 0.14);
	background: rgba(0, 0, 0, 0.01);
}

.md-root :deep(svg) {
	max-width: 100%;
	height: auto;
}

.md-root :deep(.md-file-ref) {
	display: inline-flex;
	align-items: center;
	padding: 1px 6px;
	margin: 0 2px;
	border-radius: 8px;
	border: 1px solid rgba(25, 118, 210, 0.3);
	background: rgba(25, 118, 210, 0.04);
	font-size: 12px;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	color: #1565c0;
	cursor: pointer;
	white-space: nowrap;
	transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.md-root :deep(.md-file-ref:hover) {
	background: rgba(25, 118, 210, 0.08);
}

.md-root :deep(.md-file-ref-copied) {
	border-color: rgba(46, 125, 50, 0.6);
	background: rgba(46, 125, 50, 0.06);
	color: #2e7d32;
	animation: md-file-ref-pop 0.25s cubic-bezier(0.63, 1.24, 0, 1.68);
}

@keyframes md-file-ref-pop {
	0% {
		transform: scale(1);
	}
	60% {
		transform: scale(1.05);
	}
	100% {
		transform: scale(1);
	}
}
</style>

