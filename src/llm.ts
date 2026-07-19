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
  // Real @forge/llm Usage keys are plural (out/interfaces/internal.d.ts) —
  // we shipped singular keys until eval-10 F9 caught the mismatch, so any
  // prod code reading response.usage.input_tokens got undefined in the sim.
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
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
  'claude-opus-4-6': 'claude-opus-4-6',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929': 'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5-20251001',
  'claude-3-7-sonnet-20250219': 'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
};

const AVAILABLE_MODELS: ModelInfo[] = [
  { model: 'claude-opus-4-6', status: 'active' },
  { model: 'claude-sonnet-4-6', status: 'active' },
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
  // FIFO queue of mock responses, consumed by chat(). Named `responseQueue`
  // (not `mockResponses`) so the public `mockResponses(...)` setter method
  // doesn't collide with the field.
  private responseQueue: MockLlmResponse[] = [];
  private callHistory: Array<{ prompt: LlmPrompt; response: LlmResponse }> = [];
  private logFn: (level: string, message: string, detail?: unknown) => void;
  private configApiKey: string | null = null;

  constructor(logFn?: (level: string, message: string, detail?: unknown) => void) {
    this.logFn = logFn ?? (() => {});
  }

  /**
   * Set the API key from config (loaded at deploy time).
   * A non-blank process.env.ANTHROPIC_API_KEY still takes precedence at call time.
   */
  setApiKey(key: string): void {
    this.configApiKey = key;
  }

  /**
   * Get the active API key (env wins over config).
   *
   * Eval-10 F3: a set-but-empty ANTHROPIC_API_KEY (common in CI and leftover
   * shell exports) must NOT mask a configured key — `??` treated '' as
   * present, so chat() threw NO_API_KEY while the startup banner claimed the
   * config key was loaded. Blank/whitespace env falls through to config.
   */
  getApiKey(): string | null {
    const envKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (envKey) return envKey;
    return this.configApiKey;
  }

  // ── Public API ──────────────────────────────────────────────────────

  async chat(prompt: LlmPrompt): Promise<LlmResponse> {
    this.logFn('invoke', `llm.chat → ${prompt.model}`, {
      messageCount: prompt.messages.length,
      hasTools: !!prompt.tools?.length,
    });

    // 1. Try mock responses first
    if (this.responseQueue.length > 0) {
      const mock = this.responseQueue.shift()!;
      const response = this.buildMockResponse(mock);
      this.callHistory.push({ prompt, response });
      this.logFn('info', 'llm.chat → mock response');
      return response;
    }

    // 2. Try real Anthropic API
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new LlmApiError(
        'No Anthropic API key configured and no mock responses registered. ' +
        'Run `forge-sim auth --llm` or set ANTHROPIC_API_KEY env var.',
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
    this.responseQueue.push(mock);
  }

  /**
   * Queue multiple mock responses at once. FIFO order — equivalent to
   * calling `mockResponse()` once per argument.
   */
  mockResponses(...mocks: MockLlmResponse[]): void {
    this.responseQueue.push(...mocks);
  }

  /** Get call history for assertions. */
  getHistory(): Array<{ prompt: LlmPrompt; response: LlmResponse }> {
    return [...this.callHistory];
  }

  /**
   * Number of queued mock responses not yet consumed by chat().
   * This is the real "queue depth" — history length is total calls ever,
   * which is a different (and ever-growing) number (eval-4 F9).
   */
  getPendingMockCount(): number {
    return this.responseQueue.length;
  }

  /** Clear all state. */
  reset(): void {
    this.responseQueue = [];
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
        input_tokens: res.usage.input_tokens,
        output_tokens: res.usage.output_tokens,
        total_tokens: res.usage.input_tokens + res.usage.output_tokens,
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
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
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
