import { describe, expect, it } from 'vitest';
import { actionTagToBeat, activeVoice, applyEdits, splitLong, tidy } from '../src/coach/rewrite.js';

describe('tidy', () => {
  it('cleans spacing, stray commas, capitals and articles', () => {
    expect(tidy(' basically ,  we won .')).toBe('Basically, we won.');
    expect(tidy(', we left')).toBe('We left');
    expect(tidy('it was a  easy win')).toBe('It was an easy win');
    expect(tidy('in a a busy team')).toBe('In a busy team');
    expect(tidy('"Leave," she said.')).toBe('"Leave," she said.');
  });
});

describe('applyEdits', () => {
  it('takes commas with cut words', () => {
    const cut = (t: string, ...words: string[]) => applyEdits(t, words.map((w) => ({ start: t.indexOf(w), end: t.indexOf(w) + w.length, replacement: '' })));
    expect(cut('I really, truly believe it.', 'really', 'truly')).toBe('I believe it.');
    expect(cut('She read it again, very slowly, and sat down.', 'very', 'slowly')).toBe('She read it again and sat down.');
    expect(cut('He was, honestly, tired.', 'honestly')).toBe('He was tired.');
    expect(cut('Honestly, it works.', 'Honestly')).toBe('It works.');
    expect(cut('"Go," Hale said grimly, crouching low.', ' grimly')).toBe('"Go," Hale said, crouching low.');
  });
  it('applies non-overlapping edits right to left', () => {
    const t = 'I think we should leave in order to win.';
    expect(applyEdits(t, [{ start: 0, end: 7, replacement: '' }, { start: t.indexOf('in order'), end: t.indexOf(' win'), replacement: 'to' }])).toBe('We should leave to win.');
  });
});

describe('activeVoice', () => {
  const run = (s: string, phrase: string) => {
    const at = s.indexOf(phrase);
    return activeVoice(s, at, at + phrase.length);
  };
  it('moves the agent to the front', () => {
    expect(run('The letter was written by Maya.', 'was written')).toEqual({ text: 'Maya wrote the letter.', scaffold: false });
  });
  it('handles pronouns and leading clauses', () => {
    expect(run('After lunch, she was seen by them at the pier.', 'was seen')).toEqual({ text: 'After lunch, they saw her at the pier.', scaffold: false });
  });
  it('drops the dummy "it" before a that-clause', () => {
    expect(run('It was decided by the committee that the budget would be reduced.', 'was decided')).toEqual({ text: 'The committee decided that the budget would be reduced.', scaffold: false });
  });
  it('moves a relative clause with the agent', () => {
    expect(run('The words were written by her father, who had been gone for years.', 'were written')).toEqual({ text: 'Her father, who had been gone for years, wrote the words.', scaffold: false });
  });
  it('stops the agent before an -ing phrase', () => {
    expect(run('In my last job, reports were automated by me using Python.', 'were automated')).toEqual({ text: 'In my last job, I automated reports using Python.', scaffold: false });
  });
  it('treats "by Friday" as a deadline and refuses modal passives', () => {
    expect(run('The plan was approved by Friday.', 'was approved')).toEqual({ text: '[Who?] approved the plan by Friday.', scaffold: true });
    expect(run('Questions should be directed to the office.', 'be directed')).toBeNull();
    expect(run('A plan is expected to be submitted by Friday.', 'be submitted')).toBeNull();
  });
  it('keeps had/has with the verb', () => {
    expect(run('The body had been found by a jogger at six.', 'been found')).toEqual({ text: 'A jogger had found the body at six.', scaffold: false });
  });
  it('finds the subject inside a that-clause and keeps a restrictive who-clause on the agent', () => {
    expect(run('I believe that good software is built by people who care about details.', 'is built')).toEqual({ text: 'I believe that people who care about details built good software.', scaffold: false });
  });
  it('makes a scaffold when nobody is named', () => {
    expect(run('The door was locked.', 'was locked')).toEqual({ text: '[Who?] locked the door.', scaffold: true });
  });
  it('refuses long or quoted subjects', () => {
    expect(run('The man who lived at the very end of the long road was seen by Ann.', 'was seen')).toBeNull();
  });
});

describe('splitLong', () => {
  it('splits at the conjunction nearest the middle', () => {
    const s = 'We drove for hours across the valley in the heat, and by the time we reached the river the light had gone and the water looked black.';
    expect(splitLong(s)).toBe('We drove for hours across the valley in the heat. By the time we reached the river the light had gone and the water looked black.');
  });
  it('keeps "but" as the start of the new sentence', () => {
    expect(splitLong('The plan looked good on paper for most of the team, but nobody had asked the people who would actually run it.')).toBe('The plan looked good on paper for most of the team. But nobody had asked the people who would actually run it.');
  });
  it('returns null without a safe split point', () => {
    expect(splitLong('A very long sentence without any useful place to break it at all in the middle somewhere.')).toBeNull();
  });
});

describe('actionTagToBeat', () => {
  it('turns an action tag into its own sentence', () => {
    const s = '"Fine," he smiled.';
    expect(actionTagToBeat(s, s.indexOf('smiled'))).toBe('"Fine." He smiled.');
  });
});
