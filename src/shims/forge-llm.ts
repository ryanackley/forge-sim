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

export { chat, stream, list };

export type {
  LlmPrompt,
  LlmResponse,
  LlmStreamResponse,
  ModelListResponse,
};
