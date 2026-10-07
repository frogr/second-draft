import type { CoachingItem, CoachResult } from '../coach/types.js';
import type { DetectorId, Finding } from '../core/types.js';
import { DETECTOR_LABELS } from '../core/types.js';
import { wordDiff } from './diff.js';
import { clearHistory, loadHistory, previousFor, recordDraft, saveHistory, type SavedDraft } from './history.js';
import { SAMPLES, type SampleId } from './samples.js';

type Child = Node | string | null | undefined | false;

/** Tiny DOM builder. Text always goes in as text nodes, never as HTML. */
function h(tag: string, attrs: Record<string, string | boolean | ((e: Event) => void)> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

interface Config {
  llm: { available: boolean; provider?: string; model?: string; remainingToday?: number };
  maxWords: number;
  goals: { id: string; label: string }[];
}

const state = {
  config: null as Config | null,
  goal: 'balanced',
  result: null as CoachResult | null,
  draftText: '',
  history: loadHistory(storage()),
  busy: false,
};

const fmt = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d));
const countWords = (s: string) => (s.match(/[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*|\d+/g) ?? []).length;

/* ---------- editor ---------- */

function renderGoals() {
  const wrap = $('goals');
  wrap.replaceChildren();
  for (const g of state.config?.goals ?? [{ id: 'balanced', label: 'Balanced' }]) {
    const id = `goal-${g.id}`;
    const input = h('input', { type: 'radio', name: 'goal', id, value: g.id, onchange: () => (state.goal = g.id) }) as HTMLInputElement;
    input.checked = state.goal === g.id;
    wrap.append(h('span', { class: 'chip' }, input, h('label', { for: id }, g.label)));
  }
}

function updateCount() {
  const n = countWords(($('draft') as HTMLTextAreaElement).value);
  const max = state.config?.maxWords ?? 3000;
  const el = $('count');
  el.textContent = `${n.toLocaleString('en-US')} / ${max.toLocaleString('en-US')} words`;
  el.classList.toggle('over', n > max);
}

function loadSample(id: SampleId) {
  const s = SAMPLES[id];
  const ta = $('draft') as HTMLTextAreaElement;
  ta.value = s.text;
  state.goal = s.goal;
  renderGoals();
  updateCount();
  showEditor();
  ta.focus();
}

function showEditor() {
  $('editor').hidden = false;
  $('review').hidden = true;
  closeInspector();
}

function showReview() {
  $('editor').hidden = true;
  $('review').hidden = false;
}

/* ---------- running the coach ---------- */

async function run() {
  if (state.busy) return;
  const ta = $('draft') as HTMLTextAreaElement;
  const text = ta.value;
  const err = $('error');
  err.hidden = true;
  if (!text.trim()) {
    err.textContent = 'Paste or write a draft first.';
    err.hidden = false;
    return;
  }
  state.busy = true;
  const btn = $('run') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Reading your draft...';
  try {
    const prev = previousFor(state.history, text);
    const useModel = ($('use-model') as HTMLInputElement | null)?.checked ?? false;
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: text, goal: state.goal, previousDraft: prev?.text, useModel }),
    });
    const data = await res.json().catch(() => ({ error: 'The server sent something unexpected.' }));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
    const result = data as CoachResult;
    state.result = result;
    state.draftText = text;
    const m = result.analysis.metrics;
    state.history = recordDraft(state.history, {
      id: Math.random().toString(36).slice(2, 10),
      at: new Date().toISOString(),
      goal: state.goal,
      text,
      metrics: { words: m.words, gradeLevel: m.gradeLevel, avgSentenceLength: m.avgSentenceLength, sentenceLengthSpread: m.sentenceLengthSpread, passiveRate: m.passiveRate, readingEase: m.readingEase, per100: m.per100, counts: m.counts },
      findings: result.analysis.findings.length,
    });
    const saved = saveHistory(storage(), state.history);
    renderResult(result, saved);
    showReview();
    window.scrollTo({ top: 0 });
  } catch (e) {
    err.textContent = (e as Error).message || 'Something went wrong.';
    err.hidden = false;
  } finally {
    state.busy = false;
    btn.disabled = false;
    btn.textContent = 'Coach this draft';
  }
}

/* ---------- rendered draft with highlights ---------- */

function renderDraft(text: string, findings: Finding[], items: CoachingItem[]) {
  const root = $('rendered');
  root.replaceChildren();
  const cuts = new Set<number>([0, text.length]);
  for (const f of findings) cuts.add(f.start).add(f.end);
  for (const it of items) cuts.add(it.start).add(it.end);
  const points = [...cuts].sort((a, b) => a - b);
  const badgeAt = new Map(items.map((i) => [i.start, i.rank]));
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i]!;
    const e = points[i + 1]!;
    if (badgeAt.has(s)) root.append(h('sup', { class: 'badge', 'aria-hidden': 'true' }, String(badgeAt.get(s))));
    const covering = findings.filter((f) => f.start <= s && f.end >= e && f.end > f.start);
    const fix = items.find((it) => it.start <= s && it.end >= e);
    const piece = text.slice(s, e);
    if (!covering.length && !fix) {
      root.append(piece);
      continue;
    }
    const cls = ['seg'];
    if (fix) cls.push('fix', `fix-${fix.rank}`);
    // only short findings get an underline; sentence- and paragraph-wide findings show in the inspector
    if (covering.some((f) => f.end - f.start < 80)) cls.push('hl');
    const span = h('span', { class: cls.join(' '), 'data-start': String(s), tabindex: '0', role: 'button', 'aria-label': `Findings at "${piece.slice(0, 40)}"` }, piece);
    root.append(span);
  }
}

function onDraftClick(ev: Event) {
  const target = (ev.target as HTMLElement).closest('.seg') as HTMLElement | null;
  if (!target || !state.result) return;
  const at = Number(target.dataset.start);
  const findings = state.result.analysis.findings.filter((f) => f.start <= at && f.end > at);
  const item = state.result.items.find((it) => it.start <= at && it.end > at);
  openInspector(findings, item);
}

function openInspector(findings: Finding[], item?: CoachingItem) {
  const sheet = $('inspector');
  const list = h('ul', { class: 'finding-list' });
  for (const f of findings) list.append(h('li', {}, h('span', { class: `tag d-${f.detector}` }, DETECTOR_LABELS[f.detector]), ' ', f.message));
  sheet.replaceChildren(
    h('div', { class: 'sheet-head' }, h('strong', {}, findings.length ? `${findings.length} finding${findings.length > 1 ? 's' : ''} here` : 'Coached sentence'), h('button', { class: 'ghost', onclick: closeInspector, 'aria-label': 'Close' }, 'Close')),
    findings.length ? list : null,
    item ? h('button', { class: 'link', onclick: () => focusCard(item.rank) }, `Go to fix ${item.rank}: ${item.title}`) : null,
  );
  sheet.hidden = false;
}

function closeInspector() {
  $('inspector').hidden = true;
}

function focusCard(rank: number) {
  closeInspector();
  const card = document.getElementById(`fix-${rank}`);
  card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  card?.focus({ preventScroll: true });
}

function focusSentence(rank: number) {
  const el = document.querySelector(`#rendered .fix-${rank}`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  document.querySelectorAll('#rendered .flash').forEach((x) => x.classList.remove('flash'));
  document.querySelectorAll(`#rendered .fix-${rank}`).forEach((x) => x.classList.add('flash'));
}

/* ---------- coaching cards ---------- */

function diffBlock(label: string, parts: ReturnType<typeof wordDiff>, keep: 'del' | 'ins') {
  const p = h('p', { class: `diff ${keep === 'del' ? 'before' : 'after'}` });
  for (const part of parts) {
    if (part.type === 'same') p.append(part.text);
    else if (part.type === keep) {
      // brackets in a scaffold are prompts for the writer
      const segs = part.text.split(/(\[[^\]]*\])/);
      const mark = h(keep === 'del' ? 'del' : 'ins', {});
      for (const s of segs) mark.append(/^\[.*\]$/.test(s) ? h('span', { class: 'prompt' }, s) : s);
      p.append(mark);
    }
  }
  return h('div', { class: 'diff-wrap' }, h('div', { class: 'diff-label' }, label), p);
}

function card(item: CoachingItem) {
  const parts = wordDiff(item.before, item.after);
  return h(
    'article',
    { class: 'fix-card', id: `fix-${item.rank}`, tabindex: '-1' },
    h(
      'header',
      {},
      h('span', { class: 'rank' }, String(item.rank)),
      h('div', {}, h('h3', {}, item.title), h('div', { class: 'meta' }, item.detector === 'other' ? 'General' : DETECTOR_LABELS[item.detector as DetectorId], ` · sentence ${item.sentenceIndex + 1}`, item.source === 'deterministic' && state.result?.mode !== 'deterministic' ? ' · from the deterministic coach' : '')),
      h('button', { class: 'ghost small', onclick: () => focusSentence(item.rank) }, 'Show in draft'),
    ),
    diffBlock('Before', parts, 'del'),
    diffBlock(item.afterKind === 'scaffold' ? 'After (fill in the brackets)' : 'After', parts, 'ins'),
    h('p', { class: 'why' }, item.why),
    h('div', { class: 'exercise' }, h('div', { class: 'diff-label' }, 'Exercise'), h('p', {}, item.exercise)),
    item.leverage ? h('details', { class: 'leverage' }, h('summary', {}, `Leverage ${fmt(item.leverage.score)}`), h('p', {}, item.leverage.explanation)) : null,
  );
}

/* ---------- metrics and progress ---------- */

const METRICS: Array<{ label: string; get: (d: SavedDraft) => number; unit?: string; hint: string }> = [
  { label: 'Grade level', get: (d) => d.metrics.gradeLevel, hint: 'Flesch-Kincaid; lower reads easier' },
  { label: 'Avg sentence', get: (d) => d.metrics.avgSentenceLength, hint: 'words per sentence' },
  { label: 'Rhythm variety', get: (d) => d.metrics.sentenceLengthSpread, hint: 'spread of sentence lengths; higher is less flat' },
  { label: 'Passive', get: (d) => Math.round(d.metrics.passiveRate * 100), unit: '%', hint: 'share of sentences' },
  { label: 'Filler', get: (d) => d.metrics.per100.filler, hint: 'per 100 words' },
  { label: 'Adverbs', get: (d) => d.metrics.per100.adverb, hint: 'per 100 words' },
  { label: 'Cliches', get: (d) => d.metrics.counts.cliche, hint: 'count' },
  { label: 'Telling', get: (d) => d.metrics.counts.show_tell, hint: 'emotions named, count' },
];

function renderMetrics() {
  const wrap = $('metrics');
  wrap.replaceChildren();
  const drafts = state.history.slice(-4);
  if (!drafts.length) return;
  const names = drafts.map((_, i) => (i === drafts.length - 1 ? 'Now' : `D${state.history.length - drafts.length + i + 1}`));
  for (const m of METRICS) {
    const values = drafts.map(m.get);
    const max = Math.max(...values, 0.0001);
    const rows = h('div', { class: 'bars' });
    values.forEach((v, i) => {
      const bar = h('span', { class: 'bar' });
      bar.style.setProperty('--w', `${Math.max(2, (v / max) * 100)}%`);
      rows.append(h('div', { class: `bar-row${i === values.length - 1 ? ' now' : ''}` }, h('span', { class: 'bar-name' }, names[i]!), h('span', { class: 'track' }, bar), h('span', { class: 'bar-val' }, `${fmt(v)}${m.unit ?? ''}`)));
    });
    wrap.append(h('div', { class: 'metric' }, h('div', { class: 'metric-head' }, h('span', {}, m.label), h('span', { class: 'hint' }, m.hint)), rows));
  }
  const r = state.result;
  if (r) {
    const buckets = r.analysis.metrics.lengthBuckets;
    const max = Math.max(...buckets.map((b) => b.count), 1);
    const hist = h('div', { class: 'hist', role: 'img', 'aria-label': `Sentence lengths: ${buckets.map((b) => `${b.count} of ${b.label} words`).join(', ')}` });
    for (const b of buckets) {
      const col = h('span', { class: 'col' });
      col.style.setProperty('--h', `${(b.count / max) * 100}%`);
      hist.append(h('div', { class: 'hist-col' }, h('span', { class: 'hist-n' }, String(b.count)), h('span', { class: 'hist-track' }, col), h('span', { class: 'hist-label' }, b.label)));
    }
    wrap.append(h('div', { class: 'metric' }, h('div', { class: 'metric-head' }, h('span', {}, 'Sentence lengths'), h('span', { class: 'hint' }, 'words per sentence, this draft')), hist));
  }
}

function renderProgress() {
  const wrap = $('progress-list');
  wrap.replaceChildren();
  const box = $('progress');
  box.hidden = state.history.length === 0;
  const list = h('ol', { class: 'drafts' });
  state.history.forEach((d, i) => {
    const prev = state.history[i - 1];
    const delta = prev ? d.findings - prev.findings : 0;
    const when = new Date(d.at);
    list.append(
      h(
        'li',
        {},
        h('span', { class: 'd-name' }, `Draft ${i + 1}`),
        h('span', { class: 'd-meta' }, `${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.metrics.words} words · ${d.findings} findings`),
        prev ? h('span', { class: `delta ${delta < 0 ? 'good' : delta > 0 ? 'bad' : ''}` }, delta === 0 ? 'same' : `${delta > 0 ? '+' : ''}${delta}`) : h('span', { class: 'delta' }, 'first'),
        h('button', { class: 'link small', onclick: () => reopen(d) }, 'Open'),
      ),
    );
  });
  wrap.append(list);
  const cmp = state.result?.comparison?.filter((c) => c.verdict !== 'same' && !c.key.startsWith('per100.')).slice(0, 5);
  if (cmp?.length) {
    wrap.append(
      h('p', { class: 'hint' }, 'Since your previous draft:'),
      h('ul', { class: 'changes' }, ...cmp.map((c) => h('li', { class: c.verdict }, `${c.label}: ${fmt(c.before)} → ${fmt(c.after)}`))),
    );
  }
}

function reopen(d: SavedDraft) {
  ($('draft') as HTMLTextAreaElement).value = d.text;
  updateCount();
  showEditor();
}

function renderTrace(r: CoachResult) {
  const list = h('ol', { class: 'trace' });
  for (const s of r.trace) {
    list.append(h('li', { class: s.ok ? '' : 'fail' }, h('span', { class: `kind k-${s.kind}` }, s.kind), h('code', {}, s.name), s.input && Object.keys(s.input as object).length ? h('code', { class: 'args' }, JSON.stringify(s.input)) : null, h('span', { class: 'out' }, s.output), s.ms ? h('span', { class: 'ms' }, `${s.ms} ms`) : null));
  }
  const label = r.mode === 'deterministic' ? 'Pipeline trace (deterministic, no model)' : `Agent trace (${r.model})`;
  $('trace').replaceChildren(h('summary', {}, `${label} · ${r.trace.length} steps${r.usage ? ` · ${r.usage.inputTokens + r.usage.outputTokens} tokens` : ''}`), list);
}

function renderResult(r: CoachResult, saved: boolean) {
  renderDraft(state.draftText, r.analysis.findings, r.items);
  $('intro').hidden = true;
  $('result').hidden = false;
  $('coached-by').textContent = r.mode === 'deterministic' ? 'Deterministic coach' : `${r.model} with tool use`;
  $('summary').textContent = r.summary;
  const notes = [...r.notes];
  if (!saved) notes.push('This browser blocked local storage, so drafts will not be kept after you leave.');
  $('notes').replaceChildren(...notes.map((n) => h('p', { class: 'note' }, n)));
  $('fixes').replaceChildren(...(r.items.length ? r.items.map(card) : [h('p', { class: 'hint' }, 'Nothing stood out. Read it aloud once more and trust your ear.')]));
  renderMetrics();
  renderProgress();
  renderTrace(r);
}

/* ---------- boot ---------- */

async function boot() {
  try {
    const res = await fetch('/api/config');
    state.config = (await res.json()) as Config;
  } catch {
    state.config = null;
  }
  const llm = state.config?.llm;
  const mode = $('mode');
  const modelToggle = $('model-toggle');
  if (llm?.available) {
    mode.textContent = `Model available: ${llm.model}`;
    modelToggle.hidden = false;
  } else {
    mode.textContent = 'Deterministic coach · no API key on this server';
    modelToggle.hidden = true;
  }
  renderGoals();
  updateCount();
  renderProgress();
  ($('draft') as HTMLTextAreaElement).addEventListener('input', updateCount);
  $('run').addEventListener('click', run);
  $('revise').addEventListener('click', () => {
    showEditor();
    ($('draft') as HTMLTextAreaElement).focus();
  });
  $('sample-fiction').addEventListener('click', () => loadSample('fiction'));
  $('sample-cover').addEventListener('click', () => loadSample('cover'));
  $('clear-history').addEventListener('click', () => {
    clearHistory(storage());
    state.history = [];
    renderProgress();
    renderMetrics();
  });
  $('rendered').addEventListener('click', onDraftClick);
  $('rendered').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') onDraftClick(e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInspector();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !$('editor').hidden) run();
  });
}

boot();
