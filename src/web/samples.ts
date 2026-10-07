/** Sample drafts. All original and synthetic, written for this demo. */
export const SAMPLES = {
  fiction: {
    label: 'Fiction opening',
    goal: 'vivid',
    text: `It was a dark and stormy night, and the rain was falling very heavily on the old house at the end of Mercer Street. Eleanor was nervous. She walked slowly to the window and looked out at the street, which was empty, and she thought about the letter that had been delivered by the mailman that morning, the letter she had been waiting for since the start of the summer. Her heart was pounding. Little did she know that everything was about to change.

"Are you going to open it?" her brother asked curiously.

"Maybe later," she sighed.

The letter was sitting on the kitchen table. It was a cream envelope with her name on it in handwriting she didn't recognize. She felt a wave of dread. She really didn't want to open the letter, but she knew that at the end of the day she would have to open it. She picked it up. She put it down. She picked it up again.`,
  },
  fictionRevised: {
    label: 'Fiction, second draft',
    goal: 'vivid',
    text: `The envelope had been on the kitchen table since nine that morning, propped against the sugar bowl where the mailman left it. Eleanor had circled it twice.

Rain worked at the gutters of the house on Mercer Street. She stood at the window and counted the parked cars, then counted them again.

"Are you going to open it?" her brother asked.

"Later." She wiped a clean square in the fogged glass.

Cream paper. Her name in a hand she didn't know. She had waited all summer for this, and now her fingers would not stop tapping the sill. She picked it up. She put it down. She picked it up again, and this time she slid a thumb under the flap.`,
  },
  cover: {
    label: 'Cover letter',
    goal: 'voice',
    text: `Dear Hiring Manager,

I am writing to apply for the Product Engineer position at Northwind. I am a passionate, results-driven team player with a proven track record of delivering high-quality software in a fast-paced environment. I think I would be a perfect fit for this role.

In my current job, I was responsible for the checkout flow, which was rebuilt by our team last year. I basically worked on the payment integration and the testing. At the end of the day, I really believe that good software is built by people who care about the details.

I would love the opportunity to bring my skills to Northwind and take your product to the next level. Thank you for your time and consideration.`,
  },
} as const;

export type SampleId = keyof typeof SAMPLES;
