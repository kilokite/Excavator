import { truncateText } from './textTools.js';

/**
 * 从审查报告中提取特定部分
 * 提取"提交基本信息"和"执行摘要"两个部分
 */
export function extractReportSections(fullReport: string): {
    commitInfo: string;
    executiveSummary: string;
} {
    let commitInfo = '';
    let executiveSummary = '';
    
    // 匹配"提交基本信息"部分
    // 更宽松的规则：
    // - 标题前可以有 1~6 个 #，以及可选空格
    // - 支持 "提交基本信息" / "提交信息" 以及后面可选的标点（: ： - —— 等）
    // - 从标题下一行开始，一直到下一个任意 Markdown 标题（# 开头）或文件结尾
    const commitInfoRegex =
        /(?:^|\n)#{1,6}\s*(?:提交基本信息|提交信息)[：:—\-]?\s*\n+([\s\S]*?)(?=\n+#{1,6}\s+|$)/i;
    const commitInfoMatch = fullReport.match(commitInfoRegex);
    
    if (commitInfoMatch && commitInfoMatch[1]) {
        commitInfo = commitInfoMatch[1].trim();
        // 移除可能存在的后续标题
        commitInfo = commitInfo.replace(/\n+##?\s+.*$/, '').trim();
    }
    
    // 匹配"执行摘要"部分
    // 更宽松的规则：
    // - 标题前可以有 1~6 个 #，以及可选空格
    // - 支持标题后带常见标点
    // - 从标题下一行开始，一直到下一个任意 Markdown 标题或文件结尾
    const summaryRegex =
        /(?:^|\n)#{1,6}\s*执行摘要[：:—\-]?\s*\n+([\s\S]*?)(?=\n+#{1,6}\s+|$)/i;
    const summaryMatch = fullReport.match(summaryRegex);
    
    if (summaryMatch && summaryMatch[1]) {
        executiveSummary = summaryMatch[1].trim();
        // 移除可能存在的后续标题
        executiveSummary = executiveSummary.replace(/\n+##?\s+.*$/, '').trim();
    }
    
    // 如果没找到标准格式，尝试更宽松的匹配
    if (!commitInfo) {
        // 尝试匹配"提交哈希"、"提交信息"等关键词附近的内容
        const hashMatch = fullReport.match(/(?:^|\n)[-*]\s*提交哈希[:\s]+([^\n]+)/i);
        const messageMatch = fullReport.match(/(?:^|\n)[-*]\s*提交信息[:\s]+([^\n]+)/i);
        const authorMatch = fullReport.match(/(?:^|\n)[-*]\s*作者[:\s]+([^\n]+)/i);
        const dateMatch = fullReport.match(/(?:^|\n)[-*]\s*提交日期[:\s]+([^\n]+)/i);
        
        // 匹配修改文件部分（可能跨多行）
        const filesRegex = /(?:^|\n)[-*]\s*修改文件[^:]*:?\s*\n([\s\S]*?)(?=\n##?\s*(?:执行摘要|可维护性)|$)/i;
        const filesMatch = fullReport.match(filesRegex);
        
        if (hashMatch || messageMatch || authorMatch || dateMatch || filesMatch) {
            const parts: string[] = [];
            if (hashMatch) parts.push(`- 提交哈希: ${hashMatch[1].trim()}`);
            if (messageMatch) parts.push(`- 提交信息: ${messageMatch[1].trim()}`);
            if (authorMatch) parts.push(`- 作者: ${authorMatch[1].trim()}`);
            if (dateMatch) parts.push(`- 提交日期: ${dateMatch[1].trim()}`);
            if (filesMatch && filesMatch[1]) {
                const filesText = filesMatch[1].trim();
                if (filesText) {
                    parts.push(`- 修改文件及行数:\n${filesText}`);
                }
            }
            commitInfo = parts.join('\n');
        }
    }
    
    // 如果还是没找到执行摘要，尝试更宽松的匹配
    if (!executiveSummary) {
        const summaryText = fullReport.match(
            /(?:^|\n)(?:##?\s*)?执行摘要[:\s]*\n?([\s\S]*?)(?=\n##?\s*(?:可维护性|最佳实践|易读性|潜在|改进|代码优点|评分|结论)|$)/i
        );
        if (summaryText && summaryText[1]) {
            executiveSummary = summaryText[1].trim();
        }
    }
    
    // 清理多余的空行
    commitInfo = commitInfo.replace(/\n{3,}/g, '\n\n').trim();
    executiveSummary = executiveSummary.replace(/\n{3,}/g, '\n\n').trim();
    
    // 截断内容，避免过长
    const maxCommitInfoLength = 1000;
    const maxSummaryLength = 1500;
    
    if (commitInfo.length > maxCommitInfoLength) {
        commitInfo = truncateText(commitInfo, maxCommitInfoLength);
    }
    
    if (executiveSummary.length > maxSummaryLength) {
        executiveSummary = truncateText(executiveSummary, maxSummaryLength);
    }
    
    return {
        commitInfo: commitInfo || '',
        executiveSummary: executiveSummary || '',
    };
}

