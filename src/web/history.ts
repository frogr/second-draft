import type { DetectorId, Metrics } from '../core/types.js';

export interface SavedDraft {
  id: string;
  at: string;
  goal: string;
  text: string;
  metrics: Pick<Metrics, 'words' | 'gradeLevel' | 'avgSentenceLength' | 'sentenceLengthSpread' | 'passiveRate' | 'readingEase'> & { per100: Record<DetectorId, number>; counts: Record<DetectorId, number> };
  findings: number;
}

export const HISTORY_KEY = 'second-draft:history:v1';
export const MAX_DRAFTS = 12;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Read saved drafts. Any storage failure (private mode, blocked, corrupt JSON) returns []. */
export function loadHistory(storage: StorageLike | undefined): SavedDraft[] {
  try {
    const raw = storage?.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d) => d && typeof d.text === 'string' && d.metrics) : [];
  } catch {
    return [];
  }
}

/** Write drafts; returns false if storage refused (quota, disabled). The page keeps working either way. */
export function saveHistory(storage: StorageLike | undefined, drafts: SavedDraft[]): boolean {
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(drafts.slice(-MAX_DRAFTS)));
    return !!storage;
  } catch {
    return false;
  }
}

export function clearHistory(storage: StorageLike | undefined): void {
  try {
    storage?.removeItem(HISTORY_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Add a draft, or replace the last one if the text is unchanged (re-running the coach on the same text). */
export function recordDraft(drafts: SavedDraft[], draft: SavedDraft): SavedDraft[] {
  const last = drafts[drafts.length - 1];
  if (last && last.text === draft.text) return [...drafts.slice(0, -1), { ...draft, id: last.id }];
  return [...drafts, draft].slice(-MAX_DRAFTS);
}

/** The most recent saved draft whose text differs from `text`, for compare_drafts. */
export function previousFor(drafts: SavedDraft[], text: string): SavedDraft | undefined {
  for (let i = drafts.length - 1; i >= 0; i--) if (drafts[i]!.text !== text) return drafts[i];
  return undefined;
}
