/**
 * 审查报告数据库服务
 * 提供审查报告的 CRUD 操作
 */
import { getDatabase } from './db.js';
import type Database from 'better-sqlite3';
import { computeReportDerived, type MergeClass } from './reportDerived.js';
import { getCommitAuthor } from './commitAuthor.js';

export interface ReportRecord {
    id: string;
    projectId: string;
    commitHash: string;
    createdAt: number;
    updatedAt: number;
    executiveSummary: string | null;
    tiebaSummary: string | null;
    fullReport: string;
    messageId: string | null;
    projectInfo: string | null; // JSON 字符串格式的项目信息
    codeLevel?: string | null;
    mergeRecommendation?: string | null;
    mergeClass?: MergeClass | null;
    criticalWarningsCount?: number | null;
    overallScoreValue?: number | null;
    overallScoreText?: string | null;
    authorName?: string | null;
    authorEmail?: string | null;
}

export interface ReportInsertData {
    id: string;
    projectId: string;
    commitHash: string;
    executiveSummary?: string;
    tiebaSummary?: string;
    fullReport: string;
    messageId?: string;
    projectInfo?: object; // 项目信息对象，会被序列化为 JSON
}

/**
 * 生成唯一的报告 ID
 */
export function generateReportId(projectId: string, commitHash: string): string {
    const timestamp = Date.now();
    return `${projectId}_${commitHash}_${timestamp}`;
}

/**
 * 插入或更新审查报告
 */
export function upsertReport(data: ReportInsertData): string {
    const db = getDatabase();
    const now = Date.now();
    
    // 将项目信息序列化为 JSON
    const projectInfoJson = data.projectInfo ? JSON.stringify(data.projectInfo) : null;
    const derived = computeReportDerived({ tiebaSummary: data.tiebaSummary || null, fullReport: data.fullReport });
    const author = getCommitAuthor(data.projectId, data.commitHash);
    
    // 先尝试查找是否存在相同的 project_id 和 commit_hash 的记录
    const existing = db
        .prepare('SELECT id FROM reports WHERE project_id = ? AND commit_hash = ?')
        .get(data.projectId, data.commitHash) as { id: string } | undefined;
    
    if (existing) {
        // 更新现有记录
        db.prepare(`
            UPDATE reports 
            SET updated_at = ?,
                executive_summary = ?,
                tieba_summary = ?,
                full_report = ?,
                message_id = COALESCE(?, message_id),
                project_info = ?,
                code_level = ?,
                merge_recommendation = ?,
                merge_class = ?,
                critical_warnings_count = ?,
                overall_score_value = ?,
                overall_score_text = ?,
                author_name = ?,
                author_email = ?
            WHERE id = ?
        `).run(
            now,
            data.executiveSummary || null,
            data.tiebaSummary || null,
            data.fullReport,
            data.messageId || null,
            projectInfoJson,
            derived.codeLevel,
            derived.mergeRecommendation,
            derived.mergeClass,
            derived.criticalWarningsCount,
            derived.overallScoreValue,
            derived.overallScoreText,
            author.name,
            author.email,
            existing.id
        );
        return existing.id;
    } else {
        // 插入新记录
        db.prepare(`
            INSERT INTO reports (
                id, project_id, commit_hash, created_at, updated_at,
                executive_summary, tieba_summary, full_report, message_id, project_info,
                code_level, merge_recommendation, merge_class, critical_warnings_count, overall_score_value, overall_score_text,
                author_name, author_email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.id,
            data.projectId,
            data.commitHash,
            now,
            now,
            data.executiveSummary || null,
            data.tiebaSummary || null,
            data.fullReport,
            data.messageId || null,
            projectInfoJson,
            derived.codeLevel,
            derived.mergeRecommendation,
            derived.mergeClass,
            derived.criticalWarningsCount,
            derived.overallScoreValue,
            derived.overallScoreText,
            author.name,
            author.email
        );
        return data.id;
    }
}

/**
 * 将数据库行转换为 ReportRecord
 */
function mapRowToReportRecord(row: any): ReportRecord {
    return {
        id: row.id,
        projectId: row.project_id,
        commitHash: row.commit_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        executiveSummary: row.executive_summary,
        tiebaSummary: row.tieba_summary,
        fullReport: row.full_report,
        messageId: row.message_id,
        projectInfo: row.project_info,
        codeLevel: row.code_level,
        mergeRecommendation: row.merge_recommendation,
        mergeClass: row.merge_class,
        criticalWarningsCount: row.critical_warnings_count,
        overallScoreValue: row.overall_score_value,
        overallScoreText: row.overall_score_text,
        authorName: row.author_name,
        authorEmail: row.author_email,
    };
}

/**
 * 根据报告 ID 获取报告
 */
export function getReportById(reportId: string): ReportRecord | null {
    const db = getDatabase();
    const row = db
        .prepare('SELECT * FROM reports WHERE id = ?')
        .get(reportId) as any;
    
    return row ? mapRowToReportRecord(row) : null;
}

/**
 * 根据消息 ID 获取报告
 */
export function getReportByMessageId(messageId: string): ReportRecord | null {
    const db = getDatabase();
    const row = db
        .prepare('SELECT * FROM reports WHERE message_id = ?')
        .get(messageId) as any;
    
    return row ? mapRowToReportRecord(row) : null;
}

/**
 * 根据项目 ID 和提交哈希获取报告
 */
export function getReportByCommit(
    projectId: string,
    commitHash: string
): ReportRecord | null {
    const db = getDatabase();
    const row = db
        .prepare('SELECT * FROM reports WHERE project_id = ? AND commit_hash = ?')
        .get(projectId, commitHash) as any;
    
    return row ? mapRowToReportRecord(row) : null;
}

/**
 * 获取项目的所有报告（按创建时间倒序）
 */
export function getReportsByProject(
    projectId: string,
    limit?: number
): ReportRecord[] {
    const db = getDatabase();
    const query = limit
        ? 'SELECT * FROM reports WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
        : 'SELECT * FROM reports WHERE project_id = ? ORDER BY created_at DESC';
    
    const stmt = db.prepare(query);
    const rows = limit
        ? stmt.all(projectId, limit) as any[]
        : stmt.all(projectId) as any[];
    
    return rows.map(mapRowToReportRecord);
}

export interface ReportListQuery {
    projectId: string;
    keyword?: string;
    limit?: number;
    offset?: number;
    codeLevel?: string;
    mergeClass?: MergeClass;
    onlyCriticalWarnings?: boolean;
    minScore?: number;
    maxScore?: number;
    authorKeyword?: string;
}

export interface ReportListResult {
    total: number;
    items: ReportRecord[];
}

export type ReportAuthorItem = {
    name: string | null;
    email: string | null;
    count: number;
};

export function listReportAuthors(input: { projectId: string; keyword?: string; limit?: number }): ReportAuthorItem[] {
    const db = getDatabase();
    const safeLimit = Math.max(1, Math.min(200, input.limit ?? 50));
    const keyword = input.keyword?.trim();
    const hasKeyword = !!keyword;

    if (!hasKeyword) {
        const rows = db.prepare(`
            SELECT author_name as name, author_email as email, COUNT(1) as cnt
            FROM reports
            WHERE project_id = ?
              AND (author_name IS NOT NULL OR author_email IS NOT NULL)
            GROUP BY author_name, author_email
            ORDER BY cnt DESC
            LIMIT ?
        `).all(input.projectId, safeLimit) as any[];
        return rows.map(r => ({
            name: r.name ?? null,
            email: r.email ?? null,
            count: Number(r.cnt ?? 0),
        }));
    }

    const like = `%${keyword}%`;
    const rows = db.prepare(`
        SELECT author_name as name, author_email as email, COUNT(1) as cnt
        FROM reports
        WHERE project_id = ?
          AND (author_name LIKE ? OR author_email LIKE ?)
        GROUP BY author_name, author_email
        ORDER BY cnt DESC
        LIMIT ?
    `).all(input.projectId, like, like, safeLimit) as any[];
    return rows.map(r => ({
        name: r.name ?? null,
        email: r.email ?? null,
        count: Number(r.cnt ?? 0),
    }));
}

/**
 * 获取项目报告列表（支持分页 + 关键词搜索）
 * - keyword 会匹配 commit_hash / executive_summary / tieba_summary
 * - 为性能考虑，不对 full_report 做 LIKE
 */
export function queryReportsByProject(input: ReportListQuery): ReportListResult {
    const db = getDatabase();
    const safeLimit = Math.max(1, Math.min(200, input.limit ?? 50));
    const safeOffset = Math.max(0, Math.min(50000, input.offset ?? 0));
    const keyword = input.keyword?.trim();
    const hasKeyword = !!keyword;

    const where: string[] = ['project_id = ?'];
    const params: any[] = [input.projectId];

    if (hasKeyword) {
        const like = `%${keyword}%`;
        where.push(`(
            commit_hash LIKE ?
            OR executive_summary LIKE ?
            OR tieba_summary LIKE ?
        )`);
        params.push(like, like, like);
    }

    if (input.codeLevel) {
        where.push('code_level = ?');
        params.push(input.codeLevel);
    }
    if (input.mergeClass) {
        where.push('merge_class = ?');
        params.push(input.mergeClass);
    }
    if (input.onlyCriticalWarnings) {
        where.push('critical_warnings_count > 0');
    }
    if (typeof input.minScore === 'number') {
        where.push('overall_score_value >= ?');
        params.push(input.minScore);
    }
    if (typeof input.maxScore === 'number') {
        where.push('overall_score_value <= ?');
        params.push(input.maxScore);
    }

    if (input.authorKeyword && input.authorKeyword.trim()) {
        const like = `%${input.authorKeyword.trim()}%`;
        where.push('(author_name LIKE ? OR author_email LIKE ?)');
        params.push(like, like);
    }

    const whereSql = where.join(' AND ');

    const totalRow = db
        .prepare(`SELECT COUNT(1) as cnt FROM reports WHERE ${whereSql}`)
        .get(...params) as any;
    const total = Number(totalRow?.cnt ?? 0);

    const rows = db
        .prepare(`SELECT * FROM reports WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, safeLimit, safeOffset) as any[];

    return { total, items: rows.map(mapRowToReportRecord) };
}

/**
 * 获取所有报告（按创建时间倒序）
 */
export function getAllReports(limit?: number): ReportRecord[] {
    const db = getDatabase();
    const query = limit
        ? 'SELECT * FROM reports ORDER BY created_at DESC LIMIT ?'
        : 'SELECT * FROM reports ORDER BY created_at DESC';
    
    const stmt = db.prepare(query);
    const rows = limit
        ? stmt.all(limit) as any[]
        : stmt.all() as any[];
    
    return rows.map(mapRowToReportRecord);
}

/**
 * 删除报告
 */
export function deleteReport(reportId: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
    return result.changes > 0;
}

/**
 * 清理过期报告（可选功能）
 */
export function cleanupExpiredReports(expiryMs: number = 60 * 60 * 1000): number {
    const db = getDatabase();
    const expiryTime = Date.now() - expiryMs;
    const result = db
        .prepare('DELETE FROM reports WHERE created_at < ?')
        .run(expiryTime);
    return result.changes;
}

/**
 * 解析项目信息 JSON
 */
export function parseProjectInfo(projectInfoJson: string | null): object | null {
    if (!projectInfoJson) {
        return null;
    }
    try {
        return JSON.parse(projectInfoJson);
    } catch {
        return null;
    }
}
