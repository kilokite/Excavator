/**
 * 报告存储工具
 * 使用 SQLite 数据库存储代码审查报告
 */
import {
    upsertReport,
    getReportById,
    getReportByMessageId as getReportByMessageIdDb,
    getReportByCommit,
    generateReportId,
    type ReportRecord,
} from '../../utils/reportDbService.js';
import { DEFAULT_FRONTEND_URL } from '../config/constants.js';
import { extractReportSections } from './reportSections.js';
import { get } from './project.js';

// 保持向后兼容的接口
export interface ReportData {
    projectId: string;
    commitHash: string;
    content: string;
    tiebaSummary?: string;
    timestamp: number;
    messageId?: string;
}

/**
 * 将数据库记录转换为 ReportData 格式（向后兼容）
 */
function recordToReportData(record: ReportRecord | null): ReportData | null {
    if (!record) {
        return null;
    }
    
    return {
        projectId: record.projectId,
        commitHash: record.commitHash,
        content: record.fullReport,
        tiebaSummary: record.tiebaSummary || undefined,
        timestamp: record.createdAt,
        messageId: record.messageId || undefined,
    };
}

/**
 * 存储报告
 * @param messageId 可选，发送的卡片消息ID
 * @returns 报告 ID
 */
export function setReport(
    projectId: string,
    commitHash: string,
    content: string,
    tiebaSummary?: string,
    messageId?: string
): string {
    // 从完整报告中提取执行摘要
    const { executiveSummary } = extractReportSections(content);
    
    // 获取项目信息
    const project = get(projectId);
    const projectInfo = project ? {
        id: project.id,
        name: project.name,
        description: project.config?.description,
        gitRemote: project.config?.gitRemote,
        tags: project.config?.tags,
        createdAt: project.config?.createdAt,
        updatedAt: project.config?.updatedAt,
    } : null;
    
    // 生成或查找报告 ID
    const existingReport = getReportByCommit(projectId, commitHash);
    const reportId = existingReport?.id || generateReportId(projectId, commitHash);
    
    // 存储到数据库
    upsertReport({
        id: reportId,
        projectId,
        commitHash,
        executiveSummary: executiveSummary || undefined,
        tiebaSummary,
        fullReport: content,
        messageId,
        projectInfo,
    });
    
    return reportId;
}

/**
 * 获取报告
 */
export function getReport(reportId: string): ReportData | null {
    const record = getReportById(reportId);
    return recordToReportData(record);
}

/**
 * 根据消息ID获取报告
 */
export function getReportByMessageId(messageId: string): ReportData | null {
    const record = getReportByMessageIdDb(messageId);
    return recordToReportData(record);
}

/**
 * 获取报告 URL（指向前端页面）
 */
export function getReportUrl(reportId: string, baseUrl?: string): string {
    // 如果提供了 baseUrl，使用它；否则使用动态检测到的默认前端地址
    const url = baseUrl || DEFAULT_FRONTEND_URL;
    return `${url}/report/${reportId}`;
}

