import type { Analysis, DetectorId, Finding, Sentence } from '../core/types.js';
import { DETECTOR_LABELS } from '../core/types.js';
import { actionTagToBeat, activeVoice, applyEdits, splitLong, tidy, type Edit } from './rewrite.js';
import type { CoachingItem, Goal } from './types.js';

/**
 * How much each detector matters for each goal. The leverage score of a finding is
 * weight x severity x position bonus x fixable bonus. The numbers are judgment calls,
 * written down here so anyone can read and argue with them.
 */
export const GOAL_WEIGHTS: Record<Goal, Record<DetectorId, number>> = {
  balanced: { passive: 2, filler: 1.5, adverb: 1, cliche: 2.5, repetition: 1, dialogue_tag: 1.5, show_tell: 2, sentence_length: 2, paragraph_rhythm: 1.5, opening: 3, readability: 2 },
  tighter: { passive: 2, filler: 3, adverb: 2, cliche: 1.5, repetition: 2, dialogue_tag: 1, show_tell: 1, sentence_length: 2.5, paragraph_rhythm: 1, opening: 2, readability: 2 },
  vivid: { passive: 1.5, filler: 1, adverb: 2.5, cliche: 3, repetition: 1.5, dialogue_tag: 2, show_tell: 3, sentence_length: 1.5, paragraph_rhythm: 1, opening: 2.5, readability: 1 },
  clearer: { passive: 2.5, filler: 2, adverb: 1, cliche: 1.5, repetition: 1, dialogue_tag: 0.5, show_tell: 0.5, sentence_length: 3, paragraph_rhythm: 2, opening: 2, readability: 3 },
  voice: { passive: 2, filler: 2.5, adverb: 1, cliche: 3, repetition: 1, dialogue_tag: 0.5, show_tell: 1.5, sentence_length: 1.5, paragraph_rhythm: 1, opening: 3, readability: 1.5 },
};

export const FIRST_SENTENCE_BONUS = 1.5;
export const FIXABLE_BONUS = 1.15;
export const COMPANION_SHARE = 0.35;
export const REPEAT_DETECTOR_PENALTY = 0.6;

export interface ScoredFinding {
  finding: Finding;
  score: number;
  parts: string;
}

function hasDirectFix(f: Finding): boolean {
  return f.replacement !== undefined || (f.detector === 'passive' && f.kind === 'with_agent') || f.kind === 'action_tag' || f.kind === 'long';
}

export function scoreFinding(f: Finding, goal: Goal): ScoredFinding {
  let weight = GOAL_WEIGHTS[goal][f.detector];
  if (goal === 'voice' && f.detector === 'cliche' && f.kind === 'business') weight *= 1.5;
  if (goal === 'clearer' && f.detector === 'filler' && f.kind === 'hedge') weight *= 1.5;
  const first = f.sentenceIndex === 0 || f.detector === 'opening' ? FIRST_SENTENCE_BONUS : 1;
  const fix = hasDirectFix(f) ? FIXABLE_BONUS : 1;
  const score = weight * f.severity * first * fix;
  const parts = [`weight ${weight} (${goal})`, `severity ${f.severity}`];
  if (first !== 1) parts.push(`${FIRST_SENTENCE_BONUS} opening`);
  if (fix !== 1) parts.push(`${FIXABLE_BONUS} direct fix`);
  return { finding: f, score, parts: parts.join(' x ') };
}

export interface RankedSentence {
  sentence: Sentence;
  primary: ScoredFinding;
  companions: ScoredFinding[];
  score: number;
  explanation: string;
}

/** Group findings by sentence and rank sentences by leverage, spreading picks across detectors. */
export function rankSentences(analysis: Analysis, goal: Goal, limit = 3): RankedSentence[] {
  const bySentence = new Map<number, ScoredFinding[]>();
  for (const f of analysis.findings) {
    if (f.sentenceIndex < 0) continue;
    const list = bySentence.get(f.sentenceIndex) ?? [];
    list.push(scoreFinding(f, goal));
    bySentence.set(f.sentenceIndex, list);
  }
  const candidates: RankedSentence[] = [];
  for (const [idx, list] of bySentence) {
    list.sort((a, b) => b.score - a.score || a.finding.start - b.finding.start);
    const [primary, ...companions] = list;
    const extra = companions.reduce((a, c) => a + c.score, 0) * COMPANION_SHARE;
    const score = primary!.score + extra;
    const explanation = `${primary!.parts} = ${primary!.score.toFixed(1)}` + (companions.length ? `, plus ${extra.toFixed(1)} from ${companions.length} more finding${companions.length > 1 ? 's' : ''} in the sentence` : '');
    candidates.push({ sentence: analysis.sentences[idx]!, primary: primary!, companions, score, explanation });
  }
  const picked: RankedSentence[] = [];
  const used = new Map<DetectorId, number>();
  while (picked.length < limit && candidates.length) {
    let bestI = 0;
    let best = -Infinity;
    candidates.forEach((c, i) => {
      const adjusted = c.score * REPEAT_DETECTOR_PENALTY ** (used.get(c.primary.finding.detector) ?? 0);
      if (adjusted > best + 1e-9 || (Math.abs(adjusted - best) < 1e-9 && c.sentence.index < candidates[bestI]!.sentence.index)) {
        best = adjusted;
        bestI = i;
      }
    });
    const [c] = candidates.splice(bestI, 1);
    if (used.get(c!.primary.finding.detector)) c!.explanation += `, x${REPEAT_DETECTOR_PENALTY} because an earlier pick used the same detector`;
    c!.score = best;
    used.set(c!.primary.finding.detector, (used.get(c!.primary.finding.detector) ?? 0) + 1);
    picked.push(c!);
  }
  return picked;
}

const q = (s: string) => `"${s.trim()}"`;

function wordBefore(text: string, at: number): { start: number; word: string } | null {
  const m = text.slice(0, at).match(/([A-Za-z'’]+)\s+$/);
  return m ? { start: at - m[0].length, word: m[1]! } : null;
}
function wordAfter(text: string, at: number): { end: number; word: string } | null {
  const m = text.slice(at).match(/^\s+([A-Za-z'’]+)/);
  return m ? { end: at + m[0].length, word: m[1]! } : null;
}

interface Built {
  after: string;
  kind: 'rewrite' | 'scaffold';
  /** companion findings whose cut was applied in `after` */
  cuts?: Finding[];
}

/** Build the "after" text for a sentence: the primary fix plus any safe cuts from companion findings. */
function buildAfter(s: Sentence, primary: Finding, companions: Finding[]): Built {
  const rel = (n: number) => n - s.start;
  const cutFindings = companions.filter((c) => c.replacement !== undefined && c.start >= s.start && c.end <= s.end && (c.end <= primary.start || c.start >= primary.end));
  const safeCuts: Edit[] = cutFindings.map((c) => ({ start: rel(c.start), end: rel(c.end), replacement: c.replacement! }));
  const withCuts = (text: string, edits: Edit[] = []) => applyEdits(text, [...edits, ...safeCuts]);
  const built = buildPrimary();
  return built.cuts ? built : { ...built, cuts: cutFindings };

  function buildPrimary(): Built {
  const ps = rel(primary.start);
  const pe = rel(primary.end);
  const scaffoldAt = (label: string, start = ps, end = pe): Built => ({ after: withCuts(s.text, [{ start, end, replacement: `[${label}]` }]), kind: 'scaffold' });

  switch (primary.detector) {
    case 'passive': {
      // the clause is rebuilt, so companion cuts are not applied here (their offsets would no longer hold)
      const active = activeVoice(s.text, ps, pe);
      if (active) return { after: active.text, kind: active.scaffold ? 'scaffold' : 'rewrite', cuts: [] };
      return scaffoldAt(`who ${primary.text.split(/\s+/).pop()} it? name them first`);
    }
    case 'sentence_length': {
      if (primary.kind === 'long') {
        const split = splitLong(s.text);
        if (split) return { after: split, kind: 'rewrite', cuts: [] };
        return { after: `${s.text} [split this into two sentences at the main turn]`, kind: 'scaffold' };
      }
      return { after: `${s.text} [make the next sentence much shorter or much longer than this one]`, kind: 'scaffold' };
    }
    case 'paragraph_rhythm':
      if (primary.kind === 'wall') return { after: `[new paragraph] ${s.text}`, kind: 'scaffold' };
      return { after: `${s.text} [join this paragraph with the next one]`, kind: 'scaffold' };
    case 'opening': {
      const label =
        primary.kind === 'generic'
          ? 'open with your most specific detail or result, then say this if you still need to'
          : primary.kind === 'weather' || primary.kind === 'waking'
            ? 'open on a person doing something; bring this in later'
            : 'lead with the subject and what it does';
      return { after: withCuts(`[${label}] ${s.text}`), kind: 'scaffold' };
    }
    case 'show_tell': {
      const feeling = primary.text.split(/\s+/).pop()!.toLowerCase();
      return scaffoldAt(`an action that shows ${feeling}, without the word`);
    }
    case 'repetition':
      return scaffoldAt(`another word for "${primary.text}", a pronoun, or cut`);
    case 'readability':
      return { after: `${withCuts(s.text)} [turn one -tion or -ment noun back into a verb]`, kind: 'scaffold' };
    case 'adverb': {
      if (primary.kind === 'verb_adverb') {
        const prev = wordBefore(s.text, ps);
        const next = wordAfter(s.text, pe);
        const verbBefore = prev && /ed$/i.test(prev.word);
        const start = verbBefore ? prev!.start : ps;
        const end = verbBefore ? pe : next ? next.end : pe;
        const pair = s.text.slice(start, end).trim();
        return scaffoldAt(`one sharper verb for ${q(pair)}`, start, end);
      }
      break;
    }
    case 'dialogue_tag':
      if (primary.kind === 'action_tag') {
        const beat = actionTagToBeat(s.text, ps);
        if (beat) return { after: beat, kind: 'rewrite', cuts: [] };
        return scaffoldAt(`said; then ${primary.text} as its own sentence`);
      }
      break;
    case 'cliche':
      if (primary.replacement === undefined) return scaffoldAt(`say the specific thing instead of ${q(primary.text)}`);
      break;
  }
  if (primary.replacement !== undefined) {
    return { after: withCuts(s.text, [{ start: ps, end: pe, replacement: primary.replacement }]), kind: 'rewrite' };
  }
  return scaffoldAt(`rewrite ${q(primary.text)}`);
  }
}

const TITLES: Record<string, string> = {
  passive: 'Let the doer act',
  filler: 'Cut the padding',
  'filler:hedge': 'Commit to the claim',
  'filler:wordy': 'Use the short version',
  adverb: 'Let the verb do the work',
  cliche: 'Swap the stock phrase for your own',
  repetition: 'Break the echo',
  dialogue_tag: 'Let "said" disappear',
  'dialogue_tag:action_tag': 'Make the gesture its own beat',
  'dialogue_tag:adverb_tag': 'Let the line carry the tone',
  show_tell: 'Show the feeling',
  sentence_length: 'Break up the long sentence',
  'sentence_length:monotone': 'Vary the beat',
  paragraph_rhythm: 'Give the reader a breath',
  'paragraph_rhythm:choppy': 'Save the one-liners for emphasis',
  opening: 'Earn the first sentence',
  readability: 'Unpack the dense sentence',
};

function why(f: Finding, goal: Goal, cuts: Finding[]): string {
  const base: Record<DetectorId, string> = {
    passive: f.kind === 'with_agent' ? `The doer is hiding at the end of the sentence. Put them first and the verb gets its energy back.` : `Nobody does anything in this sentence. Readers follow people, so name who acted.`,
    filler: f.kind === 'hedge' ? `${q(f.text)} softens a point you clearly believe. Say it straight and let the reader decide.` : f.kind === 'wordy' ? `${q(f.text)} takes several words to do the job of ${f.replacement ? q(f.replacement) : 'none'}.` : `${q(f.text)} is padding. The sentence says the same thing without it, and says it harder.`,
    adverb: f.kind === 'verb_adverb' ? `${q(f.text)} is propping up a weak verb. One precise verb gives the reader a picture instead of an instruction.` : f.kind === 'opener' ? `${q(f.text)} announces a surprise instead of letting the action surprise.` : `${q(f.text)} tells the reader how to read the sentence. Check that the sentence needs it.`,
    cliche: `${q(f.text)} is a phrase readers have seen so often they skim it. Your own wording makes them slow down.`,
    repetition: `${q(f.text)} appears again a few words after the last one. An accidental echo pulls attention away from the meaning. If you repeated it on purpose, for rhythm, keep it.`,
    dialogue_tag: f.kind === 'action_tag' ? `People cannot ${f.text.replace(/ed$/, '')} words. A separate beat keeps the gesture and fixes the grammar.` : f.kind === 'adverb_tag' ? `The adverb explains the line. If the line is right, the reader already hears the tone.` : `${q(f.text)} pulls the eye off the dialogue. "Said" is invisible, which is the point.`,
    show_tell: `${q(f.text)} names the emotion, so the reader is told instead of made to feel it. Show what it does to the body, the voice or the room.`,
    sentence_length: f.kind === 'monotone' ? `Several sentences in a row have nearly the same length, so the prose drones. Change one length to restart the rhythm.` : `${f.message}. Readers hold the start in mind until the end; split it where the thought turns.`,
    paragraph_rhythm: f.kind === 'wall' ? `${f.message}. A break gives the eye a place to rest and marks a shift in thought.` : `${f.message}. One-line paragraphs only land when they are rare.`,
    opening: `${f.message}. The first sentence is the most read sentence in the draft.`,
    readability: `${f.message}. Abstract nouns hide who does what; verbs bring the action back.`,
  };
  let text = base[f.detector];
  if (cuts.length) text += ` The rewrite also ${cuts.every((c) => c.replacement === '') ? 'cuts' : 'tidies'} ${cuts.slice(0, 3).map((c) => q(c.text)).join(' and ')}.`;
  if (goal !== 'balanced' && GOAL_WEIGHTS[goal][f.detector] >= 2.5) text += ` This matters most for your goal.`;
  return text;
}

function exercise(f: Finding, s: Sentence, analysis: Analysis): string {
  const n = s.index + 1;
  const same = analysis.findings.filter((x) => x.detector === f.detector && x.kind === f.kind && x.sentenceIndex !== s.index);
  const more = same.length ? ` Then do the same for the ${same.length} other ${same.length === 1 ? 'case' : 'cases'} this detector found (sentence${same.length === 1 ? '' : 's'} ${[...new Set(same.map((x) => x.sentenceIndex + 1))].slice(0, 4).join(', ')}).` : '';
  switch (f.detector) {
    case 'passive':
      return `Rewrite sentence ${n} three ways, each starting with a different possible doer. Keep the one that sounds most like you.${more}`;
    case 'filler':
      return f.kind === 'hedge' ? `Read sentence ${n} aloud without ${q(f.text)}. If it is true, keep the strong version. If it is not, replace the hedge with the specific doubt.${more}` : `Delete ${q(f.text)} from sentence ${n} and read the paragraph aloud. If nothing is lost, leave it out.${more}`;
    case 'adverb':
      return `List five verbs that could replace the verb and ${q(f.text)} in sentence ${n}. Pick the one a reader could picture.${more}`;
    case 'cliche':
      return `Write three replacements for ${q(f.text)} that could only appear in this piece: one concrete object, one sound or smell, one plain statement.${more}`;
    case 'repetition':
      return `Circle every ${q(f.text)} in the paragraph. Keep the one that matters most and recast the others.`;
    case 'dialogue_tag':
      return `Cover the tags and read the dialogue near sentence ${n} aloud. Where you cannot tell who is talking, add "said" or an action beat, nothing else.${more}`;
    case 'show_tell':
      return `Write sentence ${n} three times without the feeling word: once through the hands, once through what the person says, once through an object nearby.${more}`;
    case 'sentence_length':
      return f.kind === 'monotone' ? `Rewrite the run starting at sentence ${n} so one sentence is under six words and one is over twenty.` : `Cut sentence ${n} into two at its main turn. Then try it as three. Read all versions aloud and keep the best.${more}`;
    case 'paragraph_rhythm':
      return f.kind === 'wall' ? `Mark every place in this paragraph where the topic shifts. Break at the strongest one.` : `Merge this run of one-line paragraphs into one paragraph, then pull out the single line that most deserves to stand alone.`;
    case 'opening':
      return `Write five new first sentences, each starting in the middle of something happening or with a specific detail. Put them above the draft and pick one tomorrow.`;
    case 'readability':
      return `Find each -tion, -ment or -ity word in sentence ${n} and ask "who is doing this?" Rewrite with that person as the subject and the noun as a verb.${more}`;
  }
}

/** The no-API-key coach: three highest-leverage sentences, each with a rewrite or scaffold and an exercise. */
export function deterministicCoach(analysis: Analysis, goal: Goal, limit = 3): CoachingItem[] {
  return rankSentences(analysis, goal, limit).map((r, i) => {
    const f = r.primary.finding;
    const built = buildAfter(r.sentence, f, r.companions.map((c) => c.finding));
    let after = built.after;
    let kind = built.kind;
    if (after.trim() === r.sentence.text.trim()) {
      after = `${r.sentence.text} [rewrite ${q(f.text)}]`;
      kind = 'scaffold';
    }
    return {
      rank: i + 1,
      title: TITLES[`${f.detector}:${f.kind}`] ?? TITLES[f.detector] ?? DETECTOR_LABELS[f.detector],
      detector: f.detector,
      sentenceIndex: r.sentence.index,
      start: r.sentence.start,
      end: r.sentence.end,
      before: r.sentence.text,
      after: tidy(after),
      afterKind: kind,
      why: why(f, goal, built.cuts ?? []),
      exercise: exercise(f, r.sentence, analysis),
      source: 'deterministic',
      leverage: { score: Math.round(r.score * 10) / 10, explanation: r.explanation },
    };
  });
}

/** Below this leverage, a fix is a polish note rather than a problem. */
export const MINOR_LEVERAGE = 3;

export function deterministicSummary(analysis: Analysis, goal: Goal, items: CoachingItem[]): string {
  const m = analysis.metrics;
  const top = Object.entries(m.counts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id, c]) => `${DETECTOR_LABELS[id as DetectorId].toLowerCase()} (${c})`);
  const lead = `${m.words} words, ${m.sentences} sentences, grade level ${m.gradeLevel}.`;
  if (!items.length) return `${lead} The detectors found nothing worth flagging. Read it aloud once more and trust your ear.`;
  if (items.every((i) => (i.leverage?.score ?? 0) < MINOR_LEVERAGE)) return `${lead} Nothing major stands out. The notes below are small polish; take them or leave them.`;
  return `${lead} Most frequent: ${top.join(' and ')}. The fixes below are ranked by leverage for the "${goal}" goal, not by count.`;
}
