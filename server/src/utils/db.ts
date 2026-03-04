/**
 * SQLite 数据库工具
 * 用于存储和管理代码审查报告
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { computeReportDerived } from './reportDerived.js';
import { getCommitAuthor } from './commitAuthor.js';

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库文件路径（相对于当前文件位置：server/src/utils -> server/data）
const DB_DIR = join(__dirname, '../../data');
const DB_PATH = join(DB_DIR, 'reports.db');

// 确保数据目录存在
if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
}

// 数据库实例（单例模式）
let dbInstance: Database.Database | null = null;

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
    if (!dbInstance) {
        dbInstance = new Database(DB_PATH);
        dbInstance.pragma('journal_mode = WAL'); // 启用 WAL 模式提高性能
        initializeTables(dbInstance);
    }
    return dbInstance;
}

/**
 * 初始化数据库表结构
 */
function initializeTables(db: Database.Database): void {
    // 创建审查报告表
    db.exec(`
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            commit_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            executive_summary TEXT,
            tieba_summary TEXT,
            full_report TEXT NOT NULL,
            message_id TEXT,
            project_info TEXT,
            UNIQUE(project_id, commit_hash)
        )
    `);

    // 创建索引以提高查询性能
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_project_commit ON reports(project_id, commit_hash);
        CREATE INDEX IF NOT EXISTS idx_created_at ON reports(created_at);
        CREATE INDEX IF NOT EXISTS idx_message_id ON reports(message_id);
    `);

    // 轻量派生字段迁移（用于后端筛选/排序）
    ensureReportDerivedColumns(db);
    backfillReportDerivedColumns(db);
}

function ensureReportDerivedColumns(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(reports)`).all() as Array<{ name: string }>;
    const existing = new Set(cols.map(c => c.name));

    const addColumn = (sql: string) => db.exec(sql);

    if (!existing.has('code_level')) addColumn(`ALTER TABLE reports ADD COLUMN code_level TEXT`);
    if (!existing.has('merge_recommendation')) addColumn(`ALTER TABLE reports ADD COLUMN merge_recommendation TEXT`);
    if (!existing.has('merge_class')) addColumn(`ALTER TABLE reports ADD COLUMN merge_class TEXT`);
    if (!existing.has('critical_warnings_count')) addColumn(`ALTER TABLE reports ADD COLUMN critical_warnings_count INTEGER DEFAULT 0`);
    if (!existing.has('overall_score_value')) addColumn(`ALTER TABLE reports ADD COLUMN overall_score_value REAL`);
    if (!existing.has('overall_score_text')) addColumn(`ALTER TABLE reports ADD COLUMN overall_score_text TEXT`);
    if (!existing.has('author_name')) addColumn(`ALTER TABLE reports ADD COLUMN author_name TEXT`);
    if (!existing.has('author_email')) addColumn(`ALTER TABLE reports ADD COLUMN author_email TEXT`);

    // 索引（只要列存在就可创建；IF NOT EXISTS 安全）
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_reports_project_level ON reports(project_id, code_level);
        CREATE INDEX IF NOT EXISTS idx_reports_project_merge ON reports(project_id, merge_class);
        CREATE INDEX IF NOT EXISTS idx_reports_project_critical ON reports(project_id, critical_warnings_count);
        CREATE INDEX IF NOT EXISTS idx_reports_project_updated ON reports(project_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_reports_project_author ON reports(project_id, author_name, author_email);
    `);
}

function backfillReportDerivedColumns(db: Database.Database) {
    // 仅回填缺失的记录（code_level / merge_class / critical_warnings_count 任一为空时）
    const rows = db.prepare(`
        SELECT id, project_id, commit_hash, tieba_summary, full_report,
               code_level, merge_class, critical_warnings_count, overall_score_value, overall_score_text, merge_recommendation
               , author_name, author_email
        FROM reports
        WHERE code_level IS NULL
           OR merge_class IS NULL
           OR critical_warnings_count IS NULL
           OR overall_score_value IS NULL
           OR overall_score_text IS NULL
           OR merge_recommendation IS NULL
           OR author_name IS NULL
           OR author_email IS NULL
    `).all() as any[];

    if (!rows || rows.length === 0) return;

    const update = db.prepare(`
        UPDATE reports
        SET code_level = ?,
            merge_recommendation = ?,
            merge_class = ?,
            critical_warnings_count = ?,
            overall_score_value = ?,
            overall_score_text = ?,
            author_name = ?,
            author_email = ?
        WHERE id = ?
    `);

    const tx = db.transaction((items: any[]) => {
        for (const r of items) {
            const d = computeReportDerived({ tiebaSummary: r.tieba_summary, fullReport: r.full_report });
            const a = getCommitAuthor(String(r.project_id), String(r.commit_hash));
            update.run(
                d.codeLevel,
                d.mergeRecommendation,
                d.mergeClass,
                d.criticalWarningsCount,
                d.overallScoreValue,
                d.overallScoreText,
                a.name,
                a.email,
                r.id
            );
        }
    });

    tx(rows);
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
