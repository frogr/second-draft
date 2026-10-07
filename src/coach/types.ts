import type { MetricDelta } from '../core/compare.js';
import type { Analysis, DetectorId } from '../core/types.js';

export const GOALS = ['balanced', 'tighter', 'vivid', 'clearer', 'voice'] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABELS: Record<Goal, string> = {
  balanced: 'Balanced',
  tighter: 'Tighter prose',
  vivid: 'More vivid',
  clearer: 'Clearer argument',
  voice: 'Cover letter that sounds like me',
};

export interface CoachingItem {
  rank: number;
  title: string;
  detector: DetectorId | 'other';
  sentenceIndex: number;
  /** offsets of `before` in the draft; draft.slice(start, end) === before */
  start: number;
  end: number;
  before: string;
  after: string;
  /** "rewrite" is a usable sentence; "scaffold" keeps a bracketed prompt where the writer has to decide */
  afterKind: 'rewrite' | 'scaffold';
  why: string;
  exercise: string;
  source: 'deterministic' | 'model';
  leverage?: { score: number; explanation: string };
}

export interface TraceStep {
  step: number;
  kind: 'tool' | 'model' | 'validator' | 'note';
  name: string;
  input?: unknown;
  output: string;
  ms: number;
  ok: boolean;
}

export type CoachMode = 'deterministic' | 'anthropic' | 'openai';

export interface CoachResult {
  mode: CoachMode;
  model?: string;
  goal: Goal;
  summary: string;
  items: CoachingItem[];
  analysis: Analysis;
  comparison?: MetricDelta[];
  trace: TraceStep[];
  notes: string[];
  usage?: { inputTokens: number; outputTokens: number };
}
