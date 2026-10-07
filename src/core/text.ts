import type { Paragraph, Sentence, WordToken } from './types.js';

const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*|\d+(?:[.,]\d+)*/g;

/** Titles that are never sentence ends when followed by a period. */
const TITLES = new Set([
  'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'st', 'sr', 'jr', 'gen', 'col', 'lt', 'capt', 'sgt',
  'rev', 'hon', 'mt', 'ft', 'vs', 'cf', 'approx', 'dept', 'est', 'fig', 'vol', 'inc', 'ltd', 'co',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);
/** Abbreviations that may legitimately end a sentence; break only before a capital. */
const SOFT_ABBREV = new Set(['etc', 'a.m', 'p.m', 'u.s', 'u.k', 'u.s.a', 'ph.d', 'b.a', 'm.a', 'b.s']);
/** Dotted abbreviations that never end a sentence. */
const HARD_DOTTED = new Set(['e.g', 'i.e', 'viz']);

const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '»']);
const TERMINALS = new Set(['.', '!', '?', '…']);

export function tokenizeWords(text: string, offset = 0): WordToken[] {
  const out: WordToken[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text))) {
    out.push({ word: m[0], lower: m[0].toLowerCase().replace(/’/g, "'"), start: m.index + offset, end: m.index + offset + m[0].length });
  }
  return out;
}

export function countWords(text: string): number {
  WORD_RE.lastIndex = 0;
  return (text.match(WORD_RE) ?? []).length;
}

function trimRange(text: string, start: number, end: number): [number, number] {
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return [start, end];
}

/**
 * Paragraphs are separated by blank lines. If the draft has no blank lines at all,
 * each non-empty line is a paragraph (common when pasting from chat apps).
 */
export function splitParagraphRanges(text: string): Array<[number, number]> {
  const separator = /\n[ \t]*\n/.test(text) ? /\n[ \t]*(?:\n[ \t]*)+/g : /\n/g;
  const ranges: Array<[number, number]> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  separator.lastIndex = 0;
  while ((m = separator.exec(text))) {
    ranges.push([last, m.index]);
    last = m.index + m[0].length;
  }
  ranges.push([last, text.length]);
  return ranges
    .map(([s, e]) => trimRange(text, s, e))
    .filter(([s, e]) => e > s && /[\p{L}\p{N}]/u.test(text.slice(s, e)));
}

function chunkBefore(text: string, i: number, floor: number): string {
  let j = i;
  while (j > floor && !/\s/.test(text[j - 1]!) && !'"“‘(['.includes(text[j - 1]!)) j--;
  return text.slice(j, i);
}

function isBreakStarter(ch: string | undefined): boolean {
  if (!ch) return true;
  if (/[0-9"“'‘(\[—–-]/.test(ch)) return true;
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

/** Split one paragraph range into sentence ranges. Handles abbreviations, initials, decimals, ellipses and dialogue. */
export function splitSentenceRanges(text: string, pStart: number, pEnd: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let sStart = pStart;
  let i = pStart;
  while (i < pEnd) {
    const c = text[i]!;
    if (!TERMINALS.has(c)) {
      i++;
      continue;
    }
    // consume the run of terminal punctuation ("?!", "...")
    let j = i;
    while (j < pEnd && TERMINALS.has(text[j]!)) j++;
    const run = text.slice(i, j);
    // consume closing quotes / brackets
    let k = j;
    while (k < pEnd && CLOSERS.has(text[k]!)) k++;
    if (k >= pEnd) {
      i = pEnd;
      break;
    }
    if (!/\s/.test(text[k]!)) {
      i = j; // "3.5", "U.S.A", "word.Next" without space: not a boundary
      continue;
    }
    let n = k;
    while (n < pEnd && /\s/.test(text[n]!)) n++;
    const next = text[n];
    let boundary = isBreakStarter(next);

    if (boundary && run === '.') {
      const chunk = chunkBefore(text, i, sStart);
      const lower = chunk.toLowerCase();
      if (TITLES.has(lower)) boundary = false;
      else if (HARD_DOTTED.has(lower)) boundary = false;
      else if (/^[A-Z]$/.test(chunk) && chunk !== 'I' && chunk !== 'A' && /^[A-Z]/.test(next ?? '')) {
        // an initial, as in "J. R. R. Tolkien"
        boundary = false;
      } else if (SOFT_ABBREV.has(lower)) {
        boundary = /^[A-Z]/.test(next ?? '');
      }
    }
    if (boundary) {
      const [s, e] = trimRange(text, sStart, k);
      if (e > s) out.push([s, e]);
      sStart = k;
    }
    i = k;
  }
  const [s, e] = trimRange(text, sStart, pEnd);
  if (e > s && /[\p{L}\p{N}]/u.test(text.slice(s, e))) out.push([s, e]);
  else if (e > s && out.length) out[out.length - 1] = [out[out.length - 1]![0], e];
  return out;
}

export interface Segmented {
  text: string;
  paragraphs: Paragraph[];
  sentences: Sentence[];
  words: WordToken[];
}

export function segment(text: string): Segmented {
  const paragraphs: Paragraph[] = [];
  const sentences: Sentence[] = [];
  splitParagraphRanges(text).forEach(([ps, pe], pIndex) => {
    const idxs: number[] = [];
    for (const [s, e] of splitSentenceRanges(text, ps, pe)) {
      const st = text.slice(s, e);
      idxs.push(sentences.length);
      sentences.push({ index: sentences.length, start: s, end: e, text: st, paragraphIndex: pIndex, wordCount: countWords(st) });
    }
    const pt = text.slice(ps, pe);
    paragraphs.push({ index: pIndex, start: ps, end: pe, text: pt, sentenceIndexes: idxs, wordCount: countWords(pt) });
  });
  return { text, paragraphs, sentences, words: tokenizeWords(text) };
}

/** Index of the sentence containing offset, or -1. Binary search. */
export function sentenceAt(sentences: Sentence[], offset: number): number {
  let lo = 0;
  let hi = sentences.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = sentences[mid]!;
    if (offset < s.start) hi = mid - 1;
    else if (offset >= s.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Ranges of text inside quotation marks (dialogue). Straight quotes toggle within a paragraph. */
export function quotedRanges(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [ps, pe] of splitParagraphRanges(text)) {
    let open = -1;
    for (let i = ps; i < pe; i++) {
      const c = text[i];
      if (c === '“') open = i;
      else if (c === '”' && open >= 0) {
        out.push([open, i + 1]);
        open = -1;
      } else if (c === '"') {
        if (open < 0) open = i;
        else {
          out.push([open, i + 1]);
          open = -1;
        }
      }
    }
  }
  return out;
}

export function inRanges(ranges: Array<[number, number]>, start: number, end: number): boolean {
  return ranges.some(([s, e]) => start >= s && end <= e);
}

/** Heuristic English syllable counter (good to roughly +/-1 per word, which is what Flesch-Kincaid assumes). */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const special: Record<string, number> = {
    every: 2, everything: 3, everyone: 3, different: 3, business: 2, people: 2, little: 2, idea: 3,
    really: 2, area: 3, being: 2, create: 2, created: 3, quiet: 2, science: 2, poem: 2, real: 1,
    fire: 1, hour: 1, our: 1, toward: 2, towards: 2, whole: 1, simile: 3, recipe: 3,
  };
  if (special[w] !== undefined) return special[w]!;
  w = w.replace(/(?:[^laeiouy]es|(?<![td])ed|[^laeiouy]e)$/, (m) => (m.length === 3 ? m[0]! : m === 'ed' ? '' : m[0]!));
  w = w.replace(/^y/, '');
  const groups = w.match(/[aeiouy]+/g);
  const n = groups ? groups.length : 1;
  return Math.max(1, n);
}

export function capitalizeFirst(s: string): string {
  const i = s.search(/[A-Za-z]/);
  if (i < 0) return s;
  return s.slice(0, i) + s[i]!.toUpperCase() + s.slice(i + 1);
}

export function lowerFirst(s: string, keep: Set<string> = new Set()): string {
  const m = s.match(/^([^A-Za-z]*)([A-Za-z][\w'’]*)/);
  if (!m) return s;
  const word = m[2]!;
  if (word === 'I' || word.startsWith("I'") || word.startsWith('I’') || keep.has(word) || /^[A-Z]{2,}$/.test(word)) return s;
  return m[1] + word[0]!.toLowerCase() + s.slice(m[1]!.length + 1);
}
