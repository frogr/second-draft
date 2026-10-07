import { postJson, type FetchLike } from './http.js';
import { ProviderError, type CompleteRequest, type Message, type ModelTurn, type Provider } from './types.js';

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5';

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export function toAnthropicMessages(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: string | Block[] }> {
  return messages.map((m) => {
    if (m.role === 'user') return { role: 'user', content: m.text };
    if (m.role === 'assistant') {
      const content: Block[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} });
      return { role: 'assistant', content };
    }
    return { role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })) };
  });
}

/** Claude Messages API with tool use, over plain fetch. */
export function anthropicProvider(apiKey: string, model = ANTHROPIC_DEFAULT_MODEL, fetchImpl?: FetchLike): Provider {
  return {
    name: 'anthropic',
    model,
    async complete(req: CompleteRequest): Promise<ModelTurn> {
      const body = {
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
        tool_choice: { type: 'auto' },
        messages: toAnthropicMessages(req.messages),
      };
      const data = (await postJson(ANTHROPIC_URL, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body, req.signal, fetchImpl)) as {
        content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };
      if (!Array.isArray(data.content)) throw new ProviderError('bad_response', 'no content array in response');
      return {
        text: data.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n'),
        toolCalls: data.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id ?? '', name: b.name ?? '', args: b.input ?? {} })),
        usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
        stopReason: data.stop_reason ?? 'unknown',
      };
    },
  };
}
