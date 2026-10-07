export type DiffPart = { type: 'same' | 'del' | 'ins'; text: string };

/** Word-level diff (LCS) between two short strings. Whitespace stays attached to the token before it. */
export function wordDiff(a: string, b: string): DiffPart[] {
  // a bracketed scaffold prompt is one token, so the diff never splits it
  const tok = (s: string) => s.match(/\[[^\]]*\]\S*\s*|\S+\s*/g) ?? [];
  const x = tok(a);
  const y = tok(b);
  if (x.length * y.length > 40_000) return [{ type: 'del', text: a }, { type: 'ins', text: b }];
  const key = (t: string) => t.trim().toLowerCase().replace(/[^\p{L}\p{N}'’]+/gu, '');
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i]![j] = key(x[i]!) === key(y[j]!) && x[i]!.trim() === y[j]!.trim() ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i]!.trim() === y[j]!.trim()) {
      push('same', y[j]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push('del', x[i++]!);
    else push('ins', y[j++]!);
  }
  while (i < x.length) push('del', x[i++]!);
  while (j < y.length) push('ins', y[j++]!);
  return out;
}
