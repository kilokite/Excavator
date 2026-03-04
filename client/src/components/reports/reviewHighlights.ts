export type PriorityGroup = {
	key: string; // e.g. "P0" | "P1" | "P2" | "P3" | "优先级1"
	title: string; // full heading line content (no #)
	markdown: string; // content under this group
};

export type ReviewHighlights = {
	overallScoreText?: string; // e.g. "5.75/10"
	overallScoreValue?: number; // e.g. 5.75
	mergeRecommendation?: string; // e.g. "需要修复后再合并"
	improvementsSectionMarkdown?: string; // the whole "改进建议" section markdown
	priorityGroups: PriorityGroup[];
	criticalWarnings: PriorityGroup[]; // "重大BUG警告"/"SHITBUGWARNING" 等
};

function normalize(s: string): string {
	return (s || "")
		.replace(/[：:]/g, "")
		.replace(/【|】/g, "")
		.replace(/\s+/g, "")
		.toLowerCase();
}

type Heading = {
	level: number; // 1..6
	title: string; // raw title text
	start: number; // heading line start index
	endLine: number; // heading line end index (exclusive)
};

function parseHeadings(md: string): Heading[] {
	const out: Heading[] = [];
	const re = /^(#{1,6})\s+(.+?)\s*$/gm;
	let m: RegExpExecArray | null;
	while ((m = re.exec(md))) {
		const hashes = m[1] || "";
		const title = (m[2] || "").trim();
		out.push({
			level: hashes.length,
			title,
			start: m.index,
			endLine: m.index + m[0].length,
		});
	}
	return out;
}

function extractSectionByHeading(md: string, headingTitles: string[]): { heading?: Heading; content?: string } {
	const titlesNorm = headingTitles.map(normalize);
	const headings = parseHeadings(md);
	const idx = headings.findIndex((h) => titlesNorm.includes(normalize(h.title)));
	if (idx < 0) return {};
	const h = headings[idx];
	let nextStart = md.length;
	for (let i = idx + 1; i < headings.length; i++) {
		// 遇到同级或更高层级（数值更小/相等）的标题，结束本段
		if (headings[i].level <= h.level) {
			nextStart = headings[i].start;
			break;
		}
	}
	const content = md.slice(h.endLine, nextStart).replace(/^\s*\n+/, "").replace(/\s+$/, "");
	return { heading: h, content };
}

function parseOverallScore(md: string): { text?: string; value?: number } {
	// 兼容：
	// - "### 综合评分: **5.75/10**"
	// - "综合评分: 8/10"
	const re = /综合评分\s*[:：]?\s*(?:\*\*)?\s*(\d+(?:\.\d+)?)\s*\/\s*10\s*(?:\*\*)?/i;
	const m = md.match(re);
	if (!m) return {};
	const value = Number(m[1]);
	if (!Number.isFinite(value)) return {};
	return { value, text: `${m[1]}/10` };
}

function parseMergeRecommendation(md: string): string | undefined {
	// 优先从“结论”段落里找“建议: ...”
	const conclusion = extractSectionByHeading(md, ["结论"]);
	const haystack = conclusion.content || md;
	const m =
		haystack.match(/建议\s*[:：]\s*(?:\*\*)?\s*([^\n\r*]+?)\s*(?:\*\*)?\s*$/im) ||
		haystack.match(/(需要修复后再合并|可以直接合并|建议合并|不建议合并|拒绝合并)/i);
	return m?.[1]?.trim();
}

function parsePriorityGroups(improvementsMd: string): PriorityGroup[] {
	const groups: PriorityGroup[] = [];
	if (!improvementsMd) return groups;

	// 支持：
	// - "### 优先级 P0 (必须立即修复)"
	// - "### 优先级1 - 必须立即修复"
	const headings = parseHeadings(improvementsMd);
	for (let idx = 0; idx < headings.length; idx++) {
		const h = headings[idx];
		const t = h.title;
		const m =
			t.match(/优先级\s*P?\s*(\d+)\b/i) ||
			t.match(/P\s*(\d+)\b/i);
		if (!m) continue;

		const n = m[1];
		const key = t.match(/优先级\s*P/i) ? `P${n}` : `优先级${n}`;

		let nextStart = improvementsMd.length;
		for (let j = idx + 1; j < headings.length; j++) {
			if (headings[j].level <= h.level) {
				nextStart = headings[j].start;
				break;
			}
		}
		const content = improvementsMd.slice(h.endLine, nextStart).replace(/^\s*\n+/, "").replace(/\s+$/, "");
		groups.push({ key, title: t, markdown: content });
	}

	// 如果没找到“优先级”小节，尝试把整段当成一个组
	if (groups.length === 0) {
		groups.push({
			key: "改进建议",
			title: "改进建议",
			markdown: improvementsMd.trim(),
		});
	}
	return groups;
}

function parseCriticalWarnings(md: string): PriorityGroup[] {
	const safe = md || "";
	const headings = parseHeadings(safe);
	const hits = headings.filter((h) => {
		const t = normalize(h.title);
		return t.includes("重大bug警告") || t.includes("shitbugwarning");
	});

	const out: PriorityGroup[] = [];
	for (const h of hits) {
		let nextStart = safe.length;
		for (const n of headings) {
			if (n.start <= h.start) continue;
			if (n.level <= h.level) {
				nextStart = n.start;
				break;
			}
		}
		const content = safe.slice(h.endLine, nextStart).replace(/^\s*\n+/, "").replace(/\s+$/, "");
		out.push({
			key: "重大BUG警告",
			title: h.title,
			markdown: content,
		});
	}
	return out;
}

export function parseReviewHighlights(md: string): ReviewHighlights {
	const safe = md || "";
	const score = parseOverallScore(safe);
	const mergeRecommendation = parseMergeRecommendation(safe);
	const improvements = extractSectionByHeading(safe, ["改进建议"]);
	const improvementsSectionMarkdown = improvements.content;

	return {
		overallScoreText: score.text,
		overallScoreValue: score.value,
		mergeRecommendation,
		improvementsSectionMarkdown,
		priorityGroups: parsePriorityGroups(improvementsSectionMarkdown || ""),
		criticalWarnings: parseCriticalWarnings(safe),
	};
}

