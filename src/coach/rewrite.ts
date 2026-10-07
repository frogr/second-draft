import { IRREGULAR_PARTICIPLES } from '../core/lexicon/words.js';
import { capitalizeFirst, lowerFirst } from '../core/text.js';

export interface Edit {
  start: number;
  end: number;
  replacement: string;
}

const AN_EXCEPTIONS = /^(hour|honest|honor|honour|heir|unique|universit|user|use|usual|useful|one|once|euro|uni)/i;

/** Clean up spacing and punctuation left behind by cuts. */
export function tidy(s: string): string {
  let t = s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/,([.;:!?])/g, '$1')
    .replace(/^([\s"“(]*)[,;:]\s*/, '$1')
    .replace(/([“(]) +/g, '$1')
    .replace(/\b(a|an|the) (a|an|the) /gi, (_m, first: string, second: string) => `${first[0] === first[0]!.toUpperCase() ? second[0]!.toUpperCase() + second.slice(1) : second} `)
    .trim();
  t = t.replace(/\b(a|an|A|An) ([A-Za-z])([A-Za-z]*)/g, (m, art: string, c: string, rest: string) => {
    const word = c + rest;
    const wantAn = /[aeiou]/i.test(c) && !AN_EXCEPTIONS.test(word);
    const cap = art[0] === 'A';
    const fixed = wantAn ? (cap ? 'An' : 'an') : cap ? 'A' : 'a';
    return `${fixed} ${word}`;
  });
  return capitalizeFirst(t);
}

/** Apply non-overlapping edits (offsets relative to `text`), right to left, then tidy. */
export function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = text;
  let floor = Infinity;
  for (const e of sorted) {
    if (e.end > floor) continue; // overlaps an edit already applied
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
    floor = e.start;
  }
  return tidy(out);
}

export function pastTense(participle: string): string {
  const lower = participle.toLowerCase();
  return IRREGULAR_PARTICIPLES[lower] ?? participle;
}

const TO_OBJECT: Record<string, string> = { i: 'me', he: 'him', she: 'her', they: 'them', we: 'us' };
const TO_SUBJECT: Record<string, string> = { me: 'I', him: 'he', her: 'she', them: 'they', us: 'we' };
const AGENT_STOP = /^(in|on|at|during|after|before|for|with|from|to|last|yesterday|today|and|but|because|while|when|who|which|that)$/i;

/**
 * Rewrite a simple passive clause in active voice.
 * `sentence` is the full sentence, `be` and `participle` are offsets within it.
 * Returns null when the clause is not simple enough to rewrite safely.
 * With no agent, the doer becomes "[Who?]" and the result is a scaffold.
 */
export function activeVoice(sentence: string, beStart: number, partEnd: number): { text: string; scaffold: boolean } | null {
  const before = sentence.slice(0, beStart);
  let clauseStart = Math.max(before.lastIndexOf(', '), before.lastIndexOf('; '));
  clauseStart = clauseStart >= 0 ? clauseStart + 2 : 0;
  const conj = sentence.slice(clauseStart, beStart).match(/^(and|but|so|then|yet)\s+/i);
  if (conj) clauseStart += conj[0].length;
  const lead = sentence.slice(0, clauseStart);
  const subject = sentence.slice(clauseStart, beStart).trim();
  if (!subject || subject.split(/\s+/).length > 6 || /["“”]/.test(subject)) return null;
  const middle = sentence.slice(beStart, partEnd).split(/\s+/);
  const participle = middle[middle.length - 1]!.replace(/[^A-Za-z]/g, '');
  const adverbs = middle.slice(1, -1).filter((w) => !/^(been|being|be)$/i.test(w));
  let rest = sentence.slice(partEnd);
  let agent = '[Who?]';
  let scaffold = true;
  const by = rest.match(/^\s+by\s+/i);
  if (by) {
    const words = rest.slice(by[0].length).split(/(\s+)/);
    const taken: string[] = [];
    for (const w of words) {
      if (/^\s+$/.test(w)) {
        taken.push(w);
        continue;
      }
      const bare = w.replace(/[^A-Za-z'’-]/g, '');
      if (!bare || AGENT_STOP.test(bare) || taken.filter((x) => !/^\s+$/.test(x)).length >= 4) break;
      taken.push(w.replace(/[,.;:!?]+$/, ''));
      if (/[,.;:!?]$/.test(w)) break;
    }
    const agentText = taken.join('').trim();
    if (!agentText) return null;
    agent = TO_SUBJECT[agentText.toLowerCase()] ?? agentText;
    rest = rest.slice(by[0].length + agentText.length);
    scaffold = false;
  }
  const obj = TO_OBJECT[subject.toLowerCase()] ?? lowerFirst(subject);
  const verb = [...adverbs, pastTense(participle)].join(' ');
  const clause = `${agent} ${verb} ${obj}${rest}`;
  const text = lead ? `${lead}${clause.startsWith('[') ? clause : lowerFirst(clause)}` : capitalizeFirst(clause);
  return { text: tidy(text), scaffold };
}

/** Split a long sentence at the conjunction or semicolon closest to its middle. */
export function splitLong(sentence: string): string | null {
  const candidates: Array<{ at: number; len: number; joiner: string }> = [];
  const re = /(;\s+|,\s+(?:and|but|so|because|which|while)\s+|\s+—\s+|:\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    const word = m[0].match(/(and|but|so|because|which|while)/)?.[1];
    if (word === 'which' || word === 'while' || word === 'because') continue; // splitting these breaks the grammar
    // "but" and "so" carry meaning, so they start the new sentence; "and", ";", ":" and dashes become a full stop
    const joiner = word === 'but' || word === 'so' ? `${word[0]!.toUpperCase()}${word.slice(1)} ` : '';
    candidates.push({ at: m.index, len: m[0].length, joiner });
  }
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const total = words(sentence);
  let best: (typeof candidates)[number] | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const left = words(sentence.slice(0, c.at));
    if (left < 6 || total - left < 6) continue;
    const dist = Math.abs(left - total / 2);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  if (!best) return null;
  const left = sentence.slice(0, best.at).replace(/[,;:]\s*$/, '');
  const right = sentence.slice(best.at + best.len);
  return tidy(`${left}. ${best.joiner}${best.joiner ? right : capitalizeFirst(right)}`);
}

/** '"Fine," she smiled.' becomes '"Fine." She smiled.' Offsets are relative to the sentence. */
export function actionTagToBeat(sentence: string, verbStart: number): string | null {
  const quoteEnd = Math.max(sentence.lastIndexOf('"', verbStart), sentence.lastIndexOf('”', verbStart));
  if (quoteEnd < 1) return null;
  const punct = sentence[quoteEnd - 1];
  const speechEnd = punct === ',' ? '.' : punct;
  const head = sentence.slice(0, quoteEnd - 1) + speechEnd + sentence[quoteEnd];
  const tail = sentence.slice(quoteEnd + 1).trimStart();
  return tidy(`${head} ${capitalizeFirst(tail)}`);
}
