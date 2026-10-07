import { detectAdverbs } from './detectors/adverb.js';
import { detectCliches } from './detectors/cliche.js';
import { makeContext, type DetectorContext } from './detectors/context.js';
import { detectDialogueTags } from './detectors/dialogueTags.js';
import { detectFiller } from './detectors/filler.js';
import { detectOpening } from './detectors/opening.js';
import { detectPassive } from './detectors/passive.js';
import { detectReadability } from './detectors/readability.js';
import { detectRepetition } from './detectors/repetition.js';
import { detectParagraphRhythm, detectSentenceLength } from './detectors/rhythm.js';
import { detectShowTell } from './detectors/showTell.js';
import { syllables } from './text.js';
import { DETECTOR_IDS, type Analysis, type DetectorId, type Finding, type Metrics } from './types.js';

export const DETECTORS: Record<DetectorId, (ctx: DetectorContext) => Finding[]> = {
  passive: detectPassive,
  filler: detectFiller,
  adverb: detectAdverbs,
  cliche: detectCliches,
  repetition: detectRepetition,
  dialogue_tag: detectDialogueTags,
  show_tell: detectShowTell,
  sentence_length: detectSentenceLength,
  paragraph_rhythm: detectParagraphRhythm,
  opening: detectOpening,
  readability: detectReadability,
};

const BUCKETS: Array<[string, number, number]> = [
  ['1-8', 1, 8],
  ['9-16', 9, 16],
  ['17-25', 17, 25],
  ['26-40', 26, 40],
  ['41+', 41, Infinity],
];

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Run every detector and compute draft-level metrics. Pure: same text in, same result out. */
export function analyze(text: string): Analysis {
  const ctx = makeContext(text);
  const { sentences, paragraphs, words } = ctx.seg;
  const findings = DETECTOR_IDS.flatMap((id) => DETECTORS[id](ctx)).sort((a, b) => a.start - b.start || a.detector.localeCompare(b.detector));

  const counts = Object.fromEntries(DETECTOR_IDS.map((id) => [id, 0])) as Record<DetectorId, number>;
  for (const f of findings) counts[f.detector]++;
  const wordCount = words.filter((w) => /[a-z]/i.test(w.word)).length;
  const per100 = Object.fromEntries(DETECTOR_IDS.map((id) => [id, wordCount ? round((counts[id] / wordCount) * 100, 2) : 0])) as Record<DetectorId, number>;

  const lengths = sentences.map((s) => s.wordCount);
  const n = lengths.length || 1;
  const avg = lengths.reduce((a, b) => a + b, 0) / n;
  const spread = Math.sqrt(lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  const syl = words.reduce((a, w) => a + (/[a-z]/i.test(w.word) ? syllables(w.word) : 0), 0);
  const wps = wordCount / n;
  const spw = wordCount ? syl / wordCount : 0;
  const passiveSentences = new Set(findings.filter((f) => f.detector === 'passive').map((f) => f.sentenceIndex));

  const metrics: Metrics = {
    words: wordCount,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    gradeLevel: wordCount ? round(Math.max(0, 0.39 * wps + 11.8 * spw - 15.59)) : 0,
    readingEase: wordCount ? round(Math.min(100, Math.max(0, 206.835 - 1.015 * wps - 84.6 * spw))) : 0,
    avgSentenceLength: round(avg),
    sentenceLengthSpread: round(spread),
    longestSentence: lengths.length ? Math.max(...lengths) : 0,
    lengthBuckets: BUCKETS.map(([label, lo, hi]) => ({ label, count: lengths.filter((l) => l >= lo && l <= hi).length })),
    passiveRate: sentences.length ? round(passiveSentences.size / sentences.length, 3) : 0,
    per100,
    counts,
  };
  return { metrics, findings, sentences, paragraphs };
}
