import type { Finding } from '../types.js';
import { FANCY_SPEECH_VERBS, LY_STOPLIST, NEUTRAL_SPEECH_VERBS, NON_SPEECH_VERBS } from '../lexicon/words.js';
import { finding, type DetectorContext } from './context.js';

const SPEAKER = String.raw`(?:he|she|they|i|we|you|it|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)`;
const VERB = String.raw`([A-Za-z]+)`;
const ADV = String.raw`(?:\s+([a-z]+ly))?`;
// after a quote: "Fine," she said quietly.   /   "Fine," said Maya.
const AFTER_SPEAKER_VERB = new RegExp(String.raw`^\s+(${SPEAKER})\s+${VERB}${ADV}\b`);
const AFTER_VERB_SPEAKER = new RegExp(String.raw`^\s+${VERB}\s+(${SPEAKER})${ADV}\b`);
// before a quote: She hissed, "Fine."
const BEFORE = new RegExp(String.raw`(?:^|[.!?]\s+|\n)(${SPEAKER})\s+${VERB}${ADV},\s*$`);

type Tag = { verbStart: number; verb: string; advStart?: number; adv?: string };

function classify(ctx: DetectorContext, tag: Tag, closingPunct: string): Finding[] {
  const out: Finding[] = [];
  const lower = tag.verb.toLowerCase();
  const end = tag.verbStart + tag.verb.length;
  if (FANCY_SPEECH_VERBS.has(lower)) {
    out.push(finding(ctx, 'dialogue_tag', tag.verbStart, end, `"${tag.verb}" draws the eye from the line; "said" disappears`, 2, { kind: 'fancy_tag', replacement: 'said' }));
  } else if (NON_SPEECH_VERBS.has(lower) && closingPunct === ',') {
    out.push(finding(ctx, 'dialogue_tag', tag.verbStart, end, `nobody can "${tag.verb}" words; make it a separate action`, 2, { kind: 'action_tag' }));
  } else if (!NEUTRAL_SPEECH_VERBS.has(lower)) {
    return out;
  }
  if (tag.adv && tag.advStart !== undefined && !LY_STOPLIST.has(tag.adv.toLowerCase())) {
    const text = ctx.seg.text;
    // include the space before the adverb so cutting it leaves clean text
    let s = tag.advStart;
    while (s > 0 && text[s - 1] === ' ') s--;
    out.push(finding(ctx, 'dialogue_tag', s, tag.advStart + tag.adv.length, `"${tag.verb} ${tag.adv}": let the line carry the tone`, 2, { kind: 'adverb_tag', replacement: '' }));
  }
  return out;
}

/** Dialogue tags: showy verbs ("hissed"), adverbs on tags ("said angrily"), and actions used as tags ("she smiled"). */
export function detectDialogueTags(ctx: DetectorContext): Finding[] {
  const { text } = ctx.seg;
  const out: Finding[] = [];
  for (const [qs, qe] of ctx.quotes) {
    const inside = text.slice(qs + 1, qe - 1).trimEnd();
    const closing = inside.slice(-1);
    const after = text.slice(qe, qe + 60).split('\n')[0]!;
    if (/[,!?—–-]/.test(closing)) {
      let m = AFTER_SPEAKER_VERB.exec(after);
      let tag: Tag | null = null;
      if (m) {
        const verbStart = qe + m[0].indexOf(m[2]!, m[0].indexOf(m[1]!) + m[1]!.length);
        tag = { verbStart, verb: m[2]! };
        if (m[3]) tag = { ...tag, adv: m[3], advStart: qe + m[0].lastIndexOf(m[3]) };
      } else if ((m = AFTER_VERB_SPEAKER.exec(after))) {
        const verbStart = qe + m[0].indexOf(m[1]!);
        tag = { verbStart, verb: m[1]! };
        if (m[3]) tag = { ...tag, adv: m[3], advStart: qe + m[0].lastIndexOf(m[3]) };
      }
      if (tag) out.push(...classify(ctx, tag, closing));
    }
    const before = text.slice(Math.max(0, qs - 60), qs);
    const b = BEFORE.exec(before);
    if (b) {
      const base = qs - before.length + b.index;
      const verbStart = base + b[0].indexOf(b[2]!, b[0].indexOf(b[1]!) + b[1]!.length);
      let tag: Tag = { verbStart, verb: b[2]! };
      if (b[3]) tag = { ...tag, adv: b[3], advStart: base + b[0].lastIndexOf(b[3]) };
      out.push(...classify(ctx, tag, '.'));
    }
  }
  const seen = new Set<string>();
  return out
    .filter((f) => (seen.has(`${f.start}:${f.kind}`) ? false : (seen.add(`${f.start}:${f.kind}`), true)))
    .sort((a, b) => a.start - b.start);
}
