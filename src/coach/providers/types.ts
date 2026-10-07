import type { ToolDef } from '../tools.js';

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export type Message =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: ToolCall[] }
  | { role: 'tool_results'; results: Array<{ id: string; name: string; content: string; isError: boolean }> };

export interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
  usage: { input: number; output: number };
  stopReason: string;
}

export interface CompleteRequest {
  system: string;
  messages: Message[];
  tools: ToolDef[];
  maxTokens: number;
  signal: AbortSignal;
}

export interface Provider {
  name: 'anthropic' | 'openai';
  model: string;
  complete(req: CompleteRequest): Promise<ModelTurn>;
}

export type ProviderErrorKind = 'auth' | 'rate_limit' | 'server' | 'bad_request' | 'timeout' | 'network' | 'bad_response';

/** A provider failure. `message` is for logs only; visitors see a generic note. */
export class ProviderError extends Error {
  constructor(
    public kind: ProviderErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
