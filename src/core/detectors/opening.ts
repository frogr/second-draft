import type { Finding } from '../types.js';
import { GENERIC_OPENING_RE, THROAT_CLEARING_RE, WAKING_RE, WEATHER_WORDS } from '../lexicon/words.js';
import { finding, type DetectorContext } from './context.js';

/** Checks only the first sentence. At most one finding, the most important one. */
export function detectOpening(ctx: DetectorContext): Finding[] {
  // skip a salutation line like "Dear Hiring Manager," and judge the first real sentence
  const [s0, s1] = ctx.seg.sentences;
  const first = s0 && s1 && /^(dear|hi|hello|hey|to whom)\b.{0,60}$/i.test(s0.text) && s0.wordCount <= 6 ? s1 : s0;
  if (!first) return [];
  const t = first.text;
  const f = (kind: string, msg: string, sev: 1 | 2 | 3) => [finding(ctx, 'opening', first.start, first.end, msg, sev, { kind })];
  if (GENERIC_OPENING_RE.test(t)) return f('generic', 'The first sentence is a stock opening; readers decide here whether to keep going', 3);
  if (WAKING_RE.test(t)) return f('waking', 'Opening on a character waking up delays the story', 2);
  if (WEATHER_WORDS.test(t) && first.wordCount <= 25 && !/["“]/.test(t)) return f('weather', 'Opening on the weather delays the story', 2);
  if (THROAT_CLEARING_RE.test(t)) return f('throat_clearing', 'The first sentence starts with "there is" or "it was"; lead with the subject', 1);
  if (first.wordCount >= 35) return f('long', `The first sentence is ${first.wordCount} words; give the reader a shorter way in`, 2);
  return [];
}
