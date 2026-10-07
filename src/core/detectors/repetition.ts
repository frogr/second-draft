import type { Finding, WordToken } from '../types.js';
import { STOPWORDS } from '../lexicon/words.js';
import { finding, inDialogue, type DetectorContext } from './context.js';

export const REPETITION_WINDOW = 40;

/** Words too common to signal a deliberate repeated phrase when they are the shared neighbor. */
const FUNCTION_WORDS = new Set(
  'a an the my his her their your our its of in on at to for from by with into onto over under and or but so as than that this these those is was were are be been i he she they we you it'.split(' '),
);

/**
 * Two occurrences are a deliberate repeated phrase ("every summer ... every summer", "gave way ... gave way")
 * when they share a neighbor that is not a function word.
 */
function repeatedPhrase(words: WordToken[], i: number, j: number): boolean {
  const same = (a?: WordToken, b?: WordToken) => !!a && !!b && a.lower === b.lower && !FUNCTION_WORDS.has(a.lower);
  return same(words[i - 1], words[j - 1]) || same(words[i + 1], words[j + 1]);
}

/** A light stem so "door" and "doors" count as the same word. */
export function stem(lower: string): string {
  let w = lower.replace(/['’]s$/, '');
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  return w;
}

/**
 * The same content word again within REPETITION_WINDOW words. Flags the later occurrence.
 * Skips stopwords, short words, names, dialogue and deliberate repeated phrases.
 */
export function detectRepetition(ctx: DetectorContext): Finding[] {
  const { words, sentences } = ctx.seg;
  const sentenceStarts = new Set(sentences.map((s) => s.start));
  const out: Finding[] = [];
  const lastSeen = new Map<string, number[]>();
  // a capitalized word that never appears in lower case is a name, even at the start of a sentence
  const lowerForms = new Set(words.filter((w) => !/^[A-Z]/.test(w.word)).map((w) => w.lower));
  words.forEach((w: WordToken, i) => {
    if (w.lower.length < 4 || STOPWORDS.has(w.lower) || /\d/.test(w.lower)) return;
    if (/^[A-Z]/.test(w.word) && (!sentenceStarts.has(w.start) || !lowerForms.has(w.lower))) return;
    if (inDialogue(ctx, w.start, w.end)) return;
    const key = stem(w.lower);
    const seen = (lastSeen.get(key) ?? []).filter((j) => i - j <= REPETITION_WINDOW);
    if (seen.length && repeatedPhrase(words, seen[seen.length - 1]!, i)) {
      // deliberate: do not flag, but remember this occurrence
    } else if (seen.length) {
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
