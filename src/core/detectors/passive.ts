import type { Finding } from '../types.js';
import { BE_FORMS, IRREGULAR_PARTICIPLES, LY_STOPLIST, STATIVE_PARTICIPLES } from '../lexicon/words.js';
import { finding, inDialogue, type DetectorContext } from './context.js';

const BETWEEN = new Set(['not', 'never', 'also', 'just', 'already', 'still', 'often', 'always', 'then', 'all', 'soon', 'later', 'being', 'been', 'quickly', 'finally']);

export function isParticiple(word: string): boolean {
  if (IRREGULAR_PARTICIPLES[word]) return true;
  return word.length > 4 && word.endsWith('ed');
}

/**
 * Passive voice: a form of "to be", up to two short modifiers, then a past participle.
 * "She was tired" is a state, not a passive, unless an agent follows ("tired by the climb").
 */
export function detectPassive(ctx: DetectorContext): Finding[] {
  const { words, text } = ctx.seg;
  const out: Finding[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!BE_FORMS.has(words[i]!.lower)) continue;
    let j = i + 1;
    let hops = 0;
    while (j < words.length && hops < 3 && (BETWEEN.has(words[j]!.lower) || (words[j]!.lower.endsWith('ly') && !LY_STOPLIST.has(words[j]!.lower)))) {
      j++;
      hops++;
    }
    const p = words[j];
    if (!p || !isParticiple(p.lower)) continue;
    // every gap between the be-form and the participle must be plain whitespace (no comma, no sentence break)
    let clean = true;
    for (let k = i; k < j; k++) if (!/^\s+$/.test(text.slice(words[k]!.end, words[k + 1]!.start))) clean = false;
    if (!clean) continue;
    const next = words[j + 1];
    const byAgent = !!next && next.lower === 'by' && /^\s+$/.test(text.slice(p.end, next.start));
    if (STATIVE_PARTICIPLES.has(p.lower) && !byAgent) continue;
    if (inDialogue(ctx, words[i]!.start, p.end)) continue;
    out.push(
      finding(ctx, 'passive', words[i]!.start, p.end, `"${text.slice(words[i]!.start, p.end)}" is passive${byAgent ? '; the doer comes after "by"' : '; the doer is missing'}`, 2, {
        kind: byAgent ? 'with_agent' : 'agentless',
      }),
    );
    i = j;
  }
  return out;
}
