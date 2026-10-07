/**
 * Word lists used by the detectors. Written for this project.
 * Everything is lower case. Keep each list short enough to read in one sitting.
 */

/** Forms of "to be" that can start a passive. */
export const BE_FORMS = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "isn't", "wasn't", "aren't", "weren't"]);

/** Irregular past participles, mapped to the simple past (used to rewrite "was taken by X" as "X took"). */
export const IRREGULAR_PARTICIPLES: Record<string, string> = {
  arisen: 'arose', awoken: 'awoke', beaten: 'beat', become: 'became', begun: 'began', bent: 'bent', bitten: 'bit',
  blown: 'blew', broken: 'broke', brought: 'brought', built: 'built', bought: 'bought', caught: 'caught',
  chosen: 'chose', cut: 'cut', dealt: 'dealt', done: 'did', drawn: 'drew', driven: 'drove', eaten: 'ate',
  fed: 'fed', felt: 'felt', fought: 'fought', found: 'found', forbidden: 'forbade', forgiven: 'forgave',
  forgotten: 'forgot', frozen: 'froze', given: 'gave', grown: 'grew', heard: 'heard', held: 'held', hidden: 'hid',
  hit: 'hit', hurt: 'hurt', kept: 'kept', known: 'knew', laid: 'laid', led: 'led', left: 'left', lent: 'lent',
  lost: 'lost', made: 'made', meant: 'meant', met: 'met', paid: 'paid', put: 'put', read: 'read', ridden: 'rode',
  rung: 'rang', run: 'ran', said: 'said', seen: 'saw', sent: 'sent', set: 'set', shaken: 'shook', shot: 'shot',
  shown: 'showed', shut: 'shut', sold: 'sold', sought: 'sought', spent: 'spent', spoken: 'spoke', spun: 'spun',
  stolen: 'stole', struck: 'struck', stung: 'stung', sung: 'sang', sunk: 'sank', swept: 'swept', sworn: 'swore',
  taken: 'took', taught: 'taught', thrown: 'threw', told: 'told', thought: 'thought', torn: 'tore',
  understood: 'understood', woken: 'woke', won: 'won', worn: 'wore', woven: 'wove', written: 'wrote',
};

/**
 * Words ending in -ed (or irregular participles) that, after "was/is", usually describe a state
 * rather than an action done to someone. "She was tired" is not passive. With a following "by",
 * the detector still counts them ("she was surprised by the noise").
 */
export const STATIVE_PARTICIPLES = new Set([
  'tired', 'excited', 'interested', 'bored', 'married', 'worried', 'scared', 'surprised', 'pleased',
  'concerned', 'related', 'located', 'based', 'involved', 'prepared', 'used', 'supposed', 'tied',
  'determined', 'convinced', 'satisfied', 'disappointed', 'embarrassed', 'ashamed', 'frightened',
  'terrified', 'exhausted', 'confused', 'amazed', 'annoyed', 'relieved', 'stunned', 'shocked', 'thrilled',
  'delighted', 'devastated', 'overwhelmed', 'frustrated', 'qualified', 'experienced', 'skilled',
  'talented', 'gifted', 'committed', 'dedicated', 'motivated', 'focused', 'engaged', 'closed', 'opened',
  'crowded', 'packed', 'finished', 'gone', 'done', 'lost', 'drunk', 'hurt', 'dressed', 'armed', 'aged',
  'detailed', 'complicated', 'sophisticated', 'advanced', 'limited', 'mixed', 'naked', 'wicked', 'rugged',
  'beloved', 'learned', 'blessed', 'cursed', 'crooked', 'jagged', 'ragged', 'red', 'bed', 'shed', 'need',
  'indeed', 'seed', 'feed', 'speed', 'greed', 'reed', 'weed', 'deed', 'hundred', 'sacred', 'naked',
  'starved', 'stuck', 'set', 'read', 'left', 'put', 'cut', 'hit', 'run', 'won', 'met', 'led', 'fed', 'made',
  'kept', 'said', 'felt', 'held', 'meant', 'thought', 'told', 'sold', 'paid', 'laid', 'heard', 'found',
]);

/** Single-word filler. Cutting them rarely changes the meaning. */
export const FILLER_WORDS = new Set([
  'very', 'really', 'just', 'quite', 'rather', 'actually', 'basically', 'literally', 'totally', 'simply',
  'truly', 'definitely', 'certainly', 'extremely', 'incredibly', 'absolutely', 'utterly', 'completely',
  'honestly', 'essentially', 'virtually', 'somewhat', 'super',
]);

/** Phrases that hedge a claim. Replacement is '' (cut) unless given. */
export const HEDGE_PHRASES: Array<{ pattern: string; replacement: string }> = [
  { pattern: 'i think that', replacement: '' },
  { pattern: 'i think', replacement: '' },
  { pattern: 'i believe that', replacement: '' },
  { pattern: 'i believe', replacement: '' },
  { pattern: 'i feel like', replacement: '' },
  { pattern: 'i feel that', replacement: '' },
  { pattern: 'in my opinion', replacement: '' },
  { pattern: 'it seems (like|that)', replacement: '' },
  { pattern: 'it seems', replacement: '' },
  { pattern: 'sort of', replacement: '' },
  { pattern: 'kind of', replacement: '' },
  { pattern: 'a little bit', replacement: '' },
  { pattern: 'a bit', replacement: '' },
  { pattern: 'perhaps', replacement: '' },
  { pattern: 'maybe', replacement: '' },
  { pattern: 'arguably', replacement: '' },
  { pattern: 'more or less', replacement: '' },
  { pattern: 'to some extent', replacement: '' },
  { pattern: 'i would say that', replacement: '' },
  { pattern: 'i would say', replacement: '' },
];

/** Wordy phrases with a shorter equivalent. */
export const WORDY_PHRASES: Array<{ pattern: string; replacement: string }> = [
  { pattern: 'in order to', replacement: 'to' },
  { pattern: 'due to the fact that', replacement: 'because' },
  { pattern: 'owing to the fact that', replacement: 'because' },
  { pattern: 'in spite of the fact that', replacement: 'although' },
  { pattern: 'despite the fact that', replacement: 'although' },
  { pattern: 'for the purpose of', replacement: 'for' },
  { pattern: 'in the event that', replacement: 'if' },
  { pattern: 'with regard to', replacement: 'about' },
  { pattern: 'with respect to', replacement: 'about' },
  { pattern: 'in terms of', replacement: 'in' },
  { pattern: 'a large number of', replacement: 'many' },
  { pattern: 'the majority of', replacement: 'most' },
  { pattern: 'has the ability to', replacement: 'can' },
  { pattern: 'have the ability to', replacement: 'can' },
  { pattern: 'is able to', replacement: 'can' },
  { pattern: 'are able to', replacement: 'can' },
  { pattern: 'it is important to note that', replacement: '' },
  { pattern: 'it should be noted that', replacement: '' },
  { pattern: 'for all intents and purposes', replacement: '' },
  { pattern: 'the fact that', replacement: 'that' },
];

/** Words before "kind of" / "sort of" that make it a real noun phrase ("a kind of bird"). */
export const KIND_OF_DETERMINERS = new Set(['a', 'an', 'the', 'what', 'this', 'that', 'these', 'those', 'every', 'any', 'some', 'one', 'same', 'which', 'no']);

/** Words ending in -ly that are not adverbs to cut (adjectives, nouns, names, or needed). */
export const LY_STOPLIST = new Set([
  'only', 'early', 'likely', 'unlikely', 'family', 'belly', 'jelly', 'bully', 'folly', 'ally', 'rally', 'holly',
  'lily', 'reply', 'supply', 'apply', 'imply', 'comply', 'rely', 'multiply', 'fly', 'butterfly', 'dragonfly',
  'firefly', 'anomaly', 'assembly', 'monopoly', 'italy', 'july', 'daily', 'weekly', 'monthly', 'yearly', 'hourly',
  'nightly', 'quarterly', 'holy', 'ugly', 'silly', 'friendly', 'unfriendly', 'lonely', 'lovely', 'lively',
  'costly', 'deadly', 'elderly', 'orderly', 'timely', 'wily', 'curly', 'jolly', 'chilly', 'oily', 'smelly',
  'wobbly', 'bubbly', 'prickly', 'sickly', 'surly', 'burly', 'gangly', 'ghostly', 'worldly', 'heavenly',
  'cowardly', 'scholarly', 'homely', 'comely', 'manly', 'womanly', 'motherly', 'fatherly', 'brotherly',
  'sisterly', 'neighborly', 'kindly', 'beastly', 'stately', 'leisurely', 'unruly', 'gnarly', 'grisly',
  'measly', 'pebbly', 'crumbly', 'wrinkly', 'tingly', 'jiggly', 'squiggly', 'steely', 'woolly', 'hilly',
  'frilly', 'bully', 'gully', 'tally', 'dolly', 'golly', 'trolley', 'medley', 'barley', 'valley', 'alley',
  'galley', 'volley', 'pulley', 'kidney', 'emily', 'kelly', 'molly', 'polly', 'sally', 'billy', 'willy',
  'reilly', 'oily', 'rely', 'anomaly', 'homily', 'doily', 'filly', 'lolly', 'sully', 'dally', 'jolly',
  'ply', 'sly', 'shyly', 'slyly', 'bodily', 'early', 'fly', 'not',
]);

/** Verbs that introduce speech. */
export const NEUTRAL_SPEECH_VERBS = new Set(['said', 'says', 'say', 'asked', 'asks', 'ask', 'told', 'tells', 'answered', 'replied', 'whispered', 'shouted', 'called', 'yelled']);

/** Showy speech verbs. "Said" is invisible; these pull the eye off the dialogue. */
export const FANCY_SPEECH_VERBS = new Set([
  'exclaimed', 'retorted', 'hissed', 'growled', 'snapped', 'barked', 'chortled', 'interjected', 'queried',
  'inquired', 'enquired', 'opined', 'declared', 'proclaimed', 'announced', 'bellowed', 'snarled', 'purred',
  'cooed', 'gushed', 'quipped', 'remarked', 'stated', 'uttered', 'intoned', 'breathed', 'spat', 'thundered',
  'admonished', 'beseeched', 'implored', 'chided', 'scoffed', 'sneered', 'chimed', 'mused', 'pondered',
  'vociferated', 'ejaculated', 'expostulated', 'stammered', 'blurted', 'murmured', 'muttered', 'whined',
]);

/** Actions that cannot produce speech. "'Fine,' she smiled." */
export const NON_SPEECH_VERBS = new Set([
  'smiled', 'grinned', 'laughed', 'chuckled', 'giggled', 'sighed', 'shrugged', 'nodded', 'frowned',
  'smirked', 'winked', 'beamed', 'scowled', 'sniffed', 'snorted', 'grimaced', 'glared', 'huffed',
]);

/** Emotion adjectives that "tell" when used after was/felt/seemed. */
export const EMOTION_ADJECTIVES = new Set([
  'angry', 'sad', 'happy', 'nervous', 'scared', 'afraid', 'anxious', 'excited', 'frustrated', 'upset',
  'furious', 'terrified', 'lonely', 'jealous', 'embarrassed', 'ashamed', 'guilty', 'relieved',
  'disappointed', 'confused', 'hopeful', 'depressed', 'overwhelmed', 'annoyed', 'worried', 'surprised',
  'shocked', 'proud', 'grateful', 'bored', 'tense', 'hurt', 'heartbroken', 'devastated', 'thrilled', 'elated',
  'miserable', 'uneasy', 'uncomfortable', 'frightened', 'horrified', 'ecstatic', 'joyful', 'content',
  'irritated', 'enraged', 'panicked', 'desperate', 'hopeless', 'helpless', 'resentful', 'bitter', 'calm',
  'glad', 'delighted', 'humiliated', 'betrayed', 'insecure', 'restless', 'scared', 'stressed', 'passionate',
  'eager', 'enthusiastic', 'mad',
]);

/** Emotion nouns that "tell" in "a wave of X", "filled with X", "felt X". */
export const EMOTION_NOUNS = new Set([
  'anger', 'sadness', 'happiness', 'fear', 'joy', 'relief', 'panic', 'dread', 'guilt', 'shame', 'excitement',
  'anxiety', 'grief', 'rage', 'terror', 'jealousy', 'loneliness', 'despair', 'hope', 'regret', 'sorrow',
  'frustration', 'embarrassment', 'pride', 'love', 'hatred', 'disgust', 'nervousness', 'happiness', 'elation',
  'gratitude', 'resentment', 'unease',
]);

/** Verbs that link a subject to an emotion adjective. */
export const TELLING_LINKS = new Set(['felt', 'feel', 'feels', 'feeling', 'was', 'were', 'is', 'am', 'are', "'m", "'re", 'seemed', 'seems', 'looked', 'looks', 'became', 'becomes', 'grew', 'got', 'gets']);

/** Intensifiers allowed between the link verb and the emotion word. */
export const INTENSIFIERS = new Set(['very', 'so', 'really', 'extremely', 'incredibly', 'quite', 'deeply', 'truly', 'totally', 'completely', 'a', 'little', 'bit', 'more', 'most', 'too', 'suddenly', 'utterly', 'still', 'also', 'not']);

/** Common words ignored by the repetition detector. */
export const STOPWORDS = new Set(
  `a about above after again against all almost also although always am among an and another any anyone anything are
  around as at back be became because been before being below between both but by came can cannot could did do does
  doing done down during each either else enough even ever every few for from further get gets got had has have having
  he her here hers herself him himself his how however i if in into is it its itself just know last least less let like
  made make many may me might more most much must my myself never next no nor not now of off often on once one only or
  other our ours ourselves out over own perhaps rather really said same say says see seemed seems she should since so
  some something still such than that the their theirs them themselves then there these they thing things this those
  though through to too toward under until up upon us very was we well went were what when where whether which while
  who whom whose why will with within without would yet you your yours yourself yourselves into onto it's i'm don't
  didn't can't won't wasn't isn't couldn't wouldn't shouldn't he's she's they're we're you're that's there's i'd i'll
  i've let's away going go goes come comes took take takes looked look looks felt feel time times way ways day days
  year years two three first new old good right left long little each every`.split(/\s+/),
);

export const WEATHER_WORDS = /\b(rain(ed|ing|y)?|sun(ny|shine|light)?|wind(y)?|storm(y)?|weather|sky|skies|clouds?|cloudy|snow(ed|ing)?|fog(gy)?|drizzle|thunder|lightning|overcast|humid)\b/i;
export const WAKING_RE = /\b(woke( up)?|wakes( up)?|alarm (clock )?(went off|rang|blared|buzzed)|opened (my|his|her|their) eyes)\b/i;
export const GENERIC_OPENING_RE = /^(?:["“]?)(my name is\b|i am writing (to|in)\b|i'm writing (to|in)\b|i am applying\b|i would like to apply\b|in this (essay|post|article|paper)\b|this (essay|post|article|paper) (will|is about)\b|since the (dawn|beginning) of\b|throughout (human )?history\b|webster's|the dictionary defines\b|have you ever (wondered|thought)\b|hello,? my name\b|to whom it may concern\b|dear hiring manager,?\s+i am writing\b)/i;
export const THROAT_CLEARING_RE = /^(?:["“]?)(there (is|are|was|were)\b|it (is|was) (a|an|the)\b)/i;
