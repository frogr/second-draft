import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analyze.js';
import type { DetectorId } from '../src/core/types.js';

const found = (text: string, id: DetectorId) => analyze(text).findings.filter((f) => f.detector === id);
const spans = (text: string, id: DetectorId) => found(text, id).map((f) => f.text);

describe('passive voice', () => {
  it('finds passives with and without an agent', () => {
    const f = found('The report was written by Sam. The door was quietly locked.', 'passive');
    expect(f.map((x) => [x.text, x.kind])).toEqual([
      ['was written', 'with_agent'],
      ['was quietly locked', 'agentless'],
    ]);
  });
  it('ignores states and active past continuous', () => {
    expect(spans('She was tired. He was walking home. They were excited about it.', 'passive')).toEqual([]);
  });
  it('counts a stative word when an agent follows', () => {
    expect(spans('She was surprised by the noise.', 'passive')).toEqual(['was surprised']);
  });
  it('skips dialogue', () => {
    expect(spans('"It was stolen," she said.', 'passive')).toEqual([]);
  });
});

describe('filler and hedges', () => {
  it('flags filler, hedges and wordy phrases with replacements', () => {
    const f = found('I think this is very good. We left in order to win.', 'filler');
    expect(f.map((x) => [x.text, x.kind, x.replacement])).toEqual([
      ['I think', 'hedge', ''],
      ['very', 'filler', ''],
      ['in order to', 'wordy', 'to'],
    ]);
  });
  it('leaves real uses alone', () => {
    expect(spans('It was a kind of bird. He arrived just in time. The very idea. Rather than wait, we went.', 'filler')).toEqual([]);
  });
});

describe('adverbs', () => {
  it('separates verb props, openers and plain adverbs', () => {
    const f = found('She walked slowly. Suddenly, it rained. It was mostly fine.', 'adverb');
    expect(f.map((x) => [x.text, x.kind])).toEqual([
      ['slowly', 'verb_adverb'],
      ['Suddenly,', 'opener'],
      ['mostly', 'ly'],
    ]);
  });
  it('skips -ly adjectives, nouns, names and tag adverbs', () => {
    expect(spans('The friendly family met Kimberly early. "Hi," she said softly.', 'adverb')).toEqual([]);
  });
});

describe('cliches', () => {
  it('matches pronoun slots and keeps the longest match', () => {
    expect(spans('Her heart was pounding. We should think outside the box.', 'cliche')).toEqual(['Her heart was pounding', 'think outside the box']);
  });
  it('gives fiction cliches no automatic replacement', () => {
    const [f] = found('It was a dark and stormy night.', 'cliche');
    expect(f!.replacement).toBeUndefined();
    const [g] = found('At the end of the day, we won.', 'cliche');
    expect(g!.replacement).toBe('ultimately');
  });
});

describe('repetition', () => {
  it('flags a content word repeated within the window', () => {
    expect(spans('The lantern swung. Under the lantern, moths gathered.', 'repetition')).toEqual(['lantern']);
  });
  it('ignores stopwords and words far apart', () => {
    const far = `The lantern swung. ${'And then it was so. '.repeat(9)}The lantern again.`;
    expect(spans(far, 'repetition')).toEqual([]);
  });
});

describe('dialogue tags', () => {
  it('finds fancy verbs, adverbs on tags, and actions used as tags', () => {
    const t = '"Get out," she hissed. "Fine," he said angrily. "Sure," Maya smiled. Ben barked, "Move."';
    expect(found(t, 'dialogue_tag').map((f) => [f.text.trim(), f.kind])).toEqual([
      ['hissed', 'fancy_tag'],
      ['angrily', 'adverb_tag'],
      ['smiled', 'action_tag'],
      ['barked', 'fancy_tag'],
    ]);
  });
  it('accepts said and asked', () => {
    expect(spans('"Go," she said. "Why?" asked Tom.', 'dialogue_tag')).toEqual([]);
  });
});

describe('telling emotions', () => {
  it('finds adjectives after linking verbs and emotion nouns', () => {
    expect(spans('She was very angry. He felt a wave of relief. Fear washed over them.', 'show_tell')).toEqual(['was very angry', 'felt a wave of relief', 'Fear washed']);
  });
  it('does not flag plain description', () => {
    expect(spans('The sky was grey. She was tall.', 'show_tell')).toEqual([]);
  });
});

describe('rhythm, opening and density', () => {
  it('flags long sentences and flat runs', () => {
    const long = `${'word '.repeat(32).trim()}.`;
    expect(found(long, 'sentence_length')[0]!.kind).toBe('long');
    const flat = 'The cat sat on the warm mat. The dog lay by the cold door. The bird sang in the tall tree. The fish swam in the small bowl.';
    expect(found(flat, 'sentence_length').map((f) => f.kind)).toEqual(['monotone']);
  });
  it('flags walls of text and runs of one-line paragraphs', () => {
    expect(found(`${'This is a sentence of words. '.repeat(30)}`, 'paragraph_rhythm')[0]!.kind).toBe('wall');
    expect(found('One line here.\n\nAnother line.\n\nA third line.\n\nAnd a fourth.', 'paragraph_rhythm')[0]!.kind).toBe('choppy');
  });
  it('checks the opening, skipping a salutation', () => {
    expect(found('Dear Ms. Park,\n\nI am writing to apply for the role.', 'opening')[0]!.kind).toBe('generic');
    expect(found('The alarm went off at six.', 'opening')[0]!.kind).toBe('waking');
    expect(found('Mara stole the boat at dawn.', 'opening')).toEqual([]);
  });
  it('flags nominalization-heavy sentences', () => {
    const t = 'The implementation of the optimization required the consideration of the organization and the establishment of documentation.';
    expect(found(t, 'readability')[0]!.kind).toBe('nominalization');
  });
});

describe('analyze', () => {
  it('computes metrics and keeps findings anchored', () => {
    const t = 'The cat sat. It was very happy.\n\nThe end came quickly.';
    const a = analyze(t);
    expect(a.metrics.words).toBe(11);
    expect(a.metrics.sentences).toBe(3);
    expect(a.metrics.paragraphs).toBe(2);
    expect(a.metrics.lengthBuckets[0]!.count).toBe(3);
    for (const f of a.findings) expect(t.slice(f.start, f.end)).toBe(f.text);
  });
  it('returns empty results for empty text', () => {
    const a = analyze('   ');
    expect(a.findings).toEqual([]);
    expect(a.metrics.gradeLevel).toBe(0);
  });
});
