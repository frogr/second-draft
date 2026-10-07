/**
 * Curated cliche list for Second Draft. Written for this project, not copied from a source.
 *
 * Pattern syntax (compiled to a case-insensitive regex with word boundaries):
 *   - spaces match any run of whitespace
 *   - {pos} matches a possessive pronoun (my, his, her, their, your, our, its)
 *   - {subj} matches a subject pronoun (I, he, she, they, we, you, it)
 *   - (a|b) is a plain regex alternation
 * `plain` is a literal, unglamorous replacement. It is meant as a starting point:
 * the coaching asks the writer to say the specific thing, not to paste the plain version.
 */
export interface ClicheEntry {
  pattern: string;
  plain: string;
  register: 'fiction' | 'business' | 'essay' | 'general';
}

export const CLICHES: ClicheEntry[] = [
  // fiction and narrative
  { pattern: 'dark and stormy night', plain: 'a wet night', register: 'fiction' },
  { pattern: '{pos} heart (pounded|pounding|was pounding|raced|racing|was racing|hammered|hammering)', plain: 'a pulse they could hear', register: 'fiction' },
  { pattern: '{pos} heart skipped a beat', plain: 'a jolt went through them', register: 'fiction' },
  { pattern: '{pos} blood ran cold', plain: 'they went still', register: 'fiction' },
  { pattern: 'let out a breath {subj} (didn\'t|did not) know {subj} (was|were|had been) holding', plain: 'breathed out', register: 'fiction' },
  { pattern: 'released a breath {subj} (didn\'t|did not) know {subj} (was|were|had been) holding', plain: 'breathed out', register: 'fiction' },
  { pattern: 'time stood still', plain: 'nobody moved', register: 'fiction' },
  { pattern: 'in the dead of (night|winter)', plain: 'late at night', register: 'fiction' },
  { pattern: 'a chill (ran|went) down {pos} spine', plain: 'they shivered', register: 'fiction' },
  { pattern: 'shivers? down {pos} spine', plain: 'a shiver', register: 'fiction' },
  { pattern: 'eyes like (saucers|limpid pools)', plain: 'wide eyes', register: 'fiction' },
  { pattern: 'piercing blue eyes', plain: 'blue eyes', register: 'fiction' },
  { pattern: 'raven(-| )black hair', plain: 'black hair', register: 'fiction' },
  { pattern: 'silence was deafening', plain: 'it was very quiet', register: 'fiction' },
  { pattern: 'deafening silence', plain: 'total quiet', register: 'fiction' },
  { pattern: 'all hell broke loose', plain: 'everything went wrong at once', register: 'fiction' },
  { pattern: 'out of nowhere', plain: 'suddenly', register: 'general' },
  { pattern: 'little did {subj} know', plain: '(cut this; show it later)', register: 'fiction' },
  { pattern: 'calm before the storm', plain: 'a quiet stretch', register: 'fiction' },
  { pattern: 'frozen in (fear|terror)', plain: 'unable to move', register: 'fiction' },
  { pattern: 'scared to death', plain: 'terrified', register: 'general' },
  { pattern: 'white as a (sheet|ghost)', plain: 'pale', register: 'fiction' },
  { pattern: 'quiet as a mouse', plain: 'silent', register: 'fiction' },
  { pattern: 'cold as ice', plain: 'freezing', register: 'fiction' },
  { pattern: 'dead as a doornail', plain: 'dead', register: 'fiction' },
  { pattern: 'fit as a fiddle', plain: 'healthy', register: 'general' },
  { pattern: 'busy as a bee', plain: 'busy', register: 'general' },
  { pattern: 'sly as a fox', plain: 'cunning', register: 'fiction' },
  { pattern: 'light as a feather', plain: 'light', register: 'general' },
  { pattern: 'avoid (it )?like the plague', plain: 'avoid at all costs', register: 'general' },
  { pattern: 'tears streamed down {pos} (face|cheeks)', plain: 'they cried', register: 'fiction' },
  { pattern: 'a single tear', plain: 'a tear', register: 'fiction' },
  { pattern: '{pos} stomach (dropped|churned|was in knots|twisted into knots)', plain: 'they felt sick', register: 'fiction' },
  { pattern: 'butterflies in {pos} stomach', plain: 'nerves', register: 'fiction' },
  { pattern: 'lump in {pos} throat', plain: 'they could not speak', register: 'fiction' },
  { pattern: 'a smile tugged at (the corners of )?{pos} (lips|mouth)', plain: 'they almost smiled', register: 'fiction' },
  { pattern: 'rolled {pos} eyes', plain: 'looked away, unimpressed', register: 'fiction' },
  { pattern: 'ran a hand through {pos} hair', plain: '(pick a gesture only this character makes)', register: 'fiction' },
  { pattern: 'the world (seemed to )?(stop|stopped) (spinning|turning)', plain: 'everything went quiet', register: 'fiction' },
  { pattern: 'at the speed of light', plain: 'very fast', register: 'general' },
  { pattern: 'in the blink of an eye', plain: 'instantly', register: 'general' },
  { pattern: 'before {subj} knew it', plain: 'soon', register: 'general' },
  { pattern: 'like a moth to a flame', plain: 'irresistibly', register: 'fiction' },
  { pattern: 'the rest is history', plain: '(say what happened next)', register: 'general' },
  { pattern: 'happily ever after', plain: 'for good', register: 'fiction' },
  { pattern: 'once upon a time', plain: 'years ago', register: 'fiction' },
  { pattern: 'it was all a dream', plain: '(cut this)', register: 'fiction' },
  { pattern: 'only time will tell', plain: 'we will see', register: 'general' },
  { pattern: 'every fiber of {pos} being', plain: 'completely', register: 'fiction' },
  { pattern: 'a sinking feeling', plain: 'dread', register: 'fiction' },
  { pattern: 'gut feeling', plain: 'instinct', register: 'general' },
  { pattern: 'sent shivers', plain: 'unsettled them', register: 'fiction' },
  { pattern: 'the last straw', plain: 'the final problem', register: 'general' },
  { pattern: 'cat got {pos} tongue', plain: 'nothing to say', register: 'general' },
  { pattern: 'a deer in (the )?headlights', plain: 'stunned', register: 'general' },
  { pattern: 'like a kid in a candy store', plain: 'delighted', register: 'general' },
  { pattern: 'paint the town red', plain: 'go out and celebrate', register: 'general' },
  { pattern: 'raining cats and dogs', plain: 'pouring', register: 'general' },
  { pattern: 'sun beat down', plain: 'it was hot', register: 'fiction' },
  { pattern: 'the sun (rose|was rising) over the horizon', plain: 'the sun came up', register: 'fiction' },

  // general idioms
  { pattern: 'at the end of the day', plain: 'ultimately', register: 'general' },
  { pattern: 'when all is said and done', plain: 'in the end', register: 'general' },
  { pattern: 'it goes without saying', plain: '(cut this)', register: 'general' },
  { pattern: 'needless to say', plain: '(cut this)', register: 'general' },
  { pattern: 'last but not least', plain: 'finally', register: 'general' },
  { pattern: 'easier said than done', plain: 'hard', register: 'general' },
  { pattern: 'better late than never', plain: 'late but useful', register: 'general' },
  { pattern: 'every cloud has a silver lining', plain: 'there is an upside', register: 'general' },
  { pattern: 'silver lining', plain: 'upside', register: 'general' },
  { pattern: 'in the nick of time', plain: 'just in time', register: 'general' },
  { pattern: 'only a matter of time', plain: 'inevitable', register: 'general' },
  { pattern: 'a blessing in disguise', plain: 'an unexpected benefit', register: 'general' },
  { pattern: 'the tip of the iceberg', plain: 'a small part', register: 'general' },
  { pattern: 'the elephant in the room', plain: 'the obvious problem', register: 'general' },
  { pattern: 'a perfect storm', plain: 'several problems at once', register: 'general' },
  { pattern: 'a double-edged sword', plain: 'a mixed blessing', register: 'general' },
  { pattern: 'between a rock and a hard place', plain: 'stuck between two bad options', register: 'general' },
  { pattern: 'the bottom line', plain: 'the main point', register: 'general' },
  { pattern: 'think outside the box', plain: 'try an unusual approach', register: 'business' },
  { pattern: 'outside the box', plain: 'unconventional', register: 'business' },
  { pattern: 'hit the ground running', plain: 'start contributing right away', register: 'business' },
  { pattern: 'hit the nail on the head', plain: 'got it exactly right', register: 'general' },
  { pattern: 'a piece of cake', plain: 'easy', register: 'general' },
  { pattern: 'a walk in the park', plain: 'easy', register: 'general' },
  { pattern: 'back to square one', plain: 'starting over', register: 'general' },
  { pattern: 'back to the drawing board', plain: 'starting over', register: 'general' },
  { pattern: 'beat around the bush', plain: 'avoid the point', register: 'general' },
  { pattern: 'bite the bullet', plain: 'do the hard thing', register: 'general' },
  { pattern: 'break the ice', plain: 'start the conversation', register: 'general' },
  { pattern: 'burn the midnight oil', plain: 'work late', register: 'general' },
  { pattern: 'by the same token', plain: 'similarly', register: 'general' },
  { pattern: 'cut corners', plain: 'skip steps', register: 'general' },
  { pattern: 'go the extra mile', plain: 'do more than asked', register: 'business' },
  { pattern: 'going forward', plain: 'from now on', register: 'business' },
  { pattern: 'in this day and age', plain: 'now', register: 'essay' },
  { pattern: 'leaps and bounds', plain: 'quickly', register: 'general' },
  { pattern: 'learning curve', plain: '(say what you had to learn)', register: 'business' },
  { pattern: 'level playing field', plain: 'fair contest', register: 'general' },
  { pattern: 'low-hanging fruit', plain: 'easy wins', register: 'business' },
  { pattern: 'move the needle', plain: 'make a measurable difference', register: 'business' },
  { pattern: 'on the same page', plain: 'in agreement', register: 'business' },
  { pattern: 'push the envelope', plain: 'go further than usual', register: 'business' },
  { pattern: 'raise the bar', plain: 'set a higher standard', register: 'business' },
  { pattern: 'reinvent the wheel', plain: 'redo solved work', register: 'business' },
  { pattern: 'state of the art', plain: 'current', register: 'business' },
  { pattern: 'the best of both worlds', plain: 'both advantages', register: 'general' },
  { pattern: 'touch base', plain: 'check in', register: 'business' },
  { pattern: 'circle back', plain: 'follow up', register: 'business' },
  { pattern: 'win-win', plain: '(say who gains what)', register: 'business' },
  { pattern: 'game(-| )changer', plain: 'big improvement', register: 'business' },
  { pattern: 'paradigm shift', plain: 'fundamental change', register: 'business' },
  { pattern: 'synergy', plain: 'cooperation', register: 'business' },
  { pattern: 'take it to the next level', plain: 'improve it', register: 'business' },
  { pattern: 'next level', plain: '(say what would improve)', register: 'business' },
  { pattern: 'wear many hats', plain: 'do several jobs', register: 'business' },
  { pattern: 'fast-paced environment', plain: 'busy team', register: 'business' },
  { pattern: 'team player', plain: '(name something you did with a team)', register: 'business' },
  { pattern: 'go-getter', plain: '(name something you started)', register: 'business' },
  { pattern: 'self-starter', plain: '(name something you started)', register: 'business' },
  { pattern: 'results-driven', plain: '(name a result)', register: 'business' },
  { pattern: 'detail-oriented', plain: '(name a detail you caught)', register: 'business' },
  { pattern: 'hard(-| )working individual', plain: '(name what you worked on)', register: 'business' },
  { pattern: 'think on {pos} feet', plain: 'adapt quickly', register: 'business' },
  { pattern: 'passionate about', plain: 'interested in', register: 'business' },
  { pattern: 'proven track record', plain: 'record', register: 'business' },
  { pattern: 'excellent communication skills', plain: '(show one example of clear communication)', register: 'business' },
  { pattern: 'strong work ethic', plain: '(name what you got done)', register: 'business' },
  { pattern: 'perfect fit', plain: 'good match', register: 'business' },
  { pattern: 'dream job', plain: '(say what draws you to this job)', register: 'business' },
  { pattern: 'add value', plain: 'help', register: 'business' },
  { pattern: 'best practices', plain: 'proven methods', register: 'business' },
  { pattern: 'core competencies', plain: 'strengths', register: 'business' },
  { pattern: 'deep dive', plain: 'close look', register: 'business' },
  { pattern: 'drill down', plain: 'look closer', register: 'business' },
  { pattern: 'bandwidth', plain: 'time', register: 'business' },
  { pattern: 'leverage {pos} (skills|experience|expertise)', plain: 'use my experience', register: 'business' },

  // essays and blog posts
  { pattern: 'since the (dawn|beginning) of (time|mankind|humanity|civilization)', plain: 'for a long time', register: 'essay' },
  { pattern: 'throughout (human )?history', plain: 'historically', register: 'essay' },
  { pattern: "in today's (world|society|fast-paced world|digital age)", plain: 'now', register: 'essay' },
  { pattern: 'in this (modern|digital) (age|era)', plain: 'now', register: 'essay' },
  { pattern: '(webster|the dictionary) defines', plain: '(define it yourself)', register: 'essay' },
  { pattern: 'first and foremost', plain: 'first', register: 'essay' },
  { pattern: 'each and every', plain: 'every', register: 'general' },
  { pattern: 'few and far between', plain: 'rare', register: 'general' },
  { pattern: 'all walks of life', plain: 'many backgrounds', register: 'essay' },
  { pattern: 'a whole new world', plain: 'a new experience', register: 'general' },
  { pattern: 'food for thought', plain: 'something to consider', register: 'essay' },
  { pattern: 'the million(-| )dollar question', plain: 'the key question', register: 'general' },
  { pattern: 'stands the test of time', plain: 'lasts', register: 'essay' },
  { pattern: 'stood the test of time', plain: 'lasted', register: 'essay' },
  { pattern: 'the power of', plain: '(say what it actually does)', register: 'essay' },
  { pattern: 'a journey of self-discovery', plain: '(say what you learned)', register: 'essay' },
  { pattern: 'changed my life', plain: '(say what changed)', register: 'essay' },
  { pattern: 'the rest of my life', plain: 'from then on', register: 'general' },
  { pattern: 'tip of {pos} tongue', plain: 'almost remembered', register: 'general' },
  { pattern: 'without further ado', plain: '(cut this)', register: 'essay' },
  { pattern: 'dive (right )?in', plain: 'start', register: 'essay' },
  { pattern: 'buckle up', plain: '(cut this)', register: 'essay' },
  { pattern: 'let that sink in', plain: '(cut this)', register: 'essay' },
  { pattern: 'a testament to', plain: 'evidence of', register: 'essay' },
  { pattern: 'in a nutshell', plain: 'in short', register: 'general' },
  { pattern: 'at this point in time', plain: 'now', register: 'general' },
];

const POS = '(?:my|his|her|their|your|our|its)';
const SUBJ = '(?:i|he|she|they|we|you|it)';

export interface CompiledCliche extends ClicheEntry {
  re: RegExp;
}

export function compileCliches(entries: ClicheEntry[] = CLICHES): CompiledCliche[] {
  return entries.map((e) => {
    const body = e.pattern
      .replace(/'/g, "['’]")
      .replace(/\{pos\}/g, POS)
      .replace(/\{subj\}/g, SUBJ)
      .replace(/ /g, '\\s+');
    return { ...e, re: new RegExp(`(?<![\\w'’-])${body}(?![\\w'’-])`, 'gi') };
  });
}
