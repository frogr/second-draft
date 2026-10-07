import { describe, expect, it } from 'vitest';
import { quotedRanges, segment, sentenceAt, syllables } from '../src/core/text.js';

const texts = (t: string) => segment(t).sentences.map((s) => s.text);

describe('sentence splitting', () => {
  it('keeps titles, initials, decimals and e.g. inside a sentence', () => {
    expect(texts('Dr. Ruiz paid $3.50 for it. J. R. R. Tolkien wrote books, e.g. The Hobbit. Done.')).toEqual([
      'Dr. Ruiz paid $3.50 for it.',
      'J. R. R. Tolkien wrote books, e.g. The Hobbit.',
      'Done.',
    ]);
  });

  it('breaks after a soft abbreviation only before a capital', () => {
    expect(texts('We met at 5 p.m. and left. It rained in the U.S. Then it stopped.')).toEqual(['We met at 5 p.m. and left.', 'It rained in the U.S.', 'Then it stopped.']);
  });

  it('handles ellipses, ?! runs and dialogue with tags', () => {
    expect(texts('He waited... Nothing. "Is it you?!" she asked. "Run," he said. "Now!"')).toEqual(['He waited...', 'Nothing.', '"Is it you?!" she asked.', '"Run," he said.', '"Now!"']);
  });

  it('splits paragraphs on blank lines and falls back to single newlines', () => {
    expect(segment('One. Two.\n\nThree.').paragraphs.map((p) => p.sentenceIndexes)).toEqual([[0, 1], [2]]);
    expect(segment('One.\nTwo.').paragraphs).toHaveLength(2);
  });

  it('offsets always map back to the original text', () => {
    const t = '  Mr. Lee  left.\n\n\n"Bye," said Ana.   Then quiet…  ';
    const seg = segment(t);
    for (const s of seg.sentences) expect(t.slice(s.start, s.end)).toBe(s.text);
    for (const p of seg.paragraphs) expect(t.slice(p.start, p.end)).toBe(p.text);
    expect(sentenceAt(seg.sentences, t.indexOf('Ana'))).toBe(1);
    expect(sentenceAt(seg.sentences, 0)).toBe(-1);
  });

  it('finds quoted ranges with straight and curly quotes', () => {
    const t = 'He said "go" and “stay” too.';
    expect(quotedRanges(t).map(([s, e]) => t.slice(s, e))).toEqual(['"go"', '“stay”']);
  });

  it('counts syllables close enough for Flesch-Kincaid', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('water')).toBe(2);
    expect(syllables('beautiful')).toBe(3);
    expect(syllables('walked')).toBe(1);
    expect(syllables('every')).toBe(2);
  });
});
