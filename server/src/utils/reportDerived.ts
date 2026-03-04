import { parseReviewHighlightsLite } from "./reviewHighlights.js";

export type MergeClass = "needFix" | "canMerge" | "noMerge" | "unknown";

export type ReportDerived = {
  codeLevel: string | null;
  mergeRecommendation: string | null;
  mergeClass: MergeClass;
  criticalWarningsCount: number;
  overallScoreValue: number | null;
  overallScoreText: string | null;
};

export function extractTiebaLevel(text?: string | null): string | null {
  if (!text) return null;
  const m = String(text).match(/当前代码等级[:：]\s*([^\n\r，,]+)/);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  if (raw.includes("有机肥")) return "有机肥";
  if (raw.includes("不可回收垃圾")) return "不可回收垃圾";
  if (raw.includes("可回收垃圾")) return "可回收垃圾";
  if (raw.includes("非垃圾")) return "非垃圾";
  return raw;
}

export function classifyMerge(rec?: string | null | undefined): MergeClass {
  const s = String(rec || "");
  if (!s) return "unknown";
  if (s.includes("修复")) return "needFix";
  if (s.includes("可以") || s.includes("建议合并") || s.includes("直接合并")) return "canMerge";
  if (s.includes("不建议") || s.includes("拒绝")) return "noMerge";
  return "unknown";
}

export function computeReportDerived(input: { tiebaSummary?: string | null; fullReport: string }): ReportDerived {
  const codeLevel = extractTiebaLevel(input.tiebaSummary || "");
  const hl = parseReviewHighlightsLite(input.fullReport || "");
  const mergeRecommendation = hl.mergeRecommendation || null;
  const mergeClass = classifyMerge(mergeRecommendation);
  const criticalWarningsCount = Number(hl.criticalWarningsCount || 0);
  const overallScoreValue = typeof hl.overallScoreValue === "number" ? hl.overallScoreValue : null;
  const overallScoreText = hl.overallScoreText || null;
  return {
    codeLevel,
    mergeRecommendation,
    mergeClass,
    criticalWarningsCount,
    overallScoreValue,
    overallScoreText,
  };
}

