import type { DetectorId, Finding, Severity } from '../types.js';
import { inRanges, quotedRanges, segment, sentenceAt, type Segmented } from '../text.js';

export interface DetectorContext {
  seg: Segmented;
  /** Character ranges inside quotation marks. Most prose detectors skip dialogue: it is the character's voice. */
  quotes: Array<[number, number]>;
}

export function makeContext(text: string): DetectorContext {
  return { seg: segment(text), quotes: quotedRanges(text) };
}

export function inDialogue(ctx: DetectorContext, start: number, end: number): boolean {
  return inRanges(ctx.quotes, start, end);
}

export function finding(
  ctx: DetectorContext,
  detector: DetectorId,
  start: number,
  end: number,
  message: string,
  severity: Severity,
  extra: { kind?: string; replacement?: string } = {},
): Finding {
  const f: Finding = {
    detector,
    start,
    end,
    text: ctx.seg.text.slice(start, end),
    message,
    severity,
    sentenceIndex: sentenceAt(ctx.seg.sentences, start),
  };
  if (extra.kind !== undefined) f.kind = extra.kind;
  if (extra.replacement !== undefined) f.replacement = extra.replacement;
  return f;
}

/** Compile a lower-case phrase into a whole-word, whitespace-tolerant, case-insensitive regex. */
export function phraseRegex(pattern: string): RegExp {
  const body = pattern.replace(/'/g, "['’]").replace(/ /g, '\\s+');
  return new RegExp(`(?<![\\w'’-])${body}(?![\\w'’-])`, 'gi');
}

export function allMatches(re: RegExp, text: string): RegExpExecArray[] {
  re.lastIndex = 0;
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(m);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}
