/**
 * When does forge-sim load stored credentials and connect to a real site?
 *
 * One answer for every channel, decided here and nowhere else: no channel
 * calls `loadAuthFromEnv()` around it, and every channel's default can be
 * overridden either way:
 *
 *   | channel | default  | why                                                      |
 *   |---------|----------|----------------------------------------------------------|
 *   | dev     | connect  | exploratory testing in a browser; nobody mocks every call |
 *   | mcp     | offline  | an agent drives it; reaching a real site must be asked for |
 *   | cli     | offline  | same, for the daemon behind `forge-sim deploy`            |
 *
 * The in-process test library is not a channel here: it connects only when a
 * test calls `sim.loadAuthFromEnv()` itself.
 *
 * Precedence: `--connect`/`--offline` flag > `FORGE_SIM_CONNECT` env > channel
 * default. "Connect" covers everything `loadAuthFromEnv()` loads — the
 * Atlassian account, third-party provider tokens, provider client secrets and
 * the Anthropic key — because each of them is what lets a call leave the
 * machine. Mocks win over the real backend either way (product-api.ts).
 */

import { getDefaultAccount, loadCredentials } from './credentials.js';

export type ConnectChannel = 'dev' | 'mcp' | 'cli';

/** Env var that forces the policy on (`1`) or off (`0`) for any channel. */
export const CONNECT_ENV = 'FORGE_SIM_CONNECT';

export interface ConnectPolicy {
  channel: ConnectChannel;
  /** Load stored credentials (and env credentials) and connect. */
  connect: boolean;
  /** What decided it: a CLI flag, the FORGE_SIM_CONNECT env var, or the channel default. */
  source: 'flag' | 'env' | 'default';
}

export interface ResolveConnectPolicyOptions {
  /** `--connect` was passed. */
  connectFlag?: boolean;
  /** `--offline` was passed. */
  offlineFlag?: boolean;
  /** Environment to read FORGE_SIM_CONNECT from (default: process.env). */
  env?: NodeJS.ProcessEnv;
}

/** Channel defaults. Only `forge-sim dev` connects without being asked. */
export const CONNECT_DEFAULTS: Readonly<Record<ConnectChannel, boolean>> = {
  dev: true,
  mcp: false,
  cli: false,
};

const TRUE_VALUES = ['1', 'true', 'yes', 'on'];
const FALSE_VALUES = ['0', 'false', 'no', 'off'];

/** The command a person types for each channel, for copy-pasteable messages. */
const CHANNEL_COMMAND: Record<ConnectChannel, string> = {
  dev: 'forge-sim dev',
  mcp: 'forge-sim-mcp',
  cli: 'forge-sim deploy',
};

/**
 * Decide whether a channel connects. Throws on a contradiction (both flags)
 * or an unrecognised FORGE_SIM_CONNECT value, rather than guessing which one
 * the person meant — a guess in the "connect" direction sends real traffic.
 */
export function resolveConnectPolicy(
  channel: ConnectChannel,
  opts: ResolveConnectPolicyOptions = {},
): ConnectPolicy {
  const env = opts.env ?? process.env;
  const cmd = CHANNEL_COMMAND[channel];

  if (opts.connectFlag && opts.offlineFlag) {
    throw new Error(
      `--connect and --offline cannot be used together. Pick one:\n` +
      `  ${cmd} --connect   # load stored credentials; unmocked product API calls reach the real site\n` +
      `  ${cmd} --offline   # never load stored credentials; unmocked product API calls return 501`,
    );
  }
  if (opts.offlineFlag) return { channel, connect: false, source: 'flag' };
  if (opts.connectFlag) return { channel, connect: true, source: 'flag' };

  const raw = env[CONNECT_ENV];
  if (raw !== undefined && raw.trim() !== '') {
    const value = raw.trim().toLowerCase();
    if (TRUE_VALUES.includes(value)) return { channel, connect: true, source: 'env' };
    if (FALSE_VALUES.includes(value)) return { channel, connect: false, source: 'env' };
    throw new Error(
      `${CONNECT_ENV}=${JSON.stringify(raw)} is not a recognised value. Use one of:\n` +
      `  ${CONNECT_ENV}=1   # connect (also: true, yes, on)\n` +
      `  ${CONNECT_ENV}=0   # stay offline (also: false, no, off)\n` +
      `or unset it to use the default for ${cmd} (${CONNECT_DEFAULTS[channel] ? 'connect' : 'offline'}).`,
    );
  }

  return { channel, connect: CONNECT_DEFAULTS[channel], source: 'default' };
}

/**
 * How to turn connecting ON for a channel that is offline — from what made it
 * offline, since a flag beats the env: after `--offline`, setting
 * FORGE_SIM_CONNECT=1 changes nothing, and after FORGE_SIM_CONNECT=0 the
 * direct override is `--connect`. Copy-pasteable either way.
 */
export function connectHint(policy: Pick<ConnectPolicy, 'channel' | 'source'>): string {
  switch (policy.channel) {
    case 'mcp':
      if (policy.source === 'flag') {
        return `restart the MCP server with --connect instead of --offline (in the server's "args" in .mcp.json), then forge_deploy again`;
      }
      if (policy.source === 'env') {
        return `start the MCP server with --connect (add it to the server's "args" in .mcp.json; it beats ${CONNECT_ENV}=0) or set ${CONNECT_ENV}=1 in its env instead, then forge_deploy again`;
      }
      return `start the MCP server with --connect (add it to the server's "args" in .mcp.json) or set ${CONNECT_ENV}=1 in its env, then forge_deploy again`;
    case 'cli':
      if (policy.source === 'flag') return `run forge-sim deploy --connect instead of --offline`;
      if (policy.source === 'env') return `run forge-sim deploy --connect (it beats ${CONNECT_ENV}=0) or set ${CONNECT_ENV}=1`;
      return `run forge-sim deploy --connect (or set ${CONNECT_ENV}=1)`;
    case 'dev':
      if (policy.source === 'flag') return `restart forge-sim dev without --offline`;
      if (policy.source === 'env') return `restart forge-sim dev with --connect (it beats ${CONNECT_ENV}=0), or unset ${CONNECT_ENV}`;
      return `restart forge-sim dev with --connect`;
  }
}

/**
 * One line of human text describing the policy, for startup banners and
 * info tools — every channel says the same thing the same way.
 */
export function describeConnectPolicy(policy: ConnectPolicy): string {
  const what =
    policy.channel === 'dev' ? 'forge-sim dev loads stored credentials at startup'
    : policy.channel === 'mcp' ? 'forge_deploy loads stored credentials'
    : 'forge-sim deploy loads stored credentials';

  if (policy.connect) {
    const why =
      policy.source === 'flag' ? '--connect'
      : policy.source === 'env' ? `${CONNECT_ENV} on`
      : 'connected by default';
    const off = policy.channel === 'dev' ? ` (--offline to skip)` : '';
    return `credentials: ${why} — ${what}; unmocked product API calls reach the real site${off}`;
  }

  const why =
    policy.source === 'flag' ? '--offline'
    : policy.source === 'env' ? `offline (${CONNECT_ENV} off)`
    : 'offline (opt-in)';
  return `credentials: ${why} — stored credentials are not loaded; unmocked product API calls return 501. To connect: ${connectHint(policy)}`;
}

export interface AvailableCredentials {
  site: string;
  email?: string;
  source: 'store' | 'env';
}

/**
 * Probe — WITHOUT connecting — whether credentials exist that a connecting
 * channel would load: the FORGE_SIM_SITE/EMAIL/PAT trio in the environment,
 * else the default account of the credential store (`<app>/.forge-sim/` if
 * present, else `~/.forge-sim/`). Same lookup order as `loadAuthFromEnv()`.
 * Lets an offline channel tell its user that a connection is one flag away.
 */
export async function findAvailableCredentials(
  appDir?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AvailableCredentials | null> {
  if (env.FORGE_SIM_SITE && env.FORGE_SIM_EMAIL && env.FORGE_SIM_PAT) {
    return { site: env.FORGE_SIM_SITE, email: env.FORGE_SIM_EMAIL, source: 'env' };
  }
  try {
    const account = getDefaultAccount(await loadCredentials(appDir ?? undefined));
    if (account) return { site: account.site, email: account.email, source: 'store' };
  } catch {
    // An unreadable store is "nothing available", same as loadAuthFromEnv.
  }
  return null;
}
