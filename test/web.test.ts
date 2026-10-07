import { describe, expect, it } from 'vitest';
import { wordDiff } from '../src/web/diff.js';
import { HISTORY_KEY, loadHistory, previousFor, recordDraft, saveHistory, type SavedDraft } from '../src/web/history.js';

const draft = (text: string, id = text): SavedDraft => ({ id, at: '2026-10-07T00:00:00Z', goal: 'vivid', text, findings: 1, metrics: { words: 1, gradeLevel: 1, avgSentenceLength: 1, sentenceLengthSpread: 0, passiveRate: 0, readingEase: 90, per100: {} as never, counts: {} as never } });

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('draft history', () => {
  it('round-trips through storage', () => {
    const s = new MemoryStorage();
    expect(saveHistory(s, [draft('a')])).toBe(true);
    expect(loadHistory(s).map((d) => d.text)).toEqual(['a']);
  });

  it('survives broken or blocked storage', () => {
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(loadHistory(throwing)).toEqual([]);
    expect(saveHistory(throwing, [draft('a')])).toBe(false);
    const s = new MemoryStorage();
    s.setItem(HISTORY_KEY, '{not json');
    expect(loadHistory(s)).toEqual([]);
    expect(loadHistory(undefined)).toEqual([]);
  });

  it('replaces the last entry when the text did not change', () => {
    const h = recordDraft(recordDraft([], draft('a', '1')), draft('a', '2'));
    expect(h).toHaveLength(1);
    expect(h[0]!.id).toBe('1');
    expect(recordDraft(h, draft('b'))).toHaveLength(2);
  });

  it('finds the previous different draft', () => {
    const h = [draft('a'), draft('b')];
    expect(previousFor(h, 'b')!.text).toBe('a');
    expect(previousFor(h, 'c')!.text).toBe('b');
    expect(previousFor([draft('a')], 'a')).toBeUndefined();
  });
});

describe('wordDiff', () => {
  it('marks deletions and insertions', () => {
    expect(wordDiff('She walked very slowly.', 'She walked slowly.')).toEqual([
      { type: 'same', text: 'She walked ' },
      { type: 'del', text: 'very ' },
      { type: 'same', text: 'slowly.' },
    ]);
  });
  it('treats a bracketed prompt as one token', () => {
    const parts = wordDiff('It was a dark and stormy night.', 'It was a [say "dark and stormy night" your way].');
    expect(parts.filter((p) => p.type === 'ins').map((p) => p.text)).toEqual(['[say "dark and stormy night" your way].']);
  });
});
