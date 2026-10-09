/**
 * Shim for @forge/llm
 *
 * Provides the chat(), stream(), and list() functions:
 *   import { chat, stream, list } from '@forge/llm';
 *   const response = await chat({ model: 'claude-sonnet-4-5-20250929', messages: [...] });
 */

import { getSimulator } from './globals.js';
import type { LlmPrompt, LlmResponse, LlmStreamResponse, ModelListResponse } from '../llm.js';

async function chat(prompt: LlmPrompt): Promise<LlmResponse> {
  return getSimulator().llm.chat(prompt);
}

async function stream(prompt: LlmPrompt): Promise<LlmStreamResponse> {
  return getSimulator().llm.stream(prompt);
}

async function list(): Promise<ModelListResponse> {
  return getSimulator().llm.list();
}

// Error classes matching real @forge/llm's public exports, implemented
// locally because the real package is only a devDependency of forge-sim
// (shims run inside user projects and can't require it there).
export class ForgeLlmError extends Error {}
export class PromptValidationError extends ForgeLlmError {}

export { chat, stream, list };

export type {
  LlmPrompt,
  LlmResponse,
  LlmStreamResponse,
  ModelListResponse,
};
