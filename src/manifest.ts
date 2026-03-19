/**
 * Manifest parser for Forge apps.
 *
 * Reads manifest.yml and extracts module definitions, function mappings,
 * consumer/queue relationships, and scheduled triggers.
 */

import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import type { ForgeManifest, ManifestModule, ManifestRemote, ManifestEndpoint, ManifestAuthProvider } from './types.js';

export interface ParsedManifest {
  raw: ForgeManifest;
  functions: Map<string, ManifestFunction>;
  resources: Map<string, ManifestResource>;
  consumers: ManifestConsumer[];
  triggers: ManifestTrigger[];
  scheduledTriggers: ManifestScheduledTrigger[];
  uiModules: ManifestUIModule[];
  permissions: string[];
  remotes: Map<string, ManifestRemote>;
  endpoints: Map<string, ManifestEndpoint>;
  authProviders: Map<string, ManifestAuthProvider>;
}

export interface ManifestResource {
  key: string;
  path: string; // e.g. "src/frontend/index.tsx"
}

export interface ManifestFunction {
  key: string;
  handler: string; // e.g. "index.handler" or "resolvers.handler"
  timeoutSeconds?: number;
}

export interface ManifestConsumer {
  key: string;
  queue: string;
  functionKey: string;
}

export interface ManifestTrigger {
  key: string;
  functionKey: string;
  events: string[];
}

export interface ManifestScheduledTrigger {
  key: string;
  functionKey: string;
  interval: string;
}

export interface ManifestUIModule {
  type: string; // e.g. "jira:issuePanel", "jira:globalPage"
  key: string;
  title?: string;
  resolverFunctionKey?: string;
  endpointKey?: string;
  resourceKey?: string;
}

/**
 * Parse a Forge manifest.yml file.
 */
export async function parseManifest(manifestPath: string): Promise<ParsedManifest> {
  const content = await readFile(manifestPath, 'utf-8');
  return parseManifestContent(content);
}

/**
 * Parse manifest content string (useful for testing without files).
 */
export function parseManifestContent(content: string): ParsedManifest {
  const raw = (parseYaml(content) ?? {}) as ForgeManifest;
  const modules = raw.modules ?? {};

  // Parse resources (top-level, not under modules)
  const resources = new Map<string, ManifestResource>();
  for (const res of ((raw as any).resources ?? []) as any[]) {
    resources.set(res.key, { key: res.key, path: res.path });
  }

  // Parse functions
  const functions = new Map<string, ManifestFunction>();
  for (const fn of (modules.function ?? []) as any[]) {
    functions.set(fn.key, {
      key: fn.key,
      handler: fn.handler,
      timeoutSeconds: fn.timeoutSeconds,
    });
  }

  // Parse consumers
  const consumers: ManifestConsumer[] = [];
  for (const consumer of (modules.consumer ?? []) as any[]) {
    consumers.push({
      key: consumer.key,
      queue: consumer.queue,
      functionKey: consumer.function,
    });
  }

  // Parse triggers
  const triggers: ManifestTrigger[] = [];
  for (const trigger of (modules.trigger ?? []) as any[]) {
    triggers.push({
      key: trigger.key,
      functionKey: trigger.function,
      events: trigger.events ?? [],
    });
  }

  // Parse scheduled triggers
  const scheduledTriggers: ManifestScheduledTrigger[] = [];
  for (const st of (modules.scheduledTrigger ?? []) as any[]) {
    scheduledTriggers.push({
      key: st.key,
      functionKey: st.function,
      interval: st.schedule?.interval ?? st.interval,
    });
  }

  // Parse UI modules (any module with a resolver or resource)
  const uiModules: ManifestUIModule[] = [];
  // Non-UI module types that should never be treated as UI modules
  // (they appear at the top level of modules: but don't render UI)
  const nonUIModuleTypes = new Set([
    'function', 'endpoint', 'consumer', 'scheduledTrigger',
    'trigger', 'webtrigger', 'remote',
  ]);

  for (const [moduleType, moduleDefs] of Object.entries(modules)) {
    if (nonUIModuleTypes.has(moduleType)) continue;
    if (!Array.isArray(moduleDefs)) continue;
    for (const mod of moduleDefs as any[]) {
      // A UI module must have a resource key (Custom UI or UIKit entry)
      // or a render property — skip anything that doesn't look like UI
      if (!mod.resource && !mod.render && !mod.function) continue;
      // Warn about UIKit 1 style: module has function but no resource
      if (mod.function && !mod.resource) {
        console.warn(
          `[forge-sim] Warning: module "${mod.key}" (${moduleType}) uses "function:" without "resource:". ` +
          `This is the deprecated UIKit 1 pattern. UIKit 2 modules should have "resource: <key>" and "render: native". ` +
          `See: https://developer.atlassian.com/platform/forge/ui-kit-2/`
        );
      }

      uiModules.push({
        type: moduleType,
        key: mod.key,
        title: mod.title,
        resolverFunctionKey: mod.resolver?.function,
        endpointKey: mod.resolver?.endpoint,
        resourceKey: mod.resource,
      });
    }
  }

  // Parse remotes
  const remotes = new Map<string, ManifestRemote>();
  for (const remote of (raw.remotes ?? []) as any[]) {
    if (remote.key && remote.baseUrl) {
      const parsed: ManifestRemote = { key: remote.key, baseUrl: remote.baseUrl };
      if (remote.operations) parsed.operations = remote.operations;
      if (remote.auth) parsed.auth = remote.auth;
      remotes.set(remote.key, parsed);
    }
  }

  // Parse endpoints
  const endpoints = new Map<string, ManifestEndpoint>();
  for (const ep of (modules.endpoint ?? []) as any[]) {
    if (ep.key && ep.remote) {
      const parsed: ManifestEndpoint = { key: ep.key, remote: ep.remote };
      if (ep.route) parsed.route = ep.route;
      if (ep.auth) parsed.auth = ep.auth;
      endpoints.set(ep.key, parsed);
    }
  }

  // Parse auth providers
  const authProviders = new Map<string, ManifestAuthProvider>();
  for (const provider of (raw.providers?.auth ?? []) as ManifestAuthProvider[]) {
    if (provider.key) {
      authProviders.set(provider.key, provider);
    }
  }

  return {
    raw,
    functions,
    resources,
    consumers,
    triggers,
    scheduledTriggers,
    uiModules,
    permissions: raw.permissions?.scopes ?? [],
    remotes,
    endpoints,
    authProviders,
  };
}
