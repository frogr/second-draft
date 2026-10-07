import type { Finding, WordToken } from '../types.js';
import { STOPWORDS } from '../lexicon/words.js';
import { finding, inDialogue, type DetectorContext } from './context.js';

export const REPETITION_WINDOW = 40;

/** A light stem so "door" and "doors" count as the same word. */
export function stem(lower: string): string {
  let w = lower.replace(/['’]s$/, '');
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  return w;
}

/**
 * The same content word again within REPETITION_WINDOW words. Flags the later occurrence.
 * Skips stopwords, short words, capitalized names mid-sentence and dialogue.
 */
export function detectRepetition(ctx: DetectorContext): Finding[] {
  const { words, sentences } = ctx.seg;
  const sentenceStarts = new Set(sentences.map((s) => s.start));
  const out: Finding[] = [];
  const lastSeen = new Map<string, number[]>();
  words.forEach((w: WordToken, i) => {
    if (w.lower.length < 4 || STOPWORDS.has(w.lower) || /\d/.test(w.lower)) return;
    if (/^[A-Z]/.test(w.word) && !sentenceStarts.has(w.start)) return;
    if (inDialogue(ctx, w.start, w.end)) return;
    const key = stem(w.lower);
    const seen = (lastSeen.get(key) ?? []).filter((j) => i - j <= REPETITION_WINDOW);
    if (seen.length) {
      const gap = i - seen[seen.length - 1]!;
      const count = seen.length + 1;
      out.push(
        finding(ctx, 'repetition', w.start, w.end, `"${w.word}" again, ${gap} words after the last one${count > 2 ? ` (${count} times in ${REPETITION_WINDOW} words)` : ''}`, count > 2 ? 2 : 1, {
          kind: count > 2 ? 'cluster' : 'pair',
        }),
      );
    }
    seen.push(i);
    lastSeen.set(key, seen);
  });
  return out;
}
