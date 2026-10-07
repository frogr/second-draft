import type { Finding } from '../types.js';
import { syllables, tokenizeWords } from '../text.js';
import { finding, inDialogue, type DetectorContext } from './context.js';

const NOMINAL = /(?:tion|sion|ment|ance|ence|ity|ness|ism)s?$/;

export function sentenceStats(text: string) {
  const words = tokenizeWords(text).filter((w) => /[a-z]/i.test(w.word));
  const syl = words.map((w) => syllables(w.word));
  const complex = syl.filter((n) => n >= 3).length;
  const nominal = words.filter((w) => w.lower.length >= 7 && NOMINAL.test(w.lower)).length;
  const total = syl.reduce((a, b) => a + b, 0);
  return { words: words.length, syllablesPerWord: words.length ? total / words.length : 0, complexRatio: words.length ? complex / words.length : 0, nominal };
}

/** Sentences packed with long words or abstract nouns ("the implementation of the optimization"). */
export function detectReadability(ctx: DetectorContext): Finding[] {
  const out: Finding[] = [];
  for (const s of ctx.seg.sentences) {
    if (inDialogue(ctx, s.start, s.end)) continue;
    const st = sentenceStats(s.text);
    if (st.words < 12) continue;
    if (st.nominal >= 4) {
      out.push(finding(ctx, 'readability', s.start, s.end, `${st.nominal} abstract nouns (-tion, -ment, -ity...) in one sentence; turn some back into verbs`, 2, { kind: 'nominalization' }));
    } else if (st.syllablesPerWord >= 1.75 && st.complexRatio >= 0.25) {
      out.push(finding(ctx, 'readability', s.start, s.end, `${Math.round(st.complexRatio * 100)}% of the words have three or more syllables`, 2, { kind: 'dense' }));
    }
  }
  return out;
}
