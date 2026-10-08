/**
 * The agent, measured. Needs ANTHROPIC_API_KEY (or OPENAI_API_KEY).
 *
 * Every eval passage goes through coach() with the live provider, the same code path the
 * web app uses. This records what the validator and the limits saw:
 *
 *   - how often the first submit_coaching call passed validation in full
 *   - how many items were repaired, dropped, or backfilled by the deterministic coach
 *   - how often the agent fell back entirely, and why
 *   - turns, tool calls, tokens, cost and latency
 *
 * Writes evals/results/agent-<model>.json and agent-<model>.md.
 *
 *   npm run eval:agent -- --limit 3          a quick look
 *   npm run eval:agent -- --only p11-bus      one or more passages by id, with the validator's messages (no files written)
 *   ANTHROPIC_MODEL=claude-haiku-4-5 npm run eval:agent
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coach, pickProvider } from '../src/coach/index.js';
import type { Goal } from '../src/coach/types.js';
import { PASSAGES, type Passage } from './passages.js';

// USD per million tokens, input and output. Unknown models get no cost, not a wrong one.
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'gpt-4o-mini': [0.15, 0.6],
};

// The goal a writer of that kind of text would most likely pick.
const GOAL_FOR: Record<Passage['register'], Goal> = { fiction: 'vivid', cover_letter: 'voice', essay: 'clearer', business: 'tighter', personal: 'balanced' };

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number.parseInt(args[limitArg + 1], 10) : Infinity;
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null;
const partial = only !== null || Number.isFinite(limit);

const provider = pickProvider(process.env);
if (!provider) {
  console.error('Set ANTHROPIC_API_KEY or OPENAI_API_KEY. This eval exists to measure the agent.');
  process.exit(2);
}

interface Row {
  id: string;
  register: Passage['register'];
  goal: Goal;
  words: number;
  status: 'submitted' | 'fallback';
  failure?: string;
  /** submit_coaching calls: the first, and the repair turn if there was one */
  submits: { submitted: number; valid: number; ok: boolean }[];
  modelItems: number;
  backfilled: number;
  dropped: number;
  turns: number;
  toolCalls: string[];
  inputTokens: number;
  outputTokens: number;
  ms: number;
  notes: string[];
  /** what the validator said on each submit, verbatim */
  validator: string[];
}

const rows: Row[] = [];
for (const p of PASSAGES.filter((x) => !only || only.has(x.id)).slice(0, Number.isFinite(limit) ? limit : undefined)) {
  const goal = GOAL_FOR[p.register];
  const t0 = performance.now();
  const r = await coach({ draft: p.text, goal, provider });
  const ms = Math.round(performance.now() - t0);
  const fallbackStep = r.trace.find((s) => s.kind === 'note' && s.name === 'fallback');
  const submits = r.trace
    .filter((s) => s.kind === 'validator')
    .map((s) => {
      const m = /^(\d+) of (\d+) items valid/.exec(s.output);
      return { submitted: m ? Number(m[2]) : 0, valid: m ? Number(m[1]) : 0, ok: s.ok };
    });
  const droppedNote = r.notes.find((n) => /failed validation after the repair turn/.test(n));
  const row: Row = {
    id: p.id,
    register: p.register,
    goal,
    words: r.analysis.metrics.words,
    status: fallbackStep ? 'fallback' : 'submitted',
    failure: fallbackStep?.output,
    submits,
    modelItems: r.items.filter((i) => i.source === 'model').length,
    backfilled: r.items.filter((i) => i.source === 'deterministic').length,
    dropped: droppedNote ? Number.parseInt(droppedNote, 10) || 0 : 0,
    turns: r.trace.filter((s) => s.kind === 'model').length,
    toolCalls: r.trace.filter((s) => s.kind === 'tool' && s.ms > 0).map((s) => s.name),
    inputTokens: r.usage?.inputTokens ?? 0,
    outputTokens: r.usage?.outputTokens ?? 0,
    ms,
    notes: r.notes,
    validator: r.trace.filter((s) => s.kind === 'validator').map((s) => s.output),
  };
  rows.push(row);
  if (only) for (const st of r.trace) if (st.kind === 'model' || st.kind === 'validator') console.log(`    ${st.kind}: ${st.output}`);
  const first = submits[0];
  console.log(
    `${p.id} [${p.register}/${goal}] ${row.status}${row.failure ? ` (${row.failure})` : ''} first submit ${first ? `${first.valid}/${first.submitted}` : 'none'}${submits.length > 1 ? ` repair ${submits[1].valid}/${submits[1].submitted}` : ''} items model ${row.modelItems} backfilled ${row.backfilled} turns ${row.turns} ${row.inputTokens + row.outputTokens} tok ${ms}ms`,
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : 'n/a');
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const finished = rows.filter((r) => r.status === 'submitted');
const withSubmit = rows.filter((r) => r.submits.length > 0);
const firstClean = withSubmit.filter((r) => r.submits[0].ok).length;
const firstItems = sum(withSubmit.map((r) => r.submits[0].submitted));
const firstValid = sum(withSubmit.map((r) => r.submits[0].valid));
const repaired = withSubmit.filter((r) => r.submits.length > 1);
const repairFixedAll = repaired.filter((r) => r.submits[1].ok).length;
const inTok = sum(rows.map((r) => r.inputTokens));
const outTok = sum(rows.map((r) => r.outputTokens));
const price = PRICES[provider.model];
const cost = price ? (inTok * price[0] + outTok * price[1]) / 1_000_000 : null;
const sortedMs = rows.map((r) => r.ms).sort((a, b) => a - b);
const at = (k: number) => sortedMs[Math.min(sortedMs.length - 1, Math.floor(sortedMs.length * k))] ?? 0;
const failures = new Map<string, number>();
for (const r of rows) if (r.failure) failures.set(r.failure, (failures.get(r.failure) ?? 0) + 1);

const summary = {
  model: provider.model,
  provider: provider.name,
  date: new Date().toISOString().slice(0, 10),
  passages: rows.length,
  finished: finished.length,
  fallbacks: rows.length - finished.length,
  failures: Object.fromEntries(failures),
  firstSubmit: { passages: withSubmit.length, allValid: firstClean, items: firstItems, valid: firstValid },
  repairTurns: repaired.length,
  repairFixedEverything: repairFixedAll,
  itemsDropped: sum(rows.map((r) => r.dropped)),
  itemsBackfilled: sum(rows.map((r) => r.backfilled)),
  itemsFromModel: sum(rows.map((r) => r.modelItems)),
  turns: { mean: Math.round((sum(rows.map((r) => r.turns)) / Math.max(1, rows.length)) * 10) / 10, max: Math.max(0, ...rows.map((r) => r.turns)) },
  usage: { inputTokens: inTok, outputTokens: outTok },
  costUsd: cost === null ? null : Math.round(cost * 10000) / 10000,
  latencyMs: { p50: at(0.5), p95: at(0.95) },
};

const byRegister = [...new Set(rows.map((r) => r.register))].map((register) => {
  const rs = rows.filter((r) => r.register === register);
  const ws = rs.filter((r) => r.submits.length);
  return { register, n: rs.length, finished: rs.filter((r) => r.status === 'submitted').length, firstClean: ws.filter((r) => r.submits[0].ok).length, repaired: ws.filter((r) => r.submits.length > 1).length, meanTurns: Math.round((sum(rs.map((r) => r.turns)) / Math.max(1, rs.length)) * 10) / 10 };
});

if (partial) {
  console.log('\npartial run, nothing written');
  process.exit(0);
}
const outDir = join(process.cwd(), 'evals/results');
mkdirSync(outDir, { recursive: true });
const slug = provider.model.replace(/[^a-z0-9.-]/gi, '_');
writeFileSync(join(outDir, `agent-${slug}.json`), JSON.stringify({ summary, byRegister, rows }, null, 2));

const md = [
  `# Agent: ${provider.model} (${summary.date})`,
  '',
  `All ${rows.length} eval passages through \`coach()\` with \`${provider.model}\` as the agent, the same path the web app uses, with the default limits (8 turns, 60,000 tokens, 45 seconds). The goal is picked by register (fiction: vivid, cover letter: voice, essay: clearer, business: tighter, personal: balanced). Produced by \`npm run eval:agent\`.`,
  '',
  '| | |',
  '| --- | --- |',
  `| Passages | ${rows.length} |`,
  `| Agent finished (submit accepted) | ${finished.length} of ${rows.length} (${pct(finished.length, rows.length)}) |`,
  `| Fell back to the deterministic coach | ${rows.length - finished.length}${failures.size ? `: ${[...failures].map(([k, v]) => `${v} ${k}`).join(', ')}` : ''} |`,
  `| First submit passed validation in full | ${firstClean} of ${withSubmit.length} (${pct(firstClean, withSubmit.length)}) |`,
  `| Items valid on the first submit | ${firstValid} of ${firstItems} (${pct(firstValid, firstItems)}) |`,
  `| Repair turns used | ${repaired.length}, of which the repair fixed everything in ${repairFixedAll} |`,
  `| Items dropped after the repair turn | ${summary.itemsDropped} |`,
  `| Items backfilled by the deterministic coach | ${summary.itemsBackfilled} (of ${summary.itemsFromModel + summary.itemsBackfilled} shown) |`,
  `| Model turns per passage | mean ${summary.turns.mean}, max ${summary.turns.max} |`,
  `| Tokens | ${inTok.toLocaleString()} in, ${outTok.toLocaleString()} out |`,
  `| Cost | ${cost === null ? 'n/a (model not in the price table)' : `$${cost.toFixed(4)}`} |`,
  `| Latency per passage | p50 ${summary.latencyMs.p50} ms, p95 ${summary.latencyMs.p95} ms |`,
  '',
  '## By register',
  '',
  '| Register | n | Finished | First submit clean | Repaired | Mean turns |',
  '| --- | --- | --- | --- | --- | --- |',
  ...byRegister.map((b) => `| ${b.register} | ${b.n} | ${b.finished} | ${b.firstClean} | ${b.repaired} | ${b.meanTurns} |`),
  '',
  'Every item shown passed the validator: its sentence index is real and its quote is in that sentence verbatim. What this measures is how often the model gets there on its own, how often the repair turn is needed, and how often the deterministic coach has to fill in.',
  '',
];
writeFileSync(join(outDir, `agent-${slug}.md`), md.join('\n'));
console.log(`\n${md.slice(4, 19).join('\n')}\n\nwrote evals/results/agent-${slug}.{json,md}`);
