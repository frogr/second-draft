# Proof

What was checked, how, and what was not. Every number below comes from a command run on this repo on 2026-10-07, shown next to it. All eval text is synthetic, written for this project.

## Tests

```
$ npm test
 Test Files  8 passed (8)
      Tests  99 passed (99)
```

What they cover:

- **Splitting and offsets** (`test/text.test.ts`): titles, initials, decimals, "e.g.", "p.m.", ellipses, `?!`, dialogue with tags, blank-line and single-line paragraphs. Every sentence and paragraph slices back out of the original text exactly.
- **Each detector** (`test/detectors.test.ts`): positives and the traps they must ignore ("a kind of bird", "just in time", "she was tired", "friendly family", names, dialogue).
- **Rewrites** (`test/rewrite.test.ts`): active voice (agents, pronouns, dummy "it", relative clauses, "had been", modals refused), sentence splits, dialogue beats, comma handling on cuts.
- **Coach and validator** (`test/deterministic.test.ts`, `test/validate.test.ts`): leverage arithmetic, goal changes the order, every item on the three sample drafts is anchored, ten kinds of bad items rejected with a useful hint.
- **Tool-use loop, fully mocked** (`test/agent.test.ts`): a scripted Anthropic conversation (analyze, read sentences, submit with one bad citation, repair) checked turn by turn, including the request shapes (`x-api-key`, `anthropic-version`, `tool_use` / `tool_result` ids) and token accounting. The same loop over OpenAI chat completions (`tool_calls`, `role: tool`, strict schema). Repair failure drops the item. Turn limit, token budget and timeout each stop the loop. 401 is not retried and falls back without leaking the provider message. 429 is retried once using `retry-after`. Repeated 5xx falls back.
- **Server** (`test/server.test.ts`): empty, malformed, oversized and over-3,000-word input; per-IP rate limit; the daily model cap switching to deterministic after one call; unhandled errors return a generic message while the details go to the log.
- **Browser helpers** (`test/web.test.ts`): draft history survives throwing or corrupt `localStorage`; the word diff keeps a bracketed prompt as one piece.

`npm run typecheck` covers source, tests, evals and scripts. `npm audit` reports 0 vulnerabilities.

## Detector eval

```
$ npm run eval
Second Draft eval: 25 synthetic passages, 106 labels
```

| Detector | Labels | Findings | TP | FP | FN | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|
| passive | 12 | 12 | 12 | 0 | 0 | 100% | 100% |
| filler | 30 | 26 | 26 | 0 | 4 | 100% | 87% |
| adverb | 9 | 10 | 8 | 2 | 1 | 80% | 89% |
| cliche | 26 | 21 | 21 | 0 | 5 | 100% | 81% |
| repetition | 7 | 14 | 6 | 8 | 1 | 43% | 86% |
| dialogue_tag | 5 | 4 | 4 | 0 | 1 | 100% | 80% |
| show_tell | 4 | 5 | 4 | 1 | 0 | 80% | 100% |
| sentence_length | 5 | 5 | 4 | 1 | 1 | 80% | 80% |
| paragraph_rhythm | 1 | 1 | 1 | 0 | 0 | 100% | 100% |
| opening | 6 | 4 | 4 | 0 | 2 | 100% | 67% |
| readability | 1 | 1 | 1 | 0 | 0 | 100% | 100% |
| **all** | 106 | 103 | 91 | 12 | 15 | 88% | 86% |

How to read it. The 25 passages in `evals/passages.ts` are fiction, cover letters, essays, business notes and personal essays, 4 of them clean controls. The labels were written from an editor's point of view before the detectors were run, so they include things the detectors were never going to catch ("a shot rang out" is not in the cliche list; "might" is a hedge the filler list does not have). A finding counts as a hit if it overlaps a label for the same detector.

Caveats: the set is small, the passages and the detectors were written in the same project, and four detectors have five labels or fewer, so their percentages say little. Treat this as a regression harness and an honest error list, not a benchmark.

## Validator eval

The same command plants bad citations of the kinds a model plausibly makes, on every sentence of every passage, and also feeds it good citations (whole sentences, fragments, and every deterministic coach item).

| Bad citation type | Planted | Caught |
|---|---:|---:|
| one word changed | 106 | 106 |
| right quote, wrong sentence_index | 113 | 113 |
| sentence_index out of range | 113 | 113 |
| invented sentence | 113 | 113 |
| whitespace changed | 113 | 113 |
| case changed | 113 | 113 |
| rewrite identical to quote | 113 | 113 |
| two sentences merged | 84 | 84 |
| straight quotes curled | 19 | 19 |
| **all** | 887 | 887 (100%) |

```
Good citations wrongly rejected: 0 of 269
Deterministic coach items anchored verbatim (5 goals x 25 passages): 285 of 285
```

The validator catches everything here by construction: it checks the quote character for character against the cited sentence. The useful part of this eval was the other direction. On its first run it rejected **2 of 269 good citations**: `"Fine," he sighed.` rewritten as `"Fine." He sighed.`, and a long sentence split in two. Its "is the rewrite different?" check stripped punctuation, so a punctuation-only rewrite looked unchanged. It now ignores only case and spacing (commit `452f822`, with a test). The first run also showed 13 "case changed" plants as missed; those were a harness bug (the sentence began with a quote mark, so flipping the first character changed nothing), fixed in the same commit.

## Error analysis and the improvement

Before the detector changes, at commit `452f822`:

```
$ git checkout 452f822 && npm run eval
| passive    | 12 | 13 | 12 |  1 | 0 |  92% | 100% |
| repetition |  7 | 18 |  6 | 12 | 1 |  33% |  86% |
| opening    |  6 |  7 |  4 |  3 | 2 |  57% |  67% |
| **all**    | 106 | 111 | 91 | 20 | 15 | 82% | 86% |
```

20 false positives. 12 came from the repetition detector. Reading them (`npm run eval -- --errors`), they fell into three groups:

1. A name at the start of a sentence ("Marcus rang the bell"). The detector skipped capitalized words mid-sentence but not at the start.
2. Deliberate repeated phrases: "we still want to know ... we still want someone", "every summer ... every summer", "gave way to fields and the fields gave way". Writers do this on purpose.
3. Nouns that name the thing being discussed: "the clerk", "stories", "students", "trees".

The fix for the first two (commit `26649b9`): a capitalized word that never appears in lower case is treated as a name; and two occurrences that share a neighbor word are a repeated phrase, as long as that neighbor is not a function word ("the", "of", "my"...). The function-word exception matters: without it, "smelled of ... smelled of" and "my life ... my life", which are real echoes in the labels, would also be skipped.

| | Findings | FP | Precision | Recall |
|---|---:|---:|---:|---:|
| repetition, before | 18 | 12 | 33% | 86% |
| repetition, after | 14 | 8 | 43% | 86% |

The same pass removed the opening detector's "long first sentence" rule. All 3 of its findings were false positives (strong long openings), and long sentences are already the sentence length detector's job: opening went from 57% to 100% precision, recall unchanged. Reading every deterministic rewrite afterwards also turned up "was burned out" being called passive; phrasal "out"/"up" after the participle is now skipped (commit `61f9345`), which took passive to 100% precision. Both changes have tests that fail on the old code.

Overall: 20 false positives to 12, precision 82% to 88%, recall unchanged at 86%.

### What is still wrong

```
$ npm run eval -- --errors
```

- **Repetition (8 FP)** is still the weakest detector. The rest are referent nouns and parallel verbs. Telling a clumsy echo from a necessary noun needs meaning, which is a good job for the model layer. Repetition has the lowest weight in the leverage formula, and its "why" text tells the writer to keep deliberate repetition.
- **Cliche (5 FN):** phrases not in the list ("a shot rang out", "seen it all", "saved my life"); a plural the pattern does not allow ("fast-paced environments"); and a possessive name where the pattern expects a pronoun ("Jack's blood ran cold").
- **Filler (4 FN):** modal hedges "may" and "might" are not in the list (they are too often literal); "am able to" and "were not able to" are missing from the wordy list.
- **Opening (2 FN):** "To whom it may concern," is skipped as a salutation; "I just wanted to quickly check in" is not recognized as throat-clearing.
- **Smaller ones:** "arguably" is counted as both a hedge and an adverb; "Teams adopted it slowly" flags an adverb that carries meaning; "is passionate" in a cover letter is called a named emotion; "explained" as a dialogue tag is not flagged; "smell" and "smelled" are not stemmed together.

## Production build

```
$ npm run build && npm start
Second Draft on http://localhost:3000 (deterministic mode (no API key))

$ curl -s localhost:3000/health
{"ok":true,"model":"none"}

$ curl -s -X POST localhost:3000/api/coach -H 'content-type: application/json' \
    -d '{"draft":"It was decided by the committee that the budget would be reduced. I think we should basically leave in order to win.","goal":"tighter"}'
mode: deterministic
  1 Commit to the claim | We should leave to win.
  2 Let the doer act | The committee decided that the budget would be reduced.
```

(The second output is the JSON reduced to rank, title and "after".) Also checked with curl against the running build: `GET /` returns 200; an empty draft returns 400; bad JSON returns 400; a 3,001-word draft returns 413; the 21st coach request within a minute from one IP returns 429; responses carry a `default-src 'self'` Content Security Policy.

## Screenshots

Taken with Playwright (a browser automation library) against the production build, no API key, with `npm run screenshots`. Desktop at 1280x800, phone at 390x844. Each one was reviewed and what was off was fixed (a diff that split bracketed prompts, "an a busy team", a blank column while scrolling, a wrapped header on the phone).

- `docs/screenshots/01-empty-desk.png`: the empty desk
- `docs/screenshots/02-fiction-draft.png`: the overwritten fiction sample loaded
- `docs/screenshots/03-coached.png`: highlights and the first fix
- `docs/screenshots/04-inspector.png`: clicking a highlight
- `docs/screenshots/05-second-draft.png`: the revised second draft, coached again
- `docs/screenshots/06-progress-metrics.png`: progress across the two drafts and the metric bars
- `docs/screenshots/07-cover-letter.png`: the cover letter sample with the "sounds like me" goal
- `docs/screenshots/08-phone.png`, `docs/screenshots/09-phone-fix.png`: phone width

## Not verified

- **Live model mode is untested.** No API keys were available. The Anthropic and OpenAI request and response shapes follow their documented formats and are exercised only against mocked HTTP in `test/agent.test.ts`. The first real run may surface schema details (for example, which JSON Schema keywords OpenAI strict mode accepts) and prompt quality issues that mocks cannot.
- **No deploy was done.** `render.yaml` follows Render's Blueprint format but has not been applied to a Render account.
- **CI has not run.** `.github/workflows/ci.yml` runs the same commands as above, which pass locally on Node 22.
- **The eval set is small and self-written.** 106 labels across 25 passages, with single-digit counts for several detectors.
- **Readability heuristics** (syllable counting, Flesch-Kincaid) are approximate by design, roughly plus or minus one syllable per word.
- **Browsers:** only Chromium, through Playwright.
