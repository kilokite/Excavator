export type ReviewHighlightsLite = {
  overallScoreText?: string; // e.g. "5.75/10"
  overallScoreValue?: number; // e.g. 5.75
  mergeRecommendation?: string; // e.g. "需要修复后再合并"
  criticalWarningsCount: number;
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
    if (headings[i].level <= h.level) {
      nextStart = headings[i].start;
      break;
    }
  }
  const content = md.slice(h.endLine, nextStart).replace(/^\s*\n+/, "").replace(/\s+$/, "");
  return { heading: h, content };
}

function parseOverallScore(md: string): { text?: string; value?: number } {
  const re = /综合评分\s*[:：]?\s*(?:\*\*)?\s*(\d+(?:\.\d+)?)\s*\/\s*10\s*(?:\*\*)?/i;
  const m = md.match(re);
  if (!m) return {};
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return {};
  return { value, text: `${m[1]}/10` };
}

function parseMergeRecommendation(md: string): string | undefined {
  const conclusion = extractSectionByHeading(md, ["结论"]);
  const haystack = conclusion.content || md;
  const m =
    haystack.match(/建议\s*[:：]\s*(?:\*\*)?\s*([^\n\r*]+?)\s*(?:\*\*)?\s*$/im) ||
    haystack.match(/(需要修复后再合并|可以直接合并|建议合并|不建议合并|拒绝合并)/i);
  return m?.[1]?.trim();
}

function countCriticalWarnings(md: string): number {
  const safe = md || "";
  const headings = parseHeadings(safe);
  return headings.filter((h) => {
    const t = normalize(h.title);
    return t.includes("重大bug警告") || t.includes("shitbugwarning");
  }).length;
}

export function parseReviewHighlightsLite(md: string): ReviewHighlightsLite {
  const safe = md || "";
  const score = parseOverallScore(safe);
  const mergeRecommendation = parseMergeRecommendation(safe);
  const criticalWarningsCount = countCriticalWarnings(safe);
  return {
    overallScoreText: score.text,
    overallScoreValue: score.value,
    mergeRecommendation,
    criticalWarningsCount,
  };
}

