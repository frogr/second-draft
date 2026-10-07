import type { Finding } from '../types.js';
import { FANCY_SPEECH_VERBS, FILLER_WORDS, LY_STOPLIST, NEUTRAL_SPEECH_VERBS, NON_SPEECH_VERBS } from '../lexicon/words.js';
import { finding, inDialogue, type DetectorContext } from './context.js';

export function isAdverb(lower: string): boolean {
  return lower.length >= 5 && lower.endsWith('ly') && !LY_STOPLIST.has(lower) && !FILLER_WORDS.has(lower);
}

function isTagVerb(lower: string): boolean {
  return NEUTRAL_SPEECH_VERBS.has(lower) || FANCY_SPEECH_VERBS.has(lower) || NON_SPEECH_VERBS.has(lower);
}

/**
 * -ly adverbs outside dialogue. Adverbs on dialogue tags belong to the dialogue tag detector.
 * Kinds: "verb_adverb" (next to a past-tense verb: a sharper verb could do both jobs),
 * "opener" ("Suddenly, ..."), "ly" (everything else).
 */
export function detectAdverbs(ctx: DetectorContext): Finding[] {
  const { words, text, sentences } = ctx.seg;
  const sentenceStarts = new Set(sentences.map((s) => s.start));
  const out: Finding[] = [];
  words.forEach((w, i) => {
    if (!isAdverb(w.lower)) return;
    if (inDialogue(ctx, w.start, w.end)) return;
    const atStart = sentenceStarts.has(w.start) || /^["“(]$/.test(text.slice(w.start - 1, w.start));
    if (!atStart && /^[A-Z]/.test(w.word)) return; // a name like "Kimberly"
    const prev = words[i - 1];
    const next = words[i + 1];
    if (prev && isTagVerb(prev.lower)) return;
    if (prev && next && isTagVerb(next.lower)) return;
    if (atStart && text[w.end] === ',') {
      out.push(finding(ctx, 'adverb', w.start, w.end + 1, `"${w.word}," opens the sentence; the action can carry the surprise`, 1, { kind: 'opener', replacement: '' }));
      return;
    }
    const nearVerb = (prev && /ed$/.test(prev.lower) && /^\s+$/.test(text.slice(prev.end, w.start))) || (next && /ed$/.test(next.lower) && /^\s+$/.test(text.slice(w.end, next.start)));
    if (nearVerb) {
      out.push(finding(ctx, 'adverb', w.start, w.end, `"${w.word}" props up the verb; a sharper verb could do both jobs`, 2, { kind: 'verb_adverb' }));
    } else {
      out.push(finding(ctx, 'adverb', w.start, w.end, `"${w.word}" (adverb); check whether the sentence needs it`, 1, { kind: 'ly', replacement: '' }));
    }
  });
  return out;
}
