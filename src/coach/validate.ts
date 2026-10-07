import type { Sentence } from '../core/types.js';
import { DETECTOR_IDS, type DetectorId } from '../core/types.js';
import type { CoachingItem } from './types.js';

/** What the model submits through the submit_coaching tool, before validation. */
export interface SubmittedItem {
  sentence_index: number;
  quote: string;
  rewrite: string;
  title: string;
  why: string;
  exercise: string;
  detector: string;
}

export type ValidationCode =
  | 'not_an_object'
  | 'missing_field'
  | 'sentence_out_of_range'
  | 'quote_not_in_sentence'
  | 'quote_empty'
  | 'rewrite_same'
  | 'rewrite_too_long'
  | 'field_too_long'
  | 'duplicate_span'
  | 'too_many_items';

export interface ValidationError {
  item: number;
  code: ValidationCode;
  message: string;
}

export interface ValidationResult {
  valid: CoachingItem[];
  errors: ValidationError[];
}

export const MAX_ITEMS = 3;
const LIMITS = { title: 80, why: 700, exercise: 500 };

/** Lower case, straight quotes, no punctuation, single spaces. Used only to decide "is the rewrite really different". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function straighten(s: string): string {
  return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
}

/**
 * Check every submitted item against the draft. An item survives only if:
 * - sentence_index names a real sentence,
 * - quote appears verbatim inside that sentence (offsets are computed from it, never trusted from the model),
 * - rewrite is non-empty, not a copy of the quote, and not absurdly long,
 * - title, why and exercise are present and within length limits,
 * - it does not cite the same span as an earlier valid item.
 * Errors carry a hint the model can act on in its one repair turn.
 */
export function validateItems(raw: unknown, sentences: Sentence[]): ValidationResult {
  const errors: ValidationError[] = [];
  const valid: CoachingItem[] = [];
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > MAX_ITEMS) errors.push({ item: MAX_ITEMS, code: 'too_many_items', message: `Only ${MAX_ITEMS} items are allowed; items after the third were ignored.` });
  list.slice(0, MAX_ITEMS).forEach((value, i) => {
    const err = (code: ValidationCode, message: string) => errors.push({ item: i, code, message });
    if (!value || typeof value !== 'object') return err('not_an_object', 'Each item must be an object.');
    const it = value as Partial<SubmittedItem>;
    for (const k of ['quote', 'rewrite', 'title', 'why', 'exercise'] as const) {
      if (typeof it[k] !== 'string') return err('missing_field', `"${k}" must be a string.`);
    }
    if (typeof it.sentence_index !== 'number' || !Number.isInteger(it.sentence_index)) return err('missing_field', '"sentence_index" must be an integer.');
    const s = sentences[it.sentence_index];
    if (!s) return err('sentence_out_of_range', `sentence_index ${it.sentence_index} does not exist; valid indexes are 0 to ${sentences.length - 1}.`);
    const quote = it.quote!;
    if (!quote.trim()) return err('quote_empty', 'quote is empty.');
    const at = s.text.indexOf(quote);
    if (at < 0) {
      const elsewhere = sentences.find((x) => x.text.includes(quote));
      const curly = s.text.includes(quote) ? false : straighten(s.text).includes(straighten(quote));
      const hint = elsewhere ? ` It does appear in sentence ${elsewhere.index}.` : curly ? ' It matches only after normalizing quote marks; copy the characters exactly.' : ' Copy it character for character from get_sentences.';
      return err('quote_not_in_sentence', `quote is not a verbatim part of sentence ${s.index}.${hint}`);
    }
    const rewrite = it.rewrite!;
    if (!rewrite.trim() || normalize(rewrite) === normalize(quote)) return err('rewrite_same', 'rewrite must change the quoted text.');
    if (rewrite.length > quote.length * 3 + 200) return err('rewrite_too_long', 'rewrite is far longer than the quote; rewrite only the quoted text.');
    for (const k of ['title', 'why', 'exercise'] as const) {
      const v = it[k]!.trim();
      if (!v) return err('missing_field', `"${k}" is empty.`);
      if (v.length > LIMITS[k]) return err('field_too_long', `"${k}" is over ${LIMITS[k]} characters.`);
    }
    const start = s.start + at;
    const end = start + quote.length;
    if (valid.some((v) => start < v.end && v.start < end)) return err('duplicate_span', 'another item already covers this text; pick a different sentence.');
    const detector = (DETECTOR_IDS as string[]).includes(it.detector ?? '') ? (it.detector as DetectorId) : 'other';
    valid.push({
      rank: valid.length + 1,
      title: it.title!.trim(),
      detector,
      sentenceIndex: s.index,
      start,
      end,
      before: quote,
      after: rewrite.trim(),
      afterKind: /\[[^\]]+\]/.test(rewrite) ? 'scaffold' : 'rewrite',
      why: it.why!.trim(),
      exercise: it.exercise!.trim(),
      source: 'model',
    });
  });
  return { valid, errors };
}

/** Check a finished item list against the draft text itself. Used as a last guard before anything reaches the UI. */
export function assertAnchored(draft: string, items: CoachingItem[]): boolean {
  return items.every((i) => draft.slice(i.start, i.end) === i.before);
}
