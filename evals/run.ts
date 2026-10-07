/**
 * Eval: per-detector precision and recall on the labeled passages, plus a validator check
 * against planted bad citations.
 *
 *   npm run eval              summary tables
 *   npm run eval -- --errors  also list every false positive and false negative
 *   npm run eval -- --json    machine-readable output
 */
import { deterministicCoach } from '../src/coach/deterministic.js';
import { validateItems, type SubmittedItem } from '../src/coach/validate.js';
import { analyze } from '../src/core/analyze.js';
import { DETECTOR_IDS, type DetectorId, type Finding } from '../src/core/types.js';
import { PASSAGES, type Label, type Passage } from './passages.js';

const args = new Set(process.argv.slice(2));

/** Locate a label in the text: whole-word match, nth occurrence. Throws on bad data so labels cannot silently drift. */
export function locate(p: Passage, label: Label): [number, number] {
  const esc = label.quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\w'’])${esc}(?![\\w'’])`, 'g');
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(p.text))) {
    if (++n === (label.nth ?? 1)) return [m.index, m.index + m[0].length];
  }
  throw new Error(`${p.id}: label "${label.quote}" (nth ${label.nth ?? 1}) not found`);
}

const overlaps = (a: [number, number], b: { start: number; end: number }) => a[0] < b.end && b.start < a[1];

interface Row {
  detector: DetectorId;
  labels: number;
  findings: number;
  tp: number;
  fp: number;
  fn: number;
}
interface ErrorCase {
  passage: string;
  detector: DetectorId;
  type: 'FP' | 'FN';
  text: string;
  kind?: string;
}

export function runDetectorEval() {
  const rows = new Map<DetectorId, Row>(DETECTOR_IDS.map((d) => [d, { detector: d, labels: 0, findings: 0, tp: 0, fp: 0, fn: 0 }]));
  const errors: ErrorCase[] = [];
  for (const p of PASSAGES) {
    const { findings } = analyze(p.text);
    const located = p.labels.map((l) => ({ l, span: locate(p, l) }));
    for (const { l, span } of located) {
      const row = rows.get(l.detector)!;
      row.labels++;
      if (findings.some((f) => f.detector === l.detector && overlaps(span, f))) row.tp++;
      else {
        row.fn++;
        errors.push({ passage: p.id, detector: l.detector, type: 'FN', text: l.quote });
      }
    }
    for (const f of findings) {
      const row = rows.get(f.detector)!;
      row.findings++;
      const hit = located.some(({ l, span }) => l.detector === f.detector && overlaps(span, f));
      if (!hit) {
        row.fp++;
        errors.push({ passage: p.id, detector: f.detector, type: 'FP', text: f.text.length > 70 ? `${f.text.slice(0, 67)}...` : f.text, ...(f.kind ? { kind: f.kind } : {}) });
      }
    }
  }
  return { rows: [...rows.values()], errors };
}

/**
 * Validator eval. Good citations: every sentence quoted whole, plus a mid-sentence fragment, plus every
 * deterministic coach item. Bad citations: eight mutation types that a model plausibly produces.
 */
export function runValidatorEval() {
  const base = { rewrite: 'A different sentence entirely.', title: 'Fix it', why: 'Because it matters here.', exercise: 'Try it three ways.', detector: 'other' };
  let goodCount = 0;
  let goodRejected = 0;
  const badByType = new Map<string, { planted: number; caught: number }>();

  for (const p of PASSAGES) {
    const a = analyze(p.text);
    const n = a.sentences.length;
    const cases: SubmittedItem[] = [];
    for (const s of a.sentences) {
      cases.push({ ...base, sentence_index: s.index, quote: s.text });
      const words = s.text.split(' ');
      if (words.length >= 4) cases.push({ ...base, sentence_index: s.index, quote: words.slice(1, 3).join(' ') });
    }
    for (const it of deterministicCoach(a, 'balanced')) cases.push({ ...base, sentence_index: it.sentenceIndex, quote: it.before, rewrite: it.after });
    for (const c of cases) {
      goodCount++;
      const { valid } = validateItems([c], a.sentences);
      if (valid.length !== 1 || p.text.slice(valid[0]!.start, valid[0]!.end) !== c.quote) goodRejected++;
    }

    const plant = (type: string, item: SubmittedItem) => {
      const entry = badByType.get(type) ?? { planted: 0, caught: 0 };
      entry.planted++;
      const { valid } = validateItems([item], a.sentences);
      if (valid.length === 0) entry.caught++;
      badByType.set(type, entry);
    };
    for (const s of a.sentences) {
      const words = s.text.split(' ');
      const longWord = words.findIndex((w) => /^[A-Za-z]{4,}$/.test(w));
      if (longWord >= 0) {
        const changed = [...words];
        changed[longWord] = `${changed[longWord]}s`;
        plant('one word changed', { ...base, sentence_index: s.index, quote: changed.join(' ') });
      }
      if (n > 1) plant('right quote, wrong sentence_index', { ...base, sentence_index: (s.index + 1) % n, quote: s.text });
      plant('sentence_index out of range', { ...base, sentence_index: n + s.index, quote: s.text });
      plant('invented sentence', { ...base, sentence_index: s.index, quote: 'The evidence clearly shows a pattern of growth.' });
      plant('whitespace changed', { ...base, sentence_index: s.index, quote: s.text.replace(' ', '  ') });
      const L = s.text.search(/[A-Za-z]/);
      const ch = s.text[L]!;
      const flipped = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
      plant('case changed', { ...base, sentence_index: s.index, quote: s.text.slice(0, L) + flipped + s.text.slice(L + 1) });
      plant('rewrite identical to quote', { ...base, sentence_index: s.index, quote: s.text, rewrite: s.text });
      if (/['"]/.test(s.text)) plant('straight quotes curled', { ...base, sentence_index: s.index, quote: s.text.replace(/'/g, '’').replace(/"/g, '“') });
      else if (words.length > 3) plant('two sentences merged', { ...base, sentence_index: s.index, quote: `${s.text} ${s.text}` });
    }
  }
  const planted = [...badByType.values()].reduce((a, b) => a + b.planted, 0);
  const caught = [...badByType.values()].reduce((a, b) => a + b.caught, 0);
  return { goodCount, goodRejected, planted, caught, byType: [...badByType.entries()].map(([type, v]) => ({ type, ...v })) };
}

/** Every deterministic coach item, for every goal, must quote the draft verbatim. */
export function runAnchoringCheck() {
  let items = 0;
  let anchored = 0;
  for (const p of PASSAGES) {
    for (const goal of ['balanced', 'tighter', 'vivid', 'clearer', 'voice'] as const) {
      for (const it of deterministicCoach(analyze(p.text), goal)) {
        items++;
        if (p.text.slice(it.start, it.end) === it.before && it.after !== it.before) anchored++;
      }
    }
  }
  return { items, anchored };
}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(0)}%`);

function main() {
  const det = runDetectorEval();
  const val = runValidatorEval();
  const anchor = runAnchoringCheck();
  if (args.has('--json')) {
    console.log(JSON.stringify({ detectors: det.rows, errors: det.errors, validator: val, anchoring: anchor }, null, 2));
    return;
  }
  const labels = PASSAGES.reduce((a, p) => a + p.labels.length, 0);
  console.log(`Second Draft eval: ${PASSAGES.length} synthetic passages, ${labels} labels\n`);
  console.log('| Detector | Labels | Findings | TP | FP | FN | Precision | Recall |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
  const total = { labels: 0, findings: 0, tp: 0, fp: 0, fn: 0 };
  for (const r of det.rows) {
    const precision = pct(r.findings - r.fp, r.findings);
    console.log(`| ${r.detector} | ${r.labels} | ${r.findings} | ${r.tp} | ${r.fp} | ${r.fn} | ${precision} | ${pct(r.tp, r.labels)} |`);
    total.labels += r.labels;
    total.findings += r.findings;
    total.tp += r.tp;
    total.fp += r.fp;
    total.fn += r.fn;
  }
  console.log(`| **all** | ${total.labels} | ${total.findings} | ${total.tp} | ${total.fp} | ${total.fn} | ${pct(total.findings - total.fp, total.findings)} | ${pct(total.tp, total.labels)} |`);
  console.log('\nPrecision = findings that hit a label / all findings. Recall = labels hit by a finding / all labels.\n');

  console.log('Validator against planted bad citations:\n');
  console.log('| Bad citation type | Planted | Caught |');
  console.log('|---|---:|---:|');
  for (const t of val.byType) console.log(`| ${t.type} | ${t.planted} | ${t.caught} |`);
  console.log(`| **all** | ${val.planted} | ${val.caught} (${pct(val.caught, val.planted)}) |`);
  console.log(`\nGood citations wrongly rejected: ${val.goodRejected} of ${val.goodCount}`);
  console.log(`Deterministic coach items anchored verbatim (5 goals x ${PASSAGES.length} passages): ${anchor.anchored} of ${anchor.items}`);

  if (args.has('--errors')) {
    console.log('\nErrors:');
    for (const e of det.errors.sort((a, b) => a.detector.localeCompare(b.detector) || a.type.localeCompare(b.type))) console.log(`  ${e.type} ${e.detector.padEnd(16)} ${e.passage.padEnd(16)} ${JSON.stringify(e.text)}${e.kind ? ` (${e.kind})` : ''}`);
  }
}

main();
