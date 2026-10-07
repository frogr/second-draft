import { describe, expect, it } from 'vitest';
import { deterministicCoach, rankSentences, scoreFinding } from '../src/coach/deterministic.js';
import { assertAnchored } from '../src/coach/validate.js';
import { analyze } from '../src/core/analyze.js';
import { SAMPLES } from '../src/web/samples.js';

describe('leverage', () => {
  it('scores weight x severity x bonuses and explains it', () => {
    const a = analyze('It was a dark and stormy night. She ran.');
    const op = a.findings.find((f) => f.detector === 'opening')!;
    const s = scoreFinding(op, 'balanced');
    expect(s.score).toBeCloseTo(3 * 2 * 1.5);
    expect(s.parts).toBe('weight 3 (balanced) x severity 2 x 1.5 opening');
  });

  it('changes the order with the goal', () => {
    const t = 'I think the plan is basically sound. She was angry. The report was written by the team in order to save time.';
    const a = analyze(t);
    const tight = rankSentences(a, 'tighter').map((r) => r.primary.finding.detector);
    const vivid = rankSentences(a, 'vivid').map((r) => r.primary.finding.detector);
    expect(tight[0]).toBe('filler');
    expect(vivid[0]).toBe('show_tell');
  });

  it('spreads picks across detectors', () => {
    const t = 'She was sad. He was angry. They were nervous. The door was opened by Sam.';
    const picks = rankSentences(analyze(t), 'vivid').map((r) => r.primary.finding.detector);
    expect(picks).toContain('passive');
  });
});

describe('deterministicCoach', () => {
  for (const [id, sample] of Object.entries(SAMPLES)) {
    it(`gives at most three anchored, changed items for the ${id} sample`, () => {
      const a = analyze(sample.text);
      const items = deterministicCoach(a, sample.goal);
      expect(items.length).toBeLessThanOrEqual(3);
      expect(assertAnchored(sample.text, items)).toBe(true);
      for (const it of items) {
        expect(it.after).not.toBe(it.before);
        expect(it.why.length).toBeGreaterThan(20);
        expect(it.exercise.length).toBeGreaterThan(20);
        expect(it.leverage!.explanation).toMatch(/weight/);
        expect(it.why).not.toMatch(/—/);
      }
    });
  }

  it('rewrites a passive with an agent and says what else it cut only when it did', () => {
    const items = deterministicCoach(analyze('The cake was eaten by the dog.'), 'tighter');
    expect(items[0]!.after).toBe('The dog ate the cake.');
    expect(items[0]!.afterKind).toBe('rewrite');
    expect(items[0]!.why).not.toMatch(/also cuts/);
  });

  it('returns nothing for a clean draft', () => {
    expect(deterministicCoach(analyze('Mara stole the boat at dawn. Nobody saw her go.'), 'balanced')).toEqual([]);
  });
});
