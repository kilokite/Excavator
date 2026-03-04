import { DataManager } from "../../utils/data.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

export type StatsCounters = {
  messagesProcessed: number;
  toolCalls: number;
  aiReplies: number;
  autoCheckRuns: number;
  autoCheckNewCommits: number;
  commitChecks: number;
  reportsGenerated: number;
  batchGenerateRuns: number;
};

export type StatsData = {
  startedAt: string; // ISO
  updatedAt: string; // ISO
  counters: StatsCounters;
  perProject: Record<string, Partial<StatsCounters>>;
};

const defaultStats: StatsData = {
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  counters: {
    messagesProcessed: 0,
    toolCalls: 0,
    aiReplies: 0,
    autoCheckRuns: 0,
    autoCheckNewCommits: 0,
    commitChecks: 0,
    reportsGenerated: 0,
    batchGenerateRuns: 0,
  },
  perProject: {},
};

function getStatsFilePath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataDir = join(__dirname, "../../../data");
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "stats.json");
}

export const statsManager = new DataManager<StatsData>(getStatsFilePath(), defaultStats);

function bumpUpdatedAt(d: StatsData) {
  d.updatedAt = new Date().toISOString();
}

export function incCounter(key: keyof StatsCounters, by = 1) {
  const d = statsManager.getData();
  d.counters[key] = (d.counters[key] || 0) + by;
  bumpUpdatedAt(d);
}

export function incProjectCounter(projectId: string, key: keyof StatsCounters, by = 1) {
  if (!projectId) return;
  const d = statsManager.getData();
  if (!d.perProject[projectId]) d.perProject[projectId] = {};
  const cur = (d.perProject[projectId][key] as number | undefined) || 0;
  d.perProject[projectId][key] = cur + by;
  bumpUpdatedAt(d);
}

export function getStatsSnapshot(): StatsData {
  return statsManager.getRawData();
}

