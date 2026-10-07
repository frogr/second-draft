export type DetectorId =
  | 'passive'
  | 'filler'
  | 'adverb'
  | 'cliche'
  | 'repetition'
  | 'dialogue_tag'
  | 'show_tell'
  | 'sentence_length'
  | 'paragraph_rhythm'
  | 'opening'
  | 'readability';

export const DETECTOR_IDS: DetectorId[] = [
  'passive',
  'filler',
  'adverb',
  'cliche',
  'repetition',
  'dialogue_tag',
  'show_tell',
  'sentence_length',
  'paragraph_rhythm',
  'opening',
  'readability',
];

export const DETECTOR_LABELS: Record<DetectorId, string> = {
  passive: 'Passive voice',
  filler: 'Filler and hedges',
  adverb: 'Adverbs',
  cliche: 'Cliches',
  repetition: 'Repeated words',
  dialogue_tag: 'Dialogue tags',
  show_tell: 'Telling emotions',
  sentence_length: 'Sentence rhythm',
  paragraph_rhythm: 'Paragraph shape',
  opening: 'Opening sentence',
  readability: 'Dense sentences',
};

export type Severity = 1 | 2 | 3;

/** A single measured fact about the draft, pinned to exact character offsets. */
export interface Finding {
  detector: DetectorId;
  /** inclusive start offset into the original draft */
  start: number;
  /** exclusive end offset into the original draft */
  end: number;
  /** text.slice(start, end), always verbatim */
  text: string;
  /** short human message, e.g. "'quickly' (adverb)" */
  message: string;
  severity: Severity;
  /** index of the sentence that contains `start` */
  sentenceIndex: number;
  /** detector-specific subtype, e.g. 'hedge', 'fancy_tag', 'long' */
  kind?: string;
  /** optional deterministic replacement for exactly [start, end) */
  replacement?: string;
}

export interface Sentence {
  index: number;
  start: number;
  end: number;
  text: string;
  paragraphIndex: number;
  wordCount: number;
}

export interface Paragraph {
  index: number;
  start: number;
  end: number;
  text: string;
  sentenceIndexes: number[];
  wordCount: number;
}

export interface WordToken {
  word: string;
  lower: string;
  start: number;
  end: number;
}

export interface Metrics {
  words: number;
  sentences: number;
  paragraphs: number;
  /** Flesch-Kincaid grade level for the whole draft */
  gradeLevel: number;
  /** Flesch reading ease, 0 to 100, higher is easier */
  readingEase: number;
  avgSentenceLength: number;
  /** standard deviation of sentence length in words; low means a flat rhythm */
  sentenceLengthSpread: number;
  longestSentence: number;
  /** counts of sentences by length bucket */
  lengthBuckets: { label: string; count: number }[];
  /** share of sentences with a passive construction, 0 to 1 */
  passiveRate: number;
  /** findings per 100 words, by detector */
  per100: Record<DetectorId, number>;
  counts: Record<DetectorId, number>;
}

export interface Analysis {
  metrics: Metrics;
  findings: Finding[];
  sentences: Sentence[];
  paragraphs: Paragraph[];
}
