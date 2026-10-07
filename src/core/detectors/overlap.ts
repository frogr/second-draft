import type { Finding } from '../types.js';

/** Drop findings that overlap a longer finding from the same detector. Returns them sorted by start. */
export function keepLongest(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Finding[] = [];
  for (const f of sorted) {
    if (kept.some((k) => f.start < k.end && k.start < f.end)) continue;
    kept.push(f);
  }
  return kept.sort((a, b) => a.start - b.start);
}
