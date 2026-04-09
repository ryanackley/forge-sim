/**
 * forge-sim configuration — service-level settings.
 *
 * Stored in ~/.forge-sim/config.json (separate from credentials).
 * Contains the dev's own OAuth app registration and API keys.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { OAuthAppConfig } from './oauth.js';

const CONFIG_DIR = join(homedir(), '.forge-sim');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface ForgeSimConfig {
  oauth?: OAuthAppConfig;
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
 * Get OAuth app config from config file or env vars.
 */
export async function getOAuthAppConfig(): Promise<OAuthAppConfig | null> {
  // Env vars take precedence
  const envId = process.env.FORGE_SIM_OAUTH_CLIENT_ID;
  const envSecret = process.env.FORGE_SIM_OAUTH_CLIENT_SECRET;
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret };
  }

  const config = await loadConfig();
  return config.oauth ?? null;
}

/**
 * Save OAuth app config.
 */
export async function saveOAuthAppConfig(oauth: OAuthAppConfig): Promise<void> {
  const config = await loadConfig();
  config.oauth = oauth;
  await saveConfig(config);
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
