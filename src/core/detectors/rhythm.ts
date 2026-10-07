import type { Finding } from '../types.js';
import { finding, inDialogue, type DetectorContext } from './context.js';

export const LONG_SENTENCE = 30;
export const VERY_LONG_SENTENCE = 40;
export const MONOTONE_RUN = 4;
export const MONOTONE_SPREAD = 4;
export const WALL_PARAGRAPH = 160;

/** Long sentences, and runs of sentences that all have nearly the same length. */
export function detectSentenceLength(ctx: DetectorContext): Finding[] {
  const { sentences } = ctx.seg;
  const out: Finding[] = [];
  for (const s of sentences) {
    if (s.wordCount >= LONG_SENTENCE && !inDialogue(ctx, s.start, s.end)) {
      out.push(finding(ctx, 'sentence_length', s.start, s.end, `${s.wordCount} words in one sentence`, s.wordCount >= VERY_LONG_SENTENCE ? 3 : 2, { kind: 'long' }));
    }
  }
  let runStart = 0;
  const flush = (endExclusive: number) => {
    if (endExclusive - runStart >= MONOTONE_RUN) {
      const first = sentences[runStart]!;
      const last = sentences[endExclusive - 1]!;
      const counts = sentences.slice(runStart, endExclusive).map((s) => s.wordCount);
      out.push(finding(ctx, 'sentence_length', first.start, last.end, `${counts.length} sentences in a row of ${Math.min(...counts)} to ${Math.max(...counts)} words; the beat goes flat`, 1, { kind: 'monotone' }));
    }
  };
  for (let i = 1; i <= sentences.length; i++) {
    const run = sentences.slice(runStart, i + 1).map((s) => s.wordCount);
    const ok = i < sentences.length && sentences[i]!.wordCount >= 6 && sentences[runStart]!.wordCount >= 6 && Math.max(...run) - Math.min(...run) <= MONOTONE_SPREAD;
    if (!ok) {
      flush(i);
      runStart = i;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Paragraphs that are walls of text, and long runs of one-line narration paragraphs. */
export function detectParagraphRhythm(ctx: DetectorContext): Finding[] {
  const { paragraphs, text } = ctx.seg;
  const out: Finding[] = [];
  for (const p of paragraphs) {
    if (p.wordCount > WALL_PARAGRAPH) {
      out.push(finding(ctx, 'paragraph_rhythm', p.start, p.end, `${p.wordCount}-word paragraph; readers lose their place`, p.wordCount > 250 ? 3 : 2, { kind: 'wall' }));
    }
  }
  const choppy = (i: number) => {
    const p = paragraphs[i]!;
    return p.sentenceIndexes.length === 1 && p.wordCount < 25 && !/["“”]/.test(text.slice(p.start, p.end));
  };
  let i = 0;
  while (i < paragraphs.length) {
    if (!choppy(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < paragraphs.length && choppy(j + 1)) j++;
    if (j - i + 1 >= 4) {
      out.push(finding(ctx, 'paragraph_rhythm', paragraphs[i]!.start, paragraphs[j]!.end, `${j - i + 1} one-sentence paragraphs in a row; the emphasis wears out`, 1, { kind: 'choppy' }));
    }
    i = j + 1;
  }
  return out.sort((a, b) => a.start - b.start);
}
