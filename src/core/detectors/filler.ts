import type { Finding } from '../types.js';
import { FILLER_WORDS, HEDGE_PHRASES, KIND_OF_DETERMINERS, WORDY_PHRASES } from '../lexicon/words.js';
import { allMatches, finding, inDialogue, phraseRegex, type DetectorContext } from './context.js';
import { keepLongest } from './overlap.js';

const HEDGES = HEDGE_PHRASES.map((h) => ({ ...h, re: phraseRegex(h.pattern) }));
const WORDY = WORDY_PHRASES.map((h) => ({ ...h, re: phraseRegex(h.pattern) }));

function prevWord(text: string, start: number): string {
  const m = text.slice(Math.max(0, start - 30), start).match(/([A-Za-z'’]+)\s*$/);
  return m ? m[1]!.toLowerCase() : '';
}
function nextWord(text: string, end: number): string {
  const m = text.slice(end, end + 30).match(/^\s*([A-Za-z'’]+)/);
  return m ? m[1]!.toLowerCase() : '';
}

/** Filler words, hedges ("I think", "sort of") and wordy phrases ("in order to"). Dialogue is skipped. */
export function detectFiller(ctx: DetectorContext): Finding[] {
  const { text, words } = ctx.seg;
  const out: Finding[] = [];
  for (const w of words) {
    if (!FILLER_WORDS.has(w.lower)) continue;
    if (inDialogue(ctx, w.start, w.end)) continue;
    const prev = prevWord(text, w.start);
    const next = nextWord(text, w.end);
    if (w.lower === 'just' && (prev === 'a' || next === 'as' || next === 'in')) continue; // "a just cause", "just as", "just in time"
    if (w.lower === 'rather' && next === 'than') continue;
    if (w.lower === 'very' && ['the', 'this', 'that', 'his', 'her', 'their', 'my', 'your', 'our'].includes(prev)) continue; // "the very thing"
    if (w.lower === 'super' && w.word[0] === 'S') continue;
    out.push(finding(ctx, 'filler', w.start, w.end, `"${w.word}" adds little; try cutting it`, 1, { kind: 'filler', replacement: '' }));
  }
  for (const h of HEDGES) {
    for (const m of allMatches(h.re, text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (inDialogue(ctx, start, end)) continue;
      if (/^(kind|sort) of$/i.test(m[0].replace(/\s+/g, ' ')) && KIND_OF_DETERMINERS.has(prevWord(text, start))) continue;
      const strong = /^i |opinion/i.test(m[0]);
      out.push(finding(ctx, 'filler', start, end, `"${m[0]}" hedges the claim`, strong ? 2 : 1, { kind: 'hedge', replacement: h.replacement }));
    }
  }
  for (const h of WORDY) {
    for (const m of allMatches(h.re, text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (inDialogue(ctx, start, end)) continue;
      const msg = h.replacement ? `"${m[0]}" can be "${h.replacement}"` : `"${m[0]}" can be cut`;
      out.push(finding(ctx, 'filler', start, end, msg, 1, { kind: 'wordy', replacement: h.replacement }));
    }
  }
  return keepLongest(out);
}
