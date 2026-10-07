import type { DetectorId, Metrics } from './types.js';
import { DETECTOR_IDS } from './types.js';

export interface MetricDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  /** "better", "worse" or "same", judged by which direction usually helps */
  verdict: 'better' | 'worse' | 'same';
}

const LOWER_IS_BETTER: Array<[keyof Metrics, string]> = [
  ['gradeLevel', 'Grade level'],
  ['longestSentence', 'Longest sentence'],
  ['passiveRate', 'Passive sentences (share)'],
];

/** Compare two drafts' metrics. Finding counts are normalized per 100 words so length changes do not dominate. */
export function compareMetrics(a: Metrics, b: Metrics): MetricDelta[] {
  const out: MetricDelta[] = [];
  const push = (key: string, label: string, before: number, after: number, lowerBetter: boolean) => {
    const diff = after - before;
    const verdict = Math.abs(diff) < 1e-9 ? 'same' : (diff < 0) === lowerBetter ? 'better' : 'worse';
    out.push({ key, label, before, after, verdict });
  };
  push('words', 'Words', a.words, b.words, true);
  for (const [k, label] of LOWER_IS_BETTER) push(k, label, a[k] as number, b[k] as number, true);
  push('readingEase', 'Reading ease', a.readingEase, b.readingEase, false);
  push('sentenceLengthSpread', 'Sentence length variety', a.sentenceLengthSpread, b.sentenceLengthSpread, false);
  for (const id of DETECTOR_IDS as DetectorId[]) push(`per100.${id}`, `${id} per 100 words`, a.per100[id], b.per100[id], true);
  // word count change is neutral, not a verdict
  out[0]!.verdict = 'same';
  return out;
}
