import { describe, expect, it } from 'vitest';
import { validateItems } from '../src/coach/validate.js';
import { segment } from '../src/core/text.js';

const draft = 'The door was locked. She was very angry. “Leave,” she said.';
const { sentences } = segment(draft);
const good = { sentence_index: 1, quote: 'was very angry', rewrite: 'slammed the drawer', title: 'Show it', why: 'Names the feeling.', exercise: 'Write it three ways.', detector: 'show_tell' };

describe('validateItems', () => {
  it('accepts a verbatim quote and computes offsets itself', () => {
    const { valid, errors } = validateItems([good], sentences);
    expect(errors).toEqual([]);
    expect(draft.slice(valid[0]!.start, valid[0]!.end)).toBe('was very angry');
    expect(valid[0]!.source).toBe('model');
  });

  it.each([
    [{ ...good, sentence_index: 9 }, 'sentence_out_of_range'],
    [{ ...good, quote: 'was really angry' }, 'quote_not_in_sentence'],
    [{ ...good, sentence_index: 0 }, 'quote_not_in_sentence'],
    [{ ...good, quote: '' }, 'quote_empty'],
    [{ ...good, rewrite: '  WAS very   angry ' }, 'rewrite_same'],
    [{ ...good, rewrite: 'x'.repeat(500) }, 'rewrite_too_long'],
    [{ ...good, why: '' }, 'missing_field'],
    [{ ...good, sentence_index: 1.5 }, 'missing_field'],
    [{ ...good, exercise: 'e'.repeat(600) }, 'field_too_long'],
    ['nope', 'not_an_object'],
  ])('rejects %o with %s', (item, code) => {
    const { valid, errors } = validateItems([item], sentences);
    expect(valid).toEqual([]);
    expect(errors[0]!.code).toBe(code);
  });

  it('hints where a misplaced quote really is', () => {
    const { errors } = validateItems([{ ...good, sentence_index: 0 }], sentences);
    expect(errors[0]!.message).toMatch(/appear in sentence 1/);
  });

  it('hints about curly quotes instead of fixing them', () => {
    const { errors } = validateItems([{ ...good, sentence_index: 2, quote: '"Leave," she said.' }], sentences);
    expect(errors[0]!.message).toMatch(/quote marks/);
  });

  it('drops duplicates and anything past three items', () => {
    const items = [good, { ...good, quote: 'very angry', rewrite: 'furious' }, { ...good, sentence_index: 0, quote: 'was locked', rewrite: 'stuck' }, good];
    const { valid, errors } = validateItems(items, sentences);
    expect(valid.map((v) => v.before)).toEqual(['was very angry', 'was locked']);
    expect(errors.map((e) => e.code).sort()).toEqual(['duplicate_span', 'too_many_items']);
  });

  it('counts punctuation-only rewrites as changes', () => {
    const { valid } = validateItems([{ ...good, sentence_index: 2, quote: '“Leave,” she said.', rewrite: '“Leave.” She said it once.' }], sentences);
    expect(valid).toHaveLength(1);
    const split = validateItems([{ ...good, quote: 'She was very angry.', rewrite: 'She was. Very angry.' }], sentences);
    expect(split.valid).toHaveLength(1);
  });

  it('marks bracketed rewrites as scaffolds and unknown detectors as other', () => {
    const { valid } = validateItems([{ ...good, rewrite: '[what she did]', detector: 'vibes' }], sentences);
    expect(valid[0]!.afterKind).toBe('scaffold');
    expect(valid[0]!.detector).toBe('other');
  });
});
