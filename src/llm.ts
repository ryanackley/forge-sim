/**
 * SimulatedLLM — backend for the @forge/llm shim.
 *
 * Two modes:
 *   1. Real proxy  — if ANTHROPIC_API_KEY is set, forwards to the Anthropic Messages API
 *                    and translates between @forge/llm's OpenAI-shaped format and Anthropic's
 *                    native format.
 *   2. Mock        — pre-registered responses returned in order.  Good for tests.
 *
 * The @forge/llm API speaks an OpenAI-compatible dialect:
 *   - Request:  { model, messages[], tools[], tool_choice, temperature, ... }
 *   - Response: { choices[{ finish_reason, message: { role, content, tool_calls[] } }], usage }
 *
 * Under the hood Atlassian hosts Claude, so our proxy talks native Anthropic.
 */

// ── @forge/llm public types (OpenAI-shaped) ─────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;      // present when role === 'tool'
  tool_calls?: LlmToolCall[]; // present when role === 'assistant' with tool use
}

export interface ContentPart {
  type: 'text';
  text: string;
}

export interface LlmToolCall {
  id: string;
  type: 'function';
  index: number;
  function: { name: string; arguments: Record<string, unknown> | string };
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmPrompt {
  model: string;
  messages: LlmMessage[];
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: LlmTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

export interface LlmChoice {
  finish_reason: string;
  index: number;
  message: {
    role: 'assistant';
    content: string | ContentPart[];
    tool_calls?: LlmToolCall[];
  };
}

export interface LlmResponse {
  choices: LlmChoice[];
  usage?: { input_token?: number; output_token?: number; total_token?: number };
}

export interface LlmStreamResponse extends AsyncIterable<LlmResponse> {
  close(): Promise<void> | undefined;
}

export interface ModelInfo {
  model: string;
  status: 'active' | 'deprecated';
}

export interface ModelListResponse {
  models: ModelInfo[];
}

// ── Anthropic native types (internal) ───────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

interface AnthropicContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | AnthropicContent[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: string | null; // 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  usage: { input_tokens: number; output_tokens: number };
}

// ── Model mapping ───────────────────────────────────────────────────────

/** Map @forge/llm model strings to Anthropic model IDs */
const MODEL_MAP: Record<string, string> = {
  // Exact Forge model IDs → Anthropic
  'claude-3-7-sonnet-20250219': 'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5-20251001',
};

const AVAILABLE_MODELS: ModelInfo[] = [
  { model: 'claude-sonnet-4-5-20250929', status: 'active' },
  { model: 'claude-haiku-4-5-20251001', status: 'active' },
  { model: 'claude-3-7-sonnet-20250219', status: 'active' },
  { model: 'claude-3-5-haiku-20241022', status: 'active' },
];

// ── Mock support ────────────────────────────────────────────────────────

export interface MockLlmResponse {
  content: string | ContentPart[];
  tool_calls?: LlmToolCall[];
  finish_reason?: string;
}

// ── SimulatedLLM ────────────────────────────────────────────────────────

export class SimulatedLLM {
  private mockResponses: MockLlmResponse[] = [];
  private callHistory: Array<{ prompt: LlmPrompt; response: LlmResponse }> = [];
  private logFn: (level: string, message: string, detail?: unknown) => void;

  constructor(logFn?: (level: string, message: string, detail?: unknown) => void) {
    this.logFn = logFn ?? (() => {});
  }

  // ── Public API ──────────────────────────────────────────────────────

  async chat(prompt: LlmPrompt): Promise<LlmResponse> {
    this.logFn('invoke', `llm.chat → ${prompt.model}`, {
      messageCount: prompt.messages.length,
      hasTools: !!prompt.tools?.length,
    });

    // 1. Try mock responses first
    if (this.mockResponses.length > 0) {
      const mock = this.mockResponses.shift()!;
      const response = this.buildMockResponse(mock);
      this.callHistory.push({ prompt, response });
      this.logFn('info', 'llm.chat → mock response');
      return response;
    }

    // 2. Try real Anthropic API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new LlmApiError(
        'No ANTHROPIC_API_KEY set and no mock responses registered. ' +
        'Set the env var for real API calls, or use sim.llm.mockResponse() for testing.',
        'NO_API_KEY'
      );
    }

    const response = await this.callAnthropic(prompt, apiKey);
    this.callHistory.push({ prompt, response });
    return response;
  }

  async stream(prompt: LlmPrompt): Promise<LlmStreamResponse> {
    // For simulation, we just call chat() and yield the full response as one chunk.
    // Real streaming would need SSE parsing — overkill for local dev.
    const response = await this.chat(prompt);

    const iterable: LlmStreamResponse = {
      [Symbol.asyncIterator]() {
        let done = false;
        return {
          async next() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: response };
          },
        };
      },
      close: async () => {},
    };

    return iterable;
  }

  async list(): Promise<ModelListResponse> {
    return { models: [...AVAILABLE_MODELS] };
  }

  // ── Mock management ─────────────────────────────────────────────────

  /** Queue a mock response for the next chat() call. FIFO order. */
  mockResponse(mock: MockLlmResponse): void {
    this.mockResponses.push(mock);
  }

  /** Queue multiple mock responses. */
  mockResponses_(...mocks: MockLlmResponse[]): void {
    this.mockResponses.push(...mocks);
  }

  /** Get call history for assertions. */
  getHistory(): Array<{ prompt: LlmPrompt; response: LlmResponse }> {
    return [...this.callHistory];
  }

  /** Clear all state. */
  reset(): void {
    this.mockResponses = [];
    this.callHistory = [];
  }

  // ── Anthropic API proxy ─────────────────────────────────────────────

  private async callAnthropic(prompt: LlmPrompt, apiKey: string): Promise<LlmResponse> {
    const anthropicModel = MODEL_MAP[prompt.model] ?? prompt.model;

    // Translate request
    const { system, messages } = this.toAnthropicMessages(prompt.messages);
    const tools = prompt.tools ? this.toAnthropicTools(prompt.tools) : undefined;
    const toolChoice = prompt.tool_choice ? this.toAnthropicToolChoice(prompt.tool_choice) : undefined;

    const body: Record<string, unknown> = {
      model: anthropicModel,
      messages,
      max_tokens: prompt.max_completion_tokens ?? 4096,
    };

    if (system) body.system = system;
    if (tools?.length) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
    if (prompt.temperature !== undefined) body.temperature = prompt.temperature;
    if (prompt.top_p !== undefined) body.top_p = prompt.top_p;

    this.logFn('info', `llm → Anthropic API (${anthropicModel})`, {
      messageCount: messages.length,
      toolCount: tools?.length ?? 0,
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new LlmApiError(
        `Anthropic API error ${res.status}: ${errorText}`,
        'API_ERROR'
      );
    }

    const anthropicResponse = (await res.json()) as AnthropicResponse;
    return this.fromAnthropicResponse(anthropicResponse);
  }

  // ── Request translation (OpenAI → Anthropic) ─────────────────────────

  private toAnthropicMessages(messages: LlmMessage[]): {
    system: string | undefined;
    messages: AnthropicMessage[];
  } {
    let system: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic uses a top-level system param, not a message role
        system = typeof msg.content === 'string'
          ? msg.content
          : msg.content.map(p => p.text).join('\n');
        continue;
      }

      if (msg.role === 'user') {
        anthropicMessages.push({
          role: 'user',
          content: typeof msg.content === 'string' ? msg.content : msg.content.map(p => ({ type: 'text' as const, text: p.text })),
        });
        continue;
      }

      if (msg.role === 'assistant') {
        const content: AnthropicContent[] = [];

        // Text content
        if (msg.content) {
          const text = typeof msg.content === 'string'
            ? msg.content
            : msg.content.map(p => p.text).join('');
          if (text) {
            content.push({ type: 'text', text });
          }
        }

        // Tool calls → tool_use blocks
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            const args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: args,
            });
          }
        }

        if (content.length > 0) {
          anthropicMessages.push({ role: 'assistant', content });
        }
        continue;
      }

      if (msg.role === 'tool') {
        // Tool results → user message with tool_result content block
        const toolContent: AnthropicContent = {
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };

        // Anthropic expects tool_result blocks in a user message.
        // If the previous message is a user message, append to it.
        // Otherwise create a new user message.
        const prev = anthropicMessages[anthropicMessages.length - 1];
        if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
          (prev.content as AnthropicContent[]).push(toolContent);
        } else {
          anthropicMessages.push({ role: 'user', content: [toolContent] });
        }
        continue;
      }
    }

    return { system, messages: anthropicMessages };
  }

  private toAnthropicTools(tools: LlmTool[]): AnthropicTool[] {
    return tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  private toAnthropicToolChoice(
    choice: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } },
  ): Record<string, unknown> {
    if (choice === 'auto') return { type: 'auto' };
    if (choice === 'none') return { type: 'none' }; // Note: Anthropic doesn't have 'none' but we pass it
    if (choice === 'required') return { type: 'any' };
    if (typeof choice === 'object' && choice.function) {
      return { type: 'tool', name: choice.function.name };
    }
    return { type: 'auto' };
  }

  // ── Response translation (Anthropic → OpenAI) ─────────────────────────

  private fromAnthropicResponse(res: AnthropicResponse): LlmResponse {
    const textParts: string[] = [];
    const toolCalls: LlmToolCall[] = [];
    let toolIndex = 0;

    for (const block of res.content) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text);
      }
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id!,
          type: 'function',
          index: toolIndex++,
          function: {
            name: block.name!,
            arguments: block.input as Record<string, unknown>,
          },
        });
      }
    }

    // Map Anthropic stop_reason → OpenAI finish_reason
    let finishReason = 'stop';
    if (res.stop_reason === 'tool_use') finishReason = 'tool_use';
    else if (res.stop_reason === 'max_tokens') finishReason = 'max_tokens';
    else if (res.stop_reason === 'end_turn') finishReason = 'end_turn';
    else if (res.stop_reason === 'stop_sequence') finishReason = 'stop';

    const content: ContentPart[] = textParts.map(t => ({ type: 'text', text: t }));

    const choice: LlmChoice = {
      finish_reason: finishReason,
      index: 0,
      message: {
        role: 'assistant',
        content: content.length === 1 ? content : content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
    };

    return {
      choices: [choice],
      usage: {
        input_token: res.usage.input_tokens,
        output_token: res.usage.output_tokens,
        total_token: res.usage.input_tokens + res.usage.output_tokens,
      },
    };
  }

  // ── Mock response builder ───────────────────────────────────────────

  private buildMockResponse(mock: MockLlmResponse): LlmResponse {
    const content = typeof mock.content === 'string'
      ? [{ type: 'text' as const, text: mock.content }]
      : mock.content;

    return {
      choices: [{
        finish_reason: mock.finish_reason ?? (mock.tool_calls?.length ? 'tool_use' : 'end_turn'),
        index: 0,
        message: {
          role: 'assistant',
          content,
          ...(mock.tool_calls ? { tool_calls: mock.tool_calls } : {}),
        },
      }],
      usage: { input_token: 0, output_token: 0, total_token: 0 },
    };
  }
}

// ── Error class ─────────────────────────────────────────────────────────

export class LlmApiError extends Error {
  code: string;
  context?: { responseText?: string };

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LlmApiError';
    this.code = code;
    this.context = { responseText: message };
  }
}
