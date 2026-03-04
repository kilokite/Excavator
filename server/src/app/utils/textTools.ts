/**
 * 截断文本到指定长度，超出部分追加提示
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '\n\n...(内容过长，已截断)';
}

/**
 * 检测文本是否包含 Markdown 格式
 * 检测常见的 Markdown 语法：标题、加粗、斜体、链接、列表、代码块、引用等
 */
export function containsMarkdown(text: string): boolean {
    if (!text || text.trim().length === 0) {
        return false;
    }

    // Markdown 常见模式
    const markdownPatterns = [
        /^#{1,6}\s+.+$/m,                    // 标题 (# ## ###)
        /\*\*.*?\*\*/,                       // 加粗 **text**
        /\*.*?\*/,                           // 斜体 *text* (但排除 **)
        /__.*?__/,                           // 加粗 __text__
        /_.*?_/,                             // 斜体 _text_ (但排除 __)
        /\[.*?\]\(.*?\)/,                    // 链接 [text](url)
        /^[-*+]\s+.+$/m,                     // 无序列表
        /^\d+\.\s+.+$/m,                     // 有序列表
        /^```[\s\S]*?```$/m,                 // 代码块 ```
        /^`.*?`$/m,                          // 行内代码 `code`
        /^>\s+.+$/m,                         // 引用 >
        /<text_tag[^>]*>.*?<\/text_tag>/i,   // text_tag
        /^###\s+.+$/m,                       // 三级标题
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
}