// Shared entry backing THREE manifest function entries (okr-tracker pattern).
// Top-level code must evaluate exactly ONCE per dev deploy pass — the F8
// dev-path regression imported this file once per function entry, re-running
// the resolver.define() calls and spamming overwrite warnings.
import Resolver from '@forge/resolver';
import { greet } from './helper.js';

globalThis.__devSharedEntryEvals = (globalThis.__devSharedEntryEvals ?? 0) + 1;

const resolver = new Resolver();
resolver.define('greet', () => greet());
resolver.define('stats', () => ({ ok: true }));

export const handler = resolver.getDefinitions();
export const run = async () => {
  // Counts scheduled-trigger firings — initial deploy fires once, hot
  // redeploys must not re-fire.
  globalThis.__devSharedEntryTicks = (globalThis.__devSharedEntryTicks ?? 0) + 1;
  return { ran: true };
};
export const cleanup = async () => ({ cleaned: true });
