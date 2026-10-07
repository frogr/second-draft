/**
 * Eval passages for Second Draft. All 25 are original and synthetic, written for this project.
 *
 * Each passage lists what a careful editor would flag, per detector category. Labels were written
 * from that point of view, not from what the detectors happen to catch, so misses and false alarms
 * are real. Passages 07, 09, 14 and 18 are clean controls with no labels.
 *
 * A label points at text by `quote` (matched on word boundaries) and `nth` occurrence (1-based).
 * For sentence- and paragraph-level detectors the quote is the sentence (or its opening words).
 *
 * Labeling policy, by detector:
 * - passive: a form of "be" plus a participle where something is done to the subject. States ("was tired") are not passive.
 * - filler: filler words, hedges (including "may", "might"), and wordy phrases with a shorter form.
 * - adverb: -ly adverbs in narration that a coach would question. Not in dialogue, not on dialogue tags.
 * - cliche: stock phrases, whether or not they are in our list.
 * - repetition: accidental echoes of a content word within about 40 words. Deliberate repetition and names are not labeled.
 * - dialogue_tag: showy speech verbs (including "explained"), adverbs on tags, and actions used as tags.
 * - show_tell: an emotion named instead of shown.
 * - sentence_length: sentences of 30+ words, and runs of 4+ sentences of near-identical length that read flat.
 * - paragraph_rhythm: paragraphs over 160 words, runs of 4+ one-sentence narration paragraphs.
 * - opening: stock first lines (weather, waking, "I am writing to", "To whom it may concern", throat-clearing).
 * - readability: sentences dense with abstract nouns or long words.
 */
import type { DetectorId } from '../src/core/types.js';

export interface Label {
  detector: DetectorId;
  quote: string;
  nth?: number;
}

export interface Passage {
  id: string;
  register: 'fiction' | 'cover_letter' | 'essay' | 'business' | 'personal';
  text: string;
  labels: Label[];
}

export const PASSAGES: Passage[] = [
  {
    id: 'p01-motel',
    register: 'fiction',
    text: `The rain fell on the town all night. Marcus had been driving for nine hours, and the motel sign blinked at him through the wipers. He parked, grabbed his bag and walked quickly to the office. The clerk was asleep behind the counter. Marcus rang the bell twice.

"We're full," the clerk muttered.

"I called ahead," Marcus said.`,
    labels: [
      { detector: 'opening', quote: 'The rain fell on the town all night.' },
      { detector: 'adverb', quote: 'quickly' },
    ],
  },
  {
    id: 'p02-letter',
    register: 'fiction',
    text: `Little did she know that the letter would change everything. Clara was nervous as she tore it open. The words were written by her father, who had been gone for ten years. Her heart skipped a beat. She read it again, very slowly, and then she sat down on the kitchen floor.`,
    labels: [
      { detector: 'cliche', quote: 'Little did she know' },
      { detector: 'show_tell', quote: 'was nervous' },
      { detector: 'passive', quote: 'were written' },
      { detector: 'cliche', quote: 'Her heart skipped a beat' },
      { detector: 'filler', quote: 'very' },
      { detector: 'adverb', quote: 'slowly' },
    ],
  },
  {
    id: 'p03-late',
    register: 'fiction',
    text: `"You're late," Dana snapped.

"The train was delayed," Leo explained.

"It's always the train." She crossed her arms.

"Fine," he sighed. "Next time I'll walk."

"You'd better," she said icily.`,
    labels: [
      { detector: 'dialogue_tag', quote: 'snapped' },
      { detector: 'dialogue_tag', quote: 'explained' },
      { detector: 'dialogue_tag', quote: 'sighed' },
      { detector: 'dialogue_tag', quote: 'icily' },
    ],
  },
  {
    id: 'p04-analyst',
    register: 'cover_letter',
    text: `Dear Hiring Manager,

I am writing to apply for the Data Analyst role at Brightline. I am a detail-oriented team player who is passionate about data. In my last job, reports were automated by me using Python, which saved the team a large number of hours each month. I believe that I would be a great addition to your team.`,
    labels: [
      { detector: 'opening', quote: 'I am writing to apply for the Data Analyst role at Brightline.' },
      { detector: 'cliche', quote: 'detail-oriented' },
      { detector: 'cliche', quote: 'team player' },
      { detector: 'cliche', quote: 'passionate about' },
      { detector: 'passive', quote: 'were automated' },
      { detector: 'filler', quote: 'a large number of' },
      { detector: 'filler', quote: 'I believe that' },
      { detector: 'repetition', quote: 'team', nth: 2 },
      { detector: 'repetition', quote: 'team', nth: 3 },
    ],
  },
  {
    id: 'p05-stories',
    register: 'essay',
    text: `Since the dawn of time, humans have told stories. In today's world, stories are consumed on phones rather than around fires. It is important to note that the format has changed but the need has not. Basically, we still want to know what happens next, and we still want someone to tell us.`,
    labels: [
      { detector: 'opening', quote: 'Since the dawn of time, humans have told stories.' },
      { detector: 'cliche', quote: 'Since the dawn of time' },
      { detector: 'cliche', quote: "In today's world" },
      { detector: 'passive', quote: 'are consumed' },
      { detector: 'filler', quote: 'It is important to note that' },
      { detector: 'filler', quote: 'Basically' },
    ],
  },
  {
    id: 'p06-checkin',
    register: 'business',
    text: `Hi team,

I just wanted to quickly check in about the launch. I think we might be sort of behind on the onboarding flow. Maybe we could perhaps move the review to Thursday? Let me know what works. Going forward, I'd like to touch base every Monday so we stay on the same page.`,
    labels: [
      { detector: 'opening', quote: 'I just wanted to quickly check in about the launch.' },
      { detector: 'filler', quote: 'just' },
      { detector: 'adverb', quote: 'quickly' },
      { detector: 'filler', quote: 'I think' },
      { detector: 'filler', quote: 'might' },
      { detector: 'filler', quote: 'sort of' },
      { detector: 'filler', quote: 'Maybe' },
      { detector: 'filler', quote: 'perhaps' },
      { detector: 'cliche', quote: 'Going forward' },
      { detector: 'cliche', quote: 'touch base' },
      { detector: 'cliche', quote: 'on the same page' },
    ],
  },
  {
    id: 'p07-boat',
    register: 'fiction',
    text: `Mara stole the boat an hour before dawn. She rowed past the ferry slip, past the warehouses with their broken teeth of windows, and out to where the river widened and the city went quiet. Nobody followed. When the oars began to blister her palms she wrapped them in her scarf and kept going.`,
    labels: [],
  },
  {
    id: 'p08-dent',
    register: 'fiction',
    text: `Jonah felt angry when he saw the dent in his car. He was furious. He looked around the parking lot, but it was empty, and he felt a wave of frustration. A note was tucked under the wiper. It said only: Sorry.`,
    labels: [
      { detector: 'show_tell', quote: 'felt angry' },
      { detector: 'show_tell', quote: 'was furious' },
      { detector: 'show_tell', quote: 'felt a wave of frustration' },
      { detector: 'passive', quote: 'was tucked' },
    ],
  },
  {
    id: 'p09-scheduling',
    register: 'cover_letter',
    text: `Dear Ms. Okafor,

Last spring I rebuilt the scheduling tool our nurses use at Mercy General. Shift swaps used to take two days and three phone calls. Now they take four minutes in an app. I'd like to do the same kind of work on your clinical operations team.`,
    labels: [],
  },
  {
    id: 'p10-framework',
    register: 'essay',
    text: `The implementation of the new evaluation framework necessitated the reconsideration of existing documentation and the establishment of standardized procedures for the measurement of performance. Teams adopted it slowly. Some never did.`,
    labels: [{ detector: 'readability', quote: 'The implementation of the new evaluation framework' }],
  },
  {
    id: 'p11-bus',
    register: 'fiction',
    text: `By the time the bus finally pulled into the depot at the edge of the city, where the streetlights gave way to fields and the fields gave way to a darkness that seemed to go on forever, Ruth had decided she would not call her sister after all. She got off last.`,
    labels: [
      { detector: 'sentence_length', quote: 'By the time the bus finally pulled into the depot' },
      { detector: 'adverb', quote: 'finally' },
    ],
  },
  {
    id: 'p12-committee',
    register: 'business',
    text: `It was decided by the committee that the budget would be reduced. Concerns were raised about the timeline, and a revised plan is expected to be submitted by Friday. Questions should be directed to the finance office.`,
    labels: [
      { detector: 'passive', quote: 'was decided' },
      { detector: 'passive', quote: 'be reduced' },
      { detector: 'passive', quote: 'were raised' },
      { detector: 'passive', quote: 'is expected' },
      { detector: 'passive', quote: 'be submitted' },
      { detector: 'passive', quote: 'be directed' },
    ],
  },
  {
    id: 'p13-running',
    register: 'personal',
    text: `I really, truly believe that running saved my life. Honestly, before I started, I was kind of a mess. I was totally burned out at work and I literally could not sleep. Now I run four mornings a week, and it has changed my life.`,
    labels: [
      { detector: 'filler', quote: 'really' },
      { detector: 'filler', quote: 'truly' },
      { detector: 'filler', quote: 'Honestly' },
      { detector: 'filler', quote: 'kind of' },
      { detector: 'filler', quote: 'totally' },
      { detector: 'filler', quote: 'literally' },
      { detector: 'cliche', quote: 'saved my life' },
      { detector: 'cliche', quote: 'changed my life' },
      { detector: 'repetition', quote: 'life', nth: 2 },
    ],
  },
  {
    id: 'p14-key',
    register: 'fiction',
    text: `"Where's the key?" Nina asked.

"Under the mat."

"There's no mat."

Theo looked up from the stove. "Then it's under where the mat used to be."`,
    labels: [],
  },
  {
    id: 'p15-selfstarter',
    register: 'cover_letter',
    text: `To whom it may concern,

I'm a self-starter with a proven track record in fast-paced environments. I feel like my skills would be a perfect fit for this position. I have experience in sales, marketing and operations, and I am able to wear many hats. Thank you for considering my application.`,
    labels: [
      { detector: 'opening', quote: 'To whom it may concern,' },
      { detector: 'cliche', quote: 'self-starter' },
      { detector: 'cliche', quote: 'proven track record' },
      { detector: 'cliche', quote: 'fast-paced environments' },
      { detector: 'cliche', quote: 'perfect fit' },
      { detector: 'cliche', quote: 'wear many hats' },
      { detector: 'filler', quote: 'I feel like' },
      { detector: 'filler', quote: 'am able to' },
    ],
  },
  {
    id: 'p16-trees',
    register: 'essay',
    text: `Cities need more trees. Trees cool the streets in summer. They clean the air for everyone. They give birds a place to live. They make people feel calmer. We should plant more of them.`,
    labels: [{ detector: 'sentence_length', quote: 'Trees cool the streets in summer.' }],
  },
  {
    id: 'p17-ridge',
    register: 'fiction',
    text: `The sun beat down on the dusty road. Jack's blood ran cold when he saw the rider on the ridge. Time stood still. Then, out of nowhere, a shot rang out, and all hell broke loose.`,
    labels: [
      { detector: 'opening', quote: 'The sun beat down on the dusty road.' },
      { detector: 'cliche', quote: 'sun beat down' },
      { detector: 'cliche', quote: "Jack's blood ran cold" },
      { detector: 'cliche', quote: 'Time stood still' },
      { detector: 'cliche', quote: 'out of nowhere' },
      { detector: 'cliche', quote: 'a shot rang out' },
      { detector: 'cliche', quote: 'all hell broke loose' },
    ],
  },
  {
    id: 'p18-buttons',
    register: 'personal',
    text: `My grandmother kept a jar of buttons on the windowsill. When I was six she let me sort them by color while she cooked. I don't remember what we ate. I remember the blue ones, and how she let me keep one.`,
    labels: [],
  },
  {
    id: 'p19-vendor',
    register: 'business',
    text: `Due to the fact that the vendor missed the deadline, we were not able to ship the update. In order to avoid this in the future, we will be adding a buffer week. With regard to the budget, there is no change at this point in time.`,
    labels: [
      { detector: 'filler', quote: 'Due to the fact that' },
      { detector: 'filler', quote: 'were not able to' },
      { detector: 'filler', quote: 'In order to' },
      { detector: 'filler', quote: 'With regard to' },
      { detector: 'cliche', quote: 'at this point in time' },
    ],
  },
  {
    id: 'p20-baby',
    register: 'fiction',
    text: `She closed the door softly and tiptoed carefully across the room. The baby was sleeping peacefully. Gently, she lifted the blanket and smiled happily at the tiny face.`,
    labels: [
      { detector: 'adverb', quote: 'softly' },
      { detector: 'adverb', quote: 'carefully' },
      { detector: 'adverb', quote: 'peacefully' },
      { detector: 'adverb', quote: 'Gently' },
      { detector: 'adverb', quote: 'happily' },
    ],
  },
  {
    id: 'p21-attention',
    register: 'essay',
    text: `It seems that social media may arguably have some effect on attention spans. In my opinion, the evidence is somewhat mixed. Perhaps more research is needed before we can more or less say anything definitive.`,
    labels: [
      { detector: 'filler', quote: 'It seems that' },
      { detector: 'filler', quote: 'may' },
      { detector: 'filler', quote: 'arguably' },
      { detector: 'filler', quote: 'In my opinion' },
      { detector: 'filler', quote: 'somewhat' },
      { detector: 'filler', quote: 'Perhaps' },
      { detector: 'filler', quote: 'more or less' },
      { detector: 'passive', quote: 'is needed' },
    ],
  },
  {
    id: 'p22-toast',
    register: 'fiction',
    text: `The kitchen smelled of burnt toast. Ellis opened the window, but the smell of the toast followed him into the hall, and the hall smelled of it for the rest of the morning.`,
    labels: [
      { detector: 'repetition', quote: 'smell' },
      { detector: 'repetition', quote: 'smelled', nth: 2 },
      { detector: 'repetition', quote: 'toast', nth: 2 },
      { detector: 'repetition', quote: 'hall', nth: 2 },
    ],
  },
  {
    id: 'p23-tutoring',
    register: 'cover_letter',
    text: `Dear Hiring Committee,

When I started tutoring algebra at the public library in Queens, I had four students, a borrowed whiteboard and no idea how to explain negative numbers to a nine-year-old who had already decided she hated math. Two years later the program has sixty students and a waitlist. I want to bring that same patience and that same stubbornness to the Program Coordinator role at the Brightwater Reading Project.`,
    labels: [{ detector: 'sentence_length', quote: 'When I started tutoring algebra' }],
  },
  {
    id: 'p24-lake',
    register: 'personal',
    text: `Every summer my uncle drove us out to the lake in a green station wagon that smelled of sunscreen and gasoline, and every summer he told the same story about the night he saw something big moving under the dock. We never believed him. My cousin Pete would roll his eyes and my sister would pretend to be asleep, but I listened, because I was the youngest and because he told it to me as if I were the only one in the car. He described the water going flat and black, the dock boards creaking, a shape longer than a canoe sliding past without a sound. He said he stood there until the moon came out and then he walked back to the cabin and never told anyone until that summer. When I was twelve I asked him why he told us at all. He thought about it for a long mile of highway. Then he said that a story you keep to yourself starts to feel like a lie, and he did not want to be a liar.`,
    labels: [
      { detector: 'paragraph_rhythm', quote: 'Every summer my uncle drove us' },
      { detector: 'sentence_length', quote: 'Every summer my uncle drove us' },
      { detector: 'sentence_length', quote: 'My cousin Pete would roll his eyes' },
    ],
  },
  {
    id: 'p25-hale',
    register: 'fiction',
    text: `Detective Hale was a hard-working individual who had seen it all. The body had been found by a jogger at six. "Another one," Hale said grimly, crouching by the tape. He felt sick. Somewhere a dog barked, and the morning traffic hummed on the bridge.`,
    labels: [
      { detector: 'cliche', quote: 'hard-working individual' },
      { detector: 'cliche', quote: 'seen it all' },
      { detector: 'passive', quote: 'been found' },
      { detector: 'dialogue_tag', quote: 'grimly' },
    ],
  },
];
