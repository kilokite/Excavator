import { getCommandContext } from '../commandContext.js';
import { addMessageToHistory } from '../../utils/conversationHistory.js';
import {
    getReportById,
    getReportByCommit,
    getReportsByProject,
    getAllReports,
    parseProjectInfo,
    type ReportRecord,
} from '../../../utils/reportDbService.js';

/**
 * 统一回复工具（同时写入对话记忆）
 */
async function reply(text: string): Promise<void> {
    const ctx = getCommandContext();
    await ctx.replyText(text);
    const chatId = ctx.rawEvent?.message?.chat_id;
    if (chatId) addMessageToHistory(chatId, 'assistant', text);
}

/**
 * 格式化报告信息（用于命令输出）
 */
function formatReport(report: ReportRecord): string {
    const lines: string[] = [];
    
    lines.push(`**报告 ID**: ${report.id}`);
    lines.push(`**项目**: ${report.projectId}`);
    lines.push(`**提交哈希**: ${report.commitHash}`);
    lines.push(`**创建时间**: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
    lines.push(`**更新时间**: ${new Date(report.updatedAt).toLocaleString('zh-CN')}`);
    
    if (report.executiveSummary) {
        lines.push(`\n**执行摘要**:\n${report.executiveSummary}`);
    }
    
    if (report.tiebaSummary) {
        lines.push(`\n**贴吧老哥总结**:\n${report.tiebaSummary}`);
    }
    
    const projectInfo = parseProjectInfo(report.projectInfo);
    if (projectInfo) {
        lines.push(`\n**项目信息**:`);
        if ((projectInfo as any).name) {
            lines.push(`- 名称: ${(projectInfo as any).name}`);
        }
        if ((projectInfo as any).description) {
            lines.push(`- 描述: ${(projectInfo as any).description}`);
        }
        if ((projectInfo as any).gitRemote) {
            lines.push(`- Git远程: ${(projectInfo as any).gitRemote}`);
        }
    }
    
    // 完整报告（截断显示，避免消息过长）
    const maxReportLength = 3000;
    if (report.fullReport.length > maxReportLength) {
        lines.push(`\n**完整报告** (前${maxReportLength}字符):\n${report.fullReport.substring(0, maxReportLength)}...`);
        lines.push(`\n(报告总长度: ${report.fullReport.length} 字符，使用 report-full 命令获取完整内容)`);
    } else {
        lines.push(`\n**完整报告**:\n${report.fullReport}`);
    }
    
    return lines.join('\n');
}

/**
 * 根据报告ID获取报告
 */
export async function handleReportGet(reportId: string): Promise<void> {
    console.log(`执行 report get 指令: reportId=${reportId}`);
    try {
        const report = getReportById(reportId);
        
        if (!report) {
            await reply(`❌ 未找到报告 ID: ${reportId}`);
            return;
        }
        
        await reply(formatReport(report));
    } catch (error) {
        await reply(`❌ 查询报告失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 根据项目和提交哈希获取报告
 */
export async function handleReportGetByCommit(
    projectId: string,
    commitHash: string
): Promise<void> {
    console.log(`执行 report get-by-commit 指令: projectId=${projectId}, commitHash=${commitHash}`);
    try {
        const report = getReportByCommit(projectId, commitHash);
        
        if (!report) {
            await reply(`❌ 未找到项目 ${projectId} 提交 ${commitHash.substring(0, 8)} 的报告`);
            return;
        }
        
        await reply(formatReport(report));
    } catch (error) {
        await reply(`❌ 查询报告失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 获取项目的所有报告列表
 */
export async function handleReportList(projectId: string, limit?: number): Promise<void> {
    console.log(`执行 report list 指令: projectId=${projectId}, limit=${limit}`);
    try {
        const reports = getReportsByProject(projectId, limit);
        
        if (reports.length === 0) {
            await reply(`项目 ${projectId} 没有审查报告`);
            return;
        }
        
        const lines: string[] = [];
        lines.push(`项目 ${projectId} 共有 ${reports.length} 条审查报告:\n`);
        
        reports.forEach((report, index) => {
            lines.push(`${index + 1}. **报告 ID**: ${report.id}`);
            lines.push(`   - 提交哈希: ${report.commitHash.substring(0, 8)}`);
            lines.push(`   - 创建时间: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
            if (report.executiveSummary) {
                const summary = report.executiveSummary.length > 150
                    ? report.executiveSummary.substring(0, 150) + '...'
                    : report.executiveSummary;
                lines.push(`   - 执行摘要: ${summary}`);
            }
            lines.push('');
        });
        
        await reply(lines.join('\n'));
    } catch (error) {
        await reply(`❌ 查询项目报告失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 获取所有报告列表
 */
export async function handleReportListAll(limit?: number): Promise<void> {
    console.log(`执行 report list-all 指令: limit=${limit}`);
    try {
        const reports = getAllReports(limit);
        
        if (reports.length === 0) {
            await reply('当前没有审查报告');
            return;
        }
        
        const lines: string[] = [];
        lines.push(`共有 ${reports.length} 条审查报告:\n`);
        
        reports.forEach((report, index) => {
            lines.push(`${index + 1}. **报告 ID**: ${report.id}`);
            lines.push(`   - 项目: ${report.projectId}`);
            lines.push(`   - 提交哈希: ${report.commitHash.substring(0, 8)}`);
            lines.push(`   - 创建时间: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
            if (report.executiveSummary) {
                const summary = report.executiveSummary.length > 150
                    ? report.executiveSummary.substring(0, 150) + '...'
                    : report.executiveSummary;
                lines.push(`   - 执行摘要: ${summary}`);
            }
            lines.push('');
        });
        
        await reply(lines.join('\n'));
    } catch (error) {
        await reply(`❌ 查询所有报告失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 获取完整报告内容（不截断）
 */
export async function handleReportFull(reportId: string): Promise<void> {
    console.log(`执行 report full 指令: reportId=${reportId}`);
    try {
        const report = getReportById(reportId);
        
        if (!report) {
            await reply(`❌ 未找到报告 ID: ${reportId}`);
            return;
        }
        
        const lines: string[] = [];
        lines.push(`**报告 ID**: ${report.id}`);
        lines.push(`**项目**: ${report.projectId}`);
        lines.push(`**提交哈希**: ${report.commitHash}`);
        lines.push(`**创建时间**: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
        lines.push(`**更新时间**: ${new Date(report.updatedAt).toLocaleString('zh-CN')}`);
        
        if (report.executiveSummary) {
            lines.push(`\n**执行摘要**:\n${report.executiveSummary}`);
        }
        
        if (report.tiebaSummary) {
            lines.push(`\n**贴吧老哥总结**:\n${report.tiebaSummary}`);
        }
        
        const projectInfo = parseProjectInfo(report.projectInfo);
        if (projectInfo) {
            lines.push(`\n**项目信息**:`);
            lines.push(JSON.stringify(projectInfo, null, 2));
        }
        
        lines.push(`\n**完整审查报告**:\n${report.fullReport}`);
        
        await reply(lines.join('\n'));
    } catch (error) {
        await reply(`❌ 查询完整报告失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
