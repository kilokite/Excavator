/**
 * 报告查询相关 Function Call 函数
 */
import {
    getReportById,
    getReportByCommit,
    getReportsByProject,
    getAllReports,
    parseProjectInfo,
    type ReportRecord,
} from '../../../utils/reportDbService.js';

/**
 * 格式化报告信息
 */
function formatReport(report: ReportRecord): string {
    const lines: string[] = [];
    
    lines.push(`**报告 ID**: ${report.id}`);
    lines.push(`**项目**: ${report.projectId}`);
    lines.push(`**提交哈希**: ${report.commitHash.substring(0, 8)}`);
    lines.push(`**创建时间**: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
    
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
    
    // 完整报告（截断显示）
    const maxReportLength = 2000;
    if (report.fullReport.length > maxReportLength) {
        lines.push(`\n**完整报告** (前${maxReportLength}字符):\n${report.fullReport.substring(0, maxReportLength)}...`);
        lines.push(`\n(报告总长度: ${report.fullReport.length} 字符，使用 get_report_full 获取完整内容)`);
    } else {
        lines.push(`\n**完整报告**:\n${report.fullReport}`);
    }
    
    return lines.join('\n');
}

/**
 * 根据报告ID获取报告
 */
export async function getReportByIdFunction(reportId: string): Promise<string> {
    try {
        const report = getReportById(reportId);
        
        if (!report) {
            return `未找到报告 ID: ${reportId}`;
        }
        
        return formatReport(report);
    } catch (error) {
        return `查询报告时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 根据项目和提交哈希获取报告
 */
export async function getReportByCommitFunction(
    projectId: string,
    commitHash: string
): Promise<string> {
    try {
        const report = getReportByCommit(projectId, commitHash);
        
        if (!report) {
            return `未找到项目 ${projectId} 提交 ${commitHash.substring(0, 8)} 的报告`;
        }
        
        return formatReport(report);
    } catch (error) {
        return `查询报告时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取项目的所有报告列表
 */
export async function getProjectReportsFunction(
    projectId: string,
    limit?: number
): Promise<string> {
    try {
        const reports = getReportsByProject(projectId, limit);
        
        if (reports.length === 0) {
            return `项目 ${projectId} 没有审查报告`;
        }
        
        const lines: string[] = [];
        lines.push(`项目 ${projectId} 共有 ${reports.length} 条审查报告:\n`);
        
        reports.forEach((report, index) => {
            lines.push(`${index + 1}. **报告 ID**: ${report.id}`);
            lines.push(`   - 提交哈希: ${report.commitHash.substring(0, 8)}`);
            lines.push(`   - 创建时间: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
            if (report.executiveSummary) {
                const summary = report.executiveSummary.length > 100
                    ? report.executiveSummary.substring(0, 100) + '...'
                    : report.executiveSummary;
                lines.push(`   - 执行摘要: ${summary}`);
            }
            lines.push('');
        });
        
        return lines.join('\n');
    } catch (error) {
        return `查询项目报告时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取所有报告列表
 */
export async function getAllReportsFunction(limit?: number): Promise<string> {
    try {
        console.log(`[getAllReportsFunction] 调用参数: limit=${limit}`);
        
        // 确保 limit 是有效的数字或 undefined
        const validLimit = limit && typeof limit === 'number' && limit > 0 ? limit : undefined;
        
        const reports = getAllReports(validLimit);
        
        console.log(`[getAllReportsFunction] 查询到 ${reports.length} 条报告`);
        
        if (reports.length === 0) {
            return '当前没有审查报告';
        }
        
        const lines: string[] = [];
        lines.push(`共有 ${reports.length} 条审查报告:\n`);
        
        reports.forEach((report, index) => {
            try {
                lines.push(`${index + 1}. **报告 ID**: ${report.id || 'N/A'}`);
                lines.push(`   - 项目: ${report.projectId || 'N/A'}`);
                
                // 安全地处理 commitHash
                if (report.commitHash && typeof report.commitHash === 'string') {
                    lines.push(`   - 提交哈希: ${report.commitHash.substring(0, 8)}`);
                } else {
                    lines.push(`   - 提交哈希: N/A`);
                }
                
                // 安全地处理 createdAt
                if (report.createdAt) {
                    lines.push(`   - 创建时间: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
                } else {
                    lines.push(`   - 创建时间: N/A`);
                }
                
                if (report.executiveSummary) {
                    const summary = report.executiveSummary.length > 100
                        ? report.executiveSummary.substring(0, 100) + '...'
                        : report.executiveSummary;
                    lines.push(`   - 执行摘要: ${summary}`);
                }
                lines.push('');
            } catch (itemError) {
                console.error(`[getAllReportsFunction] 处理报告 ${index} 时出错:`, itemError);
                lines.push(`${index + 1}. **报告处理出错**\n`);
            }
        });
        
        return lines.join('\n');
    } catch (error) {
        console.error(`[getAllReportsFunction] 执行错误:`, error);
        return `查询所有报告时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取完整报告内容（不截断）
 */
export async function getReportFullFunction(reportId: string): Promise<string> {
    try {
        const report = getReportById(reportId);
        
        if (!report) {
            return `未找到报告 ID: ${reportId}`;
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
        
        return lines.join('\n');
    } catch (error) {
        return `查询完整报告时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}
