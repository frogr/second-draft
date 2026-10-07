# Agent: claude-haiku-5-5 (2026-10-07)

All 25 eval passages through `coach()` with `claude-haiku-5-5` as the agent, the same path the web app uses, with the default limits (8 turns, 60,000 tokens, 45 seconds). The goal is picked by register (fiction: vivid, cover letter: voice, essay: clearer, business: tighter, personal: balanced). Produced by `npm run eval:agent`.

| | |
| --- | --- |
| Passages | 25 |
| Agent finished (submit accepted) | 25 of 25 (100%) |
| Fell back to the deterministic coach | 0 |
| First submit passed validation in full | 23 of 25 (92%) |
| Items valid on the first submit | 65 of 65 (100%) |
| Repair turns used | 2, of which the repair fixed everything in 2 |
| Items dropped after the repair turn | 0 |
| Items backfilled by the deterministic coach | 1 (of 71 shown) |
| Model turns per passage | mean 2.2, max 4 |
| Tokens | 141,922 in, 34,416 out |
| Cost | $0.0314 |
| Latency per passage | p50 7117 ms, p95 13283 ms |

## By register

| Register | n | Finished | First submit clean | Repaired | Mean turns |
| --- | --- | --- | --- | --- | --- |
| fiction | 11 | 11 | 11 | 0 | 2.1 |
| cover_letter | 4 | 4 | 3 | 1 | 2.3 |
| essay | 4 | 4 | 4 | 0 | 2 |
| business | 3 | 3 | 3 | 0 | 2 |
| personal | 3 | 3 | 2 | 1 | 3 |

Every item shown passed the validator: its sentence index is real and its quote is in that sentence verbatim. What this measures is how often the model gets there on its own, how often the repair turn is needed, and how often the deterministic coach has to fill in.
