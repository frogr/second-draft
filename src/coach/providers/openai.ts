import { SUBMIT_TOOL } from '../tools.js';
import { postJson, type FetchLike } from './http.js';
import { ProviderError, type CompleteRequest, type Message, type ModelTurn, type Provider } from './types.js';

export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_DEFAULT_MODEL = 'gpt-4.1-mini';

export function toOpenAIMessages(system: string, messages: Message[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.text || null,
        ...(m.toolCalls.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) } : {}),
      });
    } else for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.id, content: r.content });
  }
  return out;
}

/** Strict mode accepts a subset of JSON Schema; drop the keywords it may reject. The validator enforces them anyway. */
export function strictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) if (!['maxItems', 'minItems', 'minimum', 'maximum'].includes(k)) out[k] = strictSchema(v);
  return out;
}

/** OpenAI Chat Completions with function calling. submit_coaching uses strict mode, so arguments match its schema. */
export function openaiProvider(apiKey: string, model = OPENAI_DEFAULT_MODEL, fetchImpl?: FetchLike): Provider {
  return {
    name: 'openai',
    model,
    async complete(req: CompleteRequest): Promise<ModelTurn> {
      const body = {
        model,
        max_completion_tokens: req.maxTokens,
        messages: toOpenAIMessages(req.system, req.messages),
        tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, ...(t.name === SUBMIT_TOOL ? { parameters: strictSchema(t.input_schema), strict: true } : { parameters: t.input_schema }) } })),
        tool_choice: 'auto',
        parallel_tool_calls: false,
      };
      const data = (await postJson(OPENAI_URL, { authorization: `Bearer ${apiKey}` }, body, req.signal, fetchImpl)) as {
        choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = data.choices?.[0];
      if (!choice?.message) throw new ProviderError('bad_response', 'no message in response');
      return {
        text: choice.message.content ?? '',
        toolCalls: (choice.message.tool_calls ?? []).map((c) => {
          let args: unknown;
          try {
            args = JSON.parse(c.function.arguments || '{}');
          } catch {
            args = { __unparsed: c.function.arguments };
          }
          return { id: c.id, name: c.function.name, args };
        }),
        usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
        stopReason: choice.finish_reason ?? 'unknown',
      };
    },
  };
}
