export type ReportPrefs = {
  favorites: Record<string, string[]>; // projectId -> reportIds
  pinned: Record<string, string[]>; // projectId -> reportIds
  recents: Record<string, Array<{ id: string; ts: number }>>; // projectId -> recent items
};

const STORAGE_KEY = "excavator.reportPrefs.v1";
const RECENTS_LIMIT = 20;

function safeParse(json: string | null): any {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalize(prefs: any): ReportPrefs {
  const base: ReportPrefs = { favorites: {}, pinned: {}, recents: {} };
  if (!prefs || typeof prefs !== "object") return base;
  return {
    favorites: prefs.favorites && typeof prefs.favorites === "object" ? prefs.favorites : {},
    pinned: prefs.pinned && typeof prefs.pinned === "object" ? prefs.pinned : {},
    recents: prefs.recents && typeof prefs.recents === "object" ? prefs.recents : {},
  };
}

export function loadReportPrefs(): ReportPrefs {
  if (typeof window === "undefined") return { favorites: {}, pinned: {}, recents: {} };
  return normalize(safeParse(window.localStorage.getItem(STORAGE_KEY)));
}

export function saveReportPrefs(prefs: ReportPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function uniqStrings(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isFavorite(prefs: ReportPrefs, projectId: string, reportId: string): boolean {
  return !!prefs.favorites?.[projectId]?.includes(reportId);
}

export function isPinned(prefs: ReportPrefs, projectId: string, reportId: string): boolean {
  return !!prefs.pinned?.[projectId]?.includes(reportId);
}

function clonePrefs(prefs: ReportPrefs): ReportPrefs {
  return {
    favorites: Object.fromEntries(
      Object.entries(prefs.favorites || {}).map(([k, v]) => [k, Array.isArray(v) ? [...v] : []])
    ),
    pinned: Object.fromEntries(
      Object.entries(prefs.pinned || {}).map(([k, v]) => [k, Array.isArray(v) ? [...v] : []])
    ),
    recents: Object.fromEntries(
      Object.entries(prefs.recents || {}).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.map((x) => ({ id: x?.id, ts: x?.ts })) : [],
      ])
    ),
  };
}

export function toggleFavorite(prefs: ReportPrefs, projectId: string, reportId: string): ReportPrefs {
  const next = clonePrefs(prefs);
  const list = new Set<string>(next.favorites?.[projectId] || []);
  if (list.has(reportId)) list.delete(reportId);
  else list.add(reportId);
  next.favorites[projectId] = uniqStrings(Array.from(list));
  saveReportPrefs(next);
  return next;
}

export function togglePinned(prefs: ReportPrefs, projectId: string, reportId: string): ReportPrefs {
  const next = clonePrefs(prefs);
  const list = new Set<string>(next.pinned?.[projectId] || []);
  if (list.has(reportId)) list.delete(reportId);
  else list.add(reportId);
  next.pinned[projectId] = uniqStrings(Array.from(list));
  saveReportPrefs(next);
  return next;
}

export function addRecent(prefs: ReportPrefs, projectId: string, reportId: string): ReportPrefs {
  const next = clonePrefs(prefs);
  const now = Date.now();
  const prev = (next.recents?.[projectId] || []).filter((x) => x && x.id && x.id !== reportId);
  const merged = [{ id: reportId, ts: now }, ...prev].slice(0, RECENTS_LIMIT);
  next.recents[projectId] = merged;
  saveReportPrefs(next);
  return next;
}

export function getRecents(prefs: ReportPrefs, projectId: string): Array<{ id: string; ts: number }> {
  return (prefs.recents?.[projectId] || []).filter((x) => x && x.id);
}

