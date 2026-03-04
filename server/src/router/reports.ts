import { router, publicPro } from '../trpc/trpc.js';
import { z } from 'zod';
import { getReportById, getReportsByProject, parseProjectInfo, queryReportsByProject, listReportAuthors, getAllReports } from '../utils/reportDbService.js';
import { parseReviewHighlightsLite } from '../utils/reviewHighlights.js';
import { type MergeClass } from '../utils/reportDerived.js';
import { checkCommit } from '../app/utils/claudecli.js';
import { setReport } from '../app/utils/reportStore.js';
import { incCounter, incProjectCounter } from '../app/utils/stats.js';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

/**
 * 获取 projects 目录的根路径
 */
function getProjectsRoot(): string {
    const currentFile = fileURLToPath(import.meta.url);
    let currentDir = resolve(currentFile, '..');
    
    for (let i = 0; i < 10; i++) {
        const serverProjectsPath = join(currentDir, 'server', 'projects');
        try {
            const entries = readdirSync(join(currentDir, 'server'), { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return serverProjectsPath;
            }
        } catch {
            // 忽略
        }
        
        try {
            const projectsPath = join(currentDir, 'projects');
            const entries = readdirSync(currentDir, { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return projectsPath;
            }
        } catch {
            // 忽略
        }
        
        const parentDir = resolve(currentDir, '..');
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    
    return resolve(fileURLToPath(new URL('../../../projects', import.meta.url)));
}

/**
 * 检查项目是否存在且为 Git 仓库
 */
function validateProject(projectId: string): { valid: boolean; projectPath?: string; error?: string } {
    const projectsRoot = getProjectsRoot();
    const projectPath = join(projectsRoot, projectId);
    
    try {
        const entries = readdirSync(projectsRoot, { withFileTypes: true });
        const projectExists = entries.some(
            entry => entry.isDirectory() && entry.name === projectId
        );
        
        if (!projectExists) {
            return { valid: false, error: `项目 ${projectId} 不存在` };
        }
    } catch (error) {
        return { valid: false, error: `读取项目目录失败: ${error instanceof Error ? error.message : String(error)}` };
    }
    
    try {
        execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, stdio: 'pipe' });
    } catch {
        return { valid: false, error: `项目 ${projectId} 不是 Git 仓库` };
    }
    
    return { valid: true, projectPath };
}

export default router({
    // 获取代码审查报告
    getReport: publicPro
        .input(z.string().describe('报告ID'))
        .query(({ input: reportId }) => {
            const report = getReportById(reportId);
            
            if (!report) {
                throw new Error('报告不存在');
            }
            
            return {
                id: report.id,
                projectId: report.projectId,
                commitHash: report.commitHash,
                createdAt: report.createdAt,
                updatedAt: report.updatedAt,
                executiveSummary: report.executiveSummary,
                tiebaSummary: report.tiebaSummary,
                fullReport: report.fullReport,
                messageId: report.messageId,
                projectInfo: parseProjectInfo(report.projectInfo),
            };
        }),
    
    // 获取项目的报告列表
    listReports: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            limit: z.number().optional().describe('限制条数'),
            offset: z.number().optional().describe('偏移量（分页用）'),
            keyword: z.string().optional().describe('搜索关键词'),
            codeLevel: z.string().optional().describe('代码等级筛选（如 有机肥/不可回收垃圾/可回收垃圾/非垃圾）'),
            mergeClass: z.enum(['needFix', 'canMerge', 'noMerge', 'unknown'] as const).optional().describe('合并建议分类筛选'),
            onlyCriticalWarnings: z.boolean().optional().describe('仅显示有重大警告的报告'),
            minScore: z.number().optional().describe('最小综合评分（0-10）'),
            maxScore: z.number().optional().describe('最大综合评分（0-10）'),
            authorKeyword: z.string().optional().describe('作者筛选（匹配 authorName/authorEmail）'),
        }))
        .query(({ input }) => {
            const hasExtraFilters =
                input.codeLevel !== undefined ||
                input.mergeClass !== undefined ||
                input.onlyCriticalWarnings !== undefined ||
                input.minScore !== undefined ||
                input.maxScore !== undefined;

            // 兼容旧调用：仅传 limit 的情况下沿用原逻辑（且没有额外筛选）
            if (input.offset === undefined && input.keyword === undefined && !hasExtraFilters) {
                const reports = getReportsByProject(input.projectId, input.limit);
                return reports.map(report => ({
                    id: report.id,
                    projectId: report.projectId,
                    commitHash: report.commitHash,
                    createdAt: report.createdAt,
                    updatedAt: report.updatedAt,
                    executiveSummary: report.executiveSummary,
                    tiebaSummary: report.tiebaSummary,
                    messageId: report.messageId,
                    projectInfo: parseProjectInfo(report.projectInfo),
                    codeLevel: (report as any).codeLevel ?? (report as any).code_level,
                    mergeRecommendation: (report as any).mergeRecommendation ?? (report as any).merge_recommendation,
                    mergeClass: (report as any).mergeClass ?? (report as any).merge_class,
                    criticalWarningsCount: (report as any).criticalWarningsCount ?? (report as any).critical_warnings_count,
                    overallScoreValue: (report as any).overallScoreValue ?? (report as any).overall_score_value,
                    overallScoreText: (report as any).overallScoreText ?? (report as any).overall_score_text,
                }));
            }

            const result = queryReportsByProject({
                projectId: input.projectId,
                limit: input.limit,
                offset: input.offset,
                keyword: input.keyword,
                codeLevel: input.codeLevel,
                mergeClass: input.mergeClass as MergeClass | undefined,
                onlyCriticalWarnings: input.onlyCriticalWarnings,
                minScore: input.minScore,
                maxScore: input.maxScore,
                authorKeyword: input.authorKeyword,
            });

            return {
                total: result.total,
                items: result.items.map(report => ({
                    id: report.id,
                    projectId: report.projectId,
                    commitHash: report.commitHash,
                    createdAt: report.createdAt,
                    updatedAt: report.updatedAt,
                    executiveSummary: report.executiveSummary,
                    tiebaSummary: report.tiebaSummary,
                    messageId: report.messageId,
                    projectInfo: parseProjectInfo(report.projectInfo),
                    codeLevel: report.codeLevel ?? null,
                    mergeRecommendation: report.mergeRecommendation ?? null,
                    mergeClass: report.mergeClass ?? null,
                    criticalWarningsCount: report.criticalWarningsCount ?? 0,
                    overallScoreValue: report.overallScoreValue ?? null,
                    overallScoreText: report.overallScoreText ?? null,
                    authorName: report.authorName ?? null,
                    authorEmail: report.authorEmail ?? null,
                })),
            };
        }),

    // 获取报告的轻量摘要（用于列表筛选/展示，不返回 fullReport）
    getReportHighlights: publicPro
        .input(z.string().describe('报告ID'))
        .query(({ input: reportId }) => {
            const report = getReportById(reportId);
            if (!report) {
                throw new Error('报告不存在');
            }
            return parseReviewHighlightsLite(report.fullReport || '');
        }),

    // 获取作者下拉候选（用于前端下拉选择）
    listAuthors: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            keyword: z.string().optional().describe('关键词（匹配作者名/邮箱）'),
            limit: z.number().optional().describe('返回数量（默认 50）'),
        }))
        .query(({ input }) => {
            return listReportAuthors({
                projectId: input.projectId,
                keyword: input.keyword,
                limit: input.limit,
            });
        }),

    // 最近报告（全局 or 指定项目）
    recentReports: publicPro
        .input(z.object({
            limit: z.number().optional().default(10).describe('返回数量'),
            projectId: z.string().optional().describe('可选：限制到某个项目'),
        }))
        .query(({ input }) => {
            const limit = Math.max(1, Math.min(50, input.limit ?? 10));
            if (input.projectId) {
                const reports = getReportsByProject(input.projectId, limit);
                return reports.map(report => ({
                    id: report.id,
                    projectId: report.projectId,
                    commitHash: report.commitHash,
                    createdAt: report.createdAt,
                    updatedAt: report.updatedAt,
                    executiveSummary: report.executiveSummary,
                    tiebaSummary: report.tiebaSummary,
                    messageId: report.messageId,
                    projectInfo: parseProjectInfo(report.projectInfo),
                    codeLevel: (report as any).codeLevel ?? (report as any).code_level ?? null,
                    mergeRecommendation: (report as any).mergeRecommendation ?? (report as any).merge_recommendation ?? null,
                    mergeClass: (report as any).mergeClass ?? (report as any).merge_class ?? null,
                    criticalWarningsCount: (report as any).criticalWarningsCount ?? (report as any).critical_warnings_count ?? 0,
                    overallScoreValue: (report as any).overallScoreValue ?? (report as any).overall_score_value ?? null,
                    overallScoreText: (report as any).overallScoreText ?? (report as any).overall_score_text ?? null,
                    authorName: (report as any).authorName ?? (report as any).author_name ?? null,
                    authorEmail: (report as any).authorEmail ?? (report as any).author_email ?? null,
                }));
            }

            const reports = getAllReports(limit);
            return reports.map(report => ({
                id: report.id,
                projectId: report.projectId,
                commitHash: report.commitHash,
                createdAt: report.createdAt,
                updatedAt: report.updatedAt,
                executiveSummary: report.executiveSummary,
                tiebaSummary: report.tiebaSummary,
                messageId: report.messageId,
                projectInfo: parseProjectInfo(report.projectInfo),
                codeLevel: (report as any).codeLevel ?? (report as any).code_level ?? null,
                mergeRecommendation: (report as any).mergeRecommendation ?? (report as any).merge_recommendation ?? null,
                mergeClass: (report as any).mergeClass ?? (report as any).merge_class ?? null,
                criticalWarningsCount: (report as any).criticalWarningsCount ?? (report as any).critical_warnings_count ?? 0,
                overallScoreValue: (report as any).overallScoreValue ?? (report as any).overall_score_value ?? null,
                overallScoreText: (report as any).overallScoreText ?? (report as any).overall_score_text ?? null,
                authorName: (report as any).authorName ?? (report as any).author_name ?? null,
                authorEmail: (report as any).authorEmail ?? (report as any).author_email ?? null,
            }));
        }),
    
    // 批量生成报告
    batchGenerate: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            commitHashes: z.array(z.string()).describe('提交哈希列表'),
        }))
        .mutation(async ({ input }) => {
            incCounter('batchGenerateRuns', 1);
            incProjectCounter(input.projectId, 'batchGenerateRuns', 1);
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            
            const results = [];
            
            for (const commitHash of input.commitHashes) {
                try {
                    incCounter('commitChecks', 1);
                    incProjectCounter(input.projectId, 'commitChecks', 1);
                    // 切换到指定的commit
                    execSync(`git checkout ${commitHash}`, {
                        cwd: validation.projectPath,
                        stdio: 'pipe',
                    });
                    
                    // 生成报告，使用checkCommit函数
                    const result = await checkCommit(input.projectId, commitHash);
                    
                    if (result.success && result.output) {
                        // 存储报告
                        const reportId = setReport(
                            input.projectId,
                            commitHash,
                            result.output,
                            result.tiebaSummary
                        );
                        incCounter('reportsGenerated', 1);
                        incProjectCounter(input.projectId, 'reportsGenerated', 1);
                        
                        results.push({
                            commitHash,
                            success: true,
                            reportId,
                            message: '报告生成成功',
                        });
                    } else {
                        results.push({
                            commitHash,
                            success: false,
                            message: result.message || '生成报告失败',
                        });
                    }
                } catch (error) {
                    results.push({
                        commitHash,
                        success: false,
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            
            return {
                success: true,
                results,
                total: input.commitHashes.length,
                successCount: results.filter(r => r.success).length,
                failCount: results.filter(r => !r.success).length,
            };
        }),
});




















