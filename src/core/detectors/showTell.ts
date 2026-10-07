import type { Finding } from '../types.js';
import { EMOTION_ADJECTIVES, EMOTION_NOUNS, INTENSIFIERS, TELLING_LINKS } from '../lexicon/words.js';
import { allMatches, finding, inDialogue, type DetectorContext } from './context.js';
import { keepLongest } from './overlap.js';

const NOUNS = [...EMOTION_NOUNS].join('|');
const NOUN_PATTERNS = [
  new RegExp(String.raw`\b(?:felt|feel|feels|feeling)\s+(?:a\s+(?:sense|wave|surge|pang|rush|flood|stab|twinge)\s+of\s+|a\s+|so\s+much\s+)?(?:${NOUNS})\b`, 'gi'),
  new RegExp(String.raw`\b(?:a|the)\s+(?:wave|surge|pang|rush|flood|stab|twinge|sense)\s+of\s+(?:${NOUNS})\b`, 'gi'),
  new RegExp(String.raw`\b(?:filled|overcome|consumed|overwhelmed|seized)\s+(?:with|by)\s+(?:${NOUNS})\b`, 'gi'),
  new RegExp(String.raw`\b(?:${NOUNS})\s+(?:washed|flooded|surged|coursed|welled|bubbled)\b`, 'gi'),
];

/** Naming an emotion instead of showing it: "she was angry", "felt a wave of relief". Dialogue is skipped. */
export function detectShowTell(ctx: DetectorContext): Finding[] {
  const { words, text } = ctx.seg;
  const out: Finding[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const link = w.lower.replace(/^.*'(m|re)$/, "'$1");
    const isLink = TELLING_LINKS.has(w.lower) || TELLING_LINKS.has(link);
    if (!isLink) continue;
    let j = i + 1;
    while (j < words.length && j - i <= 3 && INTENSIFIERS.has(words[j]!.lower)) j++;
    const e = words[j];
    if (!e || !EMOTION_ADJECTIVES.has(e.lower)) continue;
    if (/[.!?;:,]/.test(text.slice(w.end, e.start))) continue;
    if (inDialogue(ctx, w.start, e.end)) continue;
    out.push(finding(ctx, 'show_tell', w.start, e.end, `"${text.slice(w.start, e.end)}" names the feeling; show what it looks like`, 2, { kind: 'adjective' }));
  }
  for (const re of NOUN_PATTERNS) {
    for (const m of allMatches(re, text)) {
      if (inDialogue(ctx, m.index, m.index + m[0].length)) continue;
      out.push(finding(ctx, 'show_tell', m.index, m.index + m[0].length, `"${m[0]}" names the feeling; show what it does to the body or the room`, 2, { kind: 'noun' }));
    }
  }
  return keepLongest(out);
}
