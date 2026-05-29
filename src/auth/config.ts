/**
 * forge-sim configuration — service-level settings.
 *
 * Stored in ~/.forge-sim/config.json (separate from credentials).
 * Contains API keys for non-Atlassian services (e.g. Anthropic for @forge/llm).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.forge-sim');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface ForgeSimConfig {
  anthropicApiKey?: string;
}

/**
 * Load config from ~/.forge-sim/config.json.
 */
export async function loadConfig(): Promise<ForgeSimConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Save config to ~/.forge-sim/config.json (mode 0600 for security).
 */
export async function saveConfig(config: ForgeSimConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Migration — strip the legacy `oauth` field from ~/.forge-sim/config.json
 * if present. Returns true if anything was removed. Anthropic key + any
 * future fields are preserved.
 */
export async function dropOAuthAppConfig(): Promise<boolean> {
  const config = await loadConfig();
  if ('oauth' in config) {
    delete (config as Record<string, unknown>).oauth;
    await saveConfig(config);
    return true;
  }
  return false;
}

// ── Anthropic API Key (@forge/llm) ──────────────────────────────────────

/**
 * Get Anthropic API key. Env var takes precedence over config file.
 */
export async function getAnthropicApiKey(): Promise<string | null> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;

  const config = await loadConfig();
  return config.anthropicApiKey ?? null;
}

/**
 * Save Anthropic API key to config file.
 */
export async function saveAnthropicApiKey(key: string): Promise<void> {
  const config = await loadConfig();
  config.anthropicApiKey = key;
  await saveConfig(config);
}

/**
 * Remove Anthropic API key from config file.
 */
export async function clearAnthropicApiKey(): Promise<void> {
  const config = await loadConfig();
  delete config.anthropicApiKey;
  await saveConfig(config);
}
