import MarkdownIt from "markdown-it";

export type TocItem = {
  id: string;
  text: string;
  level: number; // 1..6
};

export function slugifyHeading(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    // 保留 unicode 字母/数字/连字符，其余移除
    .replace(/[^\p{L}\p{N}-]+/gu, "");
  return base ? `h-${base}` : "h-section";
}

export function uniqueSlug(env: any, base: string): string {
  const key = "__slugCounts";
  if (!env[key]) env[key] = {};
  const counts: Record<string, number> = env[key];
  const n = (counts[base] ?? 0) + 1;
  counts[base] = n;
  return n === 1 ? base : `${base}-${n}`;
}

export function createMarkdownItForToc(): MarkdownIt {
  return new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    typographer: true,
  });
}

export function extractTocFromMarkdown(markdown: string, maxLevel = 4): TocItem[] {
  const md = createMarkdownItForToc();
  const env: any = {};
  const tokens = md.parse(markdown || "", env);

  const inlineToText = (inlineToken: any): string => {
    const children = inlineToken?.children as any[] | undefined;
    if (!children || children.length === 0) {
      return String(inlineToken?.content || "").trim();
    }
    let out = "";
    for (const c of children) {
      // 只取“可见文本”，忽略 strong/em 等标记本身
      if (c.type === "text" || c.type === "code_inline") {
        out += c.content || "";
      } else if (c.type === "softbreak" || c.type === "hardbreak") {
        out += " ";
      }
    }
    return out.replace(/\s+/g, " ").trim();
  };

  const toc: TocItem[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "heading_open") continue;
    const level = Number(String(t.tag || "").replace("h", ""));
    if (!level || level < 1 || level > 6) continue;
    if (level > maxLevel) continue;

    const inline = tokens[i + 1];
    const text = inline && inline.type === "inline" ? inlineToText(inline) : "";
    const base = slugifyHeading(text);
    const id = uniqueSlug(env, base);
    if (!text) continue;

    toc.push({ id, text, level });
  }

  return toc;
}

