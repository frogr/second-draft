import type { Finding } from '../types.js';
import { compileCliches } from '../lexicon/cliches.js';
import { allMatches, finding, inDialogue, type DetectorContext } from './context.js';
import { keepLongest } from './overlap.js';

const COMPILED = compileCliches();

/** Phrases from the curated cliche list. Dialogue is skipped, since characters are allowed to talk in cliches. */
export function detectCliches(ctx: DetectorContext): Finding[] {
  const { text } = ctx.seg;
  const out: Finding[] = [];
  for (const c of COMPILED) {
    for (const m of allMatches(c.re, text)) {
      const start = m.index;
      const end = start + m[0].length;
      if (inDialogue(ctx, start, end)) continue;
      // Fiction cliches need invention, not a swap, so they get no automatic replacement.
      const instruction = c.plain.startsWith('(');
      const swappable = !instruction && c.register !== 'fiction';
      out.push(
        finding(ctx, 'cliche', start, end, instruction ? `"${m[0]}" is a stock phrase; ${c.plain.slice(1, -1)}` : `"${m[0]}" is a stock phrase; plainly, "${c.plain}"`, 2, {
          kind: c.register,
          ...(swappable ? { replacement: c.plain } : {}),
        }),
      );
    }
  }
  return keepLongest(out);
}
