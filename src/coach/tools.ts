import { analyze } from '../core/analyze.js';
import { compareMetrics } from '../core/compare.js';
import type { Analysis } from '../core/types.js';
import { DETECTOR_IDS } from '../core/types.js';
import { scoreFinding } from './deterministic.js';
import type { Goal } from './types.js';
import { MAX_ITEMS } from './validate.js';

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const detectorEnum = { type: 'string', enum: [...DETECTOR_IDS] };

export const SUBMIT_TOOL = 'submit_coaching';

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'analyze_draft',
    description: 'Run every deterministic detector on the current draft. Returns metrics, counts per detector and the 15 findings with the highest leverage for the writer\'s goal. Call this first.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_findings',
    description: 'List findings, optionally for one detector. Each has the sentence_index it sits in, the exact text and character offsets.',
    input_schema: {
      type: 'object',
      properties: { detector: detectorEnum, limit: { type: 'integer', minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_sentences',
    description: 'Return sentences by index range (inclusive, at most 15 per call), with exact text and offsets. Quotes in submit_coaching must be copied from this text character for character.',
    input_schema: {
      type: 'object',
      properties: { start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 0 } },
      required: ['start', 'end'],
      additionalProperties: false,
    },
  },
  {
    name: 'compare_drafts',
    description: 'Compare metrics between two drafts: "previous" (the writer\'s last saved draft, if any) and "current". Use it to say what improved.',
    input_schema: {
      type: 'object',
      properties: { a: { type: 'string', enum: ['previous', 'current'] }, b: { type: 'string', enum: ['previous', 'current'] } },
      required: ['a', 'b'],
      additionalProperties: false,
    },
  },
  {
    name: SUBMIT_TOOL,
    description: `Finish by submitting at most ${MAX_ITEMS} coaching items, highest leverage first. Each item must quote text that exists verbatim inside the sentence at sentence_index. The rewrite replaces only the quoted text. Items that fail validation are returned once for repair, then dropped.`,
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Two or three plain sentences on the draft overall.' },
        items: {
          type: 'array',
          maxItems: MAX_ITEMS,
          items: {
            type: 'object',
            properties: {
              sentence_index: { type: 'integer' },
              quote: { type: 'string', description: 'Exact text from that sentence: the whole sentence or a part of it.' },
              rewrite: { type: 'string', description: 'The improved version of the quote. Use [brackets] only for something only the writer can supply.' },
              title: { type: 'string', description: 'Short imperative title, under 8 words.' },
              why: { type: 'string', description: 'Why this matters for this writer and goal. Plain, specific, under 80 words.' },
              exercise: { type: 'string', description: 'A small practice task tied to this draft.' },
              detector: { type: 'string', enum: [...DETECTOR_IDS, 'other'] },
            },
            required: ['sentence_index', 'quote', 'rewrite', 'title', 'why', 'exercise', 'detector'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'items'],
      additionalProperties: false,
    },
  },
];

export interface ToolContext {
  draft: string;
  goal: Goal;
  analysis: Analysis;
  previous?: { text: string; analysis: Analysis };
}

export function makeToolContext(draft: string, goal: Goal, previousDraft?: string): ToolContext {
  const ctx: ToolContext = { draft, goal, analysis: analyze(draft) };
  if (previousDraft && previousDraft.trim()) ctx.previous = { text: previousDraft, analysis: analyze(previousDraft) };
  return ctx;
}

export interface ToolOutput {
  ok: boolean;
  content: string;
  summary: string;
}

const slim = (f: Analysis['findings'][number]) => ({ detector: f.detector, kind: f.kind, sentence_index: f.sentenceIndex, text: f.text, message: f.message, start: f.start, end: f.end });

/** Execute a read-only tool. submit_coaching is handled by the agent loop, not here. */
export function runTool(ctx: ToolContext, name: string, args: unknown): ToolOutput {
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>;
  const ok = (value: unknown, summary: string): ToolOutput => ({ ok: true, content: JSON.stringify(value), summary });
  const fail = (message: string): ToolOutput => ({ ok: false, content: JSON.stringify({ error: message }), summary: message });
  switch (name) {
    case 'analyze_draft': {
      const top = [...ctx.analysis.findings]
        .map((f) => scoreFinding(f, ctx.goal))
        .sort((x, y) => y.score - x.score)
        .slice(0, 15)
        .map((s) => ({ ...slim(s.finding), leverage: Math.round(s.score * 10) / 10 }));
      const { lengthBuckets, ...metrics } = ctx.analysis.metrics;
      return ok({ goal: ctx.goal, sentence_count: ctx.analysis.sentences.length, metrics, length_buckets: lengthBuckets, top_findings: top }, `${ctx.analysis.findings.length} findings, top ${top.length} returned`);
    }
    case 'get_findings': {
      const detector = a.detector as string | undefined;
      if (detector !== undefined && !(DETECTOR_IDS as string[]).includes(detector)) return fail(`unknown detector "${detector}"`);
      const limit = Math.min(30, Math.max(1, Number.isInteger(a.limit) ? (a.limit as number) : 20));
      const list = ctx.analysis.findings.filter((f) => !detector || f.detector === detector).slice(0, limit).map(slim);
      return ok({ findings: list }, `${list.length} ${detector ?? 'all'} findings`);
    }
    case 'get_sentences': {
      const n = ctx.analysis.sentences.length;
      const start = Number(a.start);
      const end = Number(a.end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return fail('start and end must be integers with 0 <= start <= end');
      if (start >= n) return fail(`the draft has ${n} sentences (0 to ${n - 1})`);
      const last = Math.min(end, start + 14, n - 1);
      const list = ctx.analysis.sentences.slice(start, last + 1).map((s) => ({ index: s.index, paragraph: s.paragraphIndex, start: s.start, end: s.end, words: s.wordCount, text: s.text }));
      return ok({ sentences: list, truncated: last < end }, `sentences ${start} to ${last}`);
    }
    case 'compare_drafts': {
      const pick = (k: unknown) => (k === 'previous' ? ctx.previous?.analysis : k === 'current' ? ctx.analysis : undefined);
      const x = pick(a.a);
      const y = pick(a.b);
      if (!x || !y) return fail(ctx.previous ? 'a and b must be "previous" or "current"' : 'there is no previous draft to compare with');
      const deltas = compareMetrics(x.metrics, y.metrics).filter((d) => d.before !== d.after);
      return ok({ changes: deltas }, `${deltas.length} metrics changed`);
    }
    default:
      return fail(`unknown tool "${name}"`);
  }
}
