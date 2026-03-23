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
  webTriggers: ManifestWebTrigger[];
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

export interface ManifestWebTrigger {
  key: string;
  functionKey: string;
}

export interface ManifestUIModule {
  type: string; // e.g. "jira:issuePanel", "jira:globalPage"
  key: string;
  title?: string;
  resolverFunctionKey?: string;
  endpointKey?: string;
  resourceKey?: string;
}

// ── Background Script Support ───────────────────────────────────────────

/** Background script module types and the UI module contexts they auto-load with */
export const BACKGROUND_SCRIPT_TYPES = new Set([
  'jira:issueViewBackgroundScript',
  'jira:dashboardBackgroundScript',
  'jira:globalBackgroundScript',
  'confluence:backgroundScript',
]);

/** Maps background script types to the UI module types they run alongside */
export const BACKGROUND_SCRIPT_CONTEXTS: Record<string, string[]> = {
  'jira:issueViewBackgroundScript': [
    'jira:issuePanel', 'jira:issueContext', 'jira:issueGlance',
    'jira:issueActivity', 'jira:issueAction',
  ],
  'jira:dashboardBackgroundScript': [
    'jira:dashboardGadget',
  ],
  'jira:globalBackgroundScript': [
    'jira:globalPage', 'jira:fullPage',
  ],
  'confluence:backgroundScript': [
    'confluence:globalPage', 'confluence:spacePage', 'confluence:contentByLineItem',
    'confluence:contextMenu', 'confluence:contentAction', 'confluence:homepageFeed',
  ],
};

/**
 * Find background scripts compatible with a given UI module type.
 * Returns the ManifestUIModule entries for matching background scripts.
 */
export function getCompatibleBackgroundScripts(
  moduleType: string,
  allModules: ManifestUIModule[],
): ManifestUIModule[] {
  const bgScripts: ManifestUIModule[] = [];
  for (const [bgType, compatibleTypes] of Object.entries(BACKGROUND_SCRIPT_CONTEXTS)) {
    if (compatibleTypes.includes(moduleType)) {
      bgScripts.push(...allModules.filter((m) => m.type === bgType));
    }
  }
  return bgScripts;
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
  for (const res of (Array.isArray((raw as any).resources) ? (raw as any).resources : []) as any[]) {
    resources.set(res.key, { key: res.key, path: res.path });
  }

  // Parse functions
  const functions = new Map<string, ManifestFunction>();
  for (const fn of (Array.isArray(modules.function) ? modules.function : []) as any[]) {
    functions.set(fn.key, {
      key: fn.key,
      handler: fn.handler,
      timeoutSeconds: fn.timeoutSeconds,
    });
  }

  // Parse consumers
  const consumers: ManifestConsumer[] = [];
  for (const consumer of (Array.isArray(modules.consumer) ? modules.consumer : []) as any[]) {
    consumers.push({
      key: consumer.key,
      queue: consumer.queue,
      functionKey: consumer.function,
    });
  }

  // Parse triggers
  const triggers: ManifestTrigger[] = [];
  for (const trigger of (Array.isArray(modules.trigger) ? modules.trigger : []) as any[]) {
    triggers.push({
      key: trigger.key,
      functionKey: trigger.function,
      events: trigger.events ?? [],
    });
  }

  // Parse scheduled triggers
  const scheduledTriggers: ManifestScheduledTrigger[] = [];
  for (const st of (Array.isArray(modules.scheduledTrigger) ? modules.scheduledTrigger : []) as any[]) {
    scheduledTriggers.push({
      key: st.key,
      functionKey: st.function,
      interval: st.schedule?.interval ?? st.interval,
    });
  }

  // Parse web triggers
  const webTriggers: ManifestWebTrigger[] = [];
  for (const wt of (Array.isArray(modules.webtrigger) ? modules.webtrigger : []) as any[]) {
    webTriggers.push({
      key: wt.key,
      functionKey: wt.function,
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
  for (const remote of (Array.isArray(raw.remotes) ? raw.remotes : []) as any[]) {
    if (remote.key && remote.baseUrl) {
      const parsed: ManifestRemote = { key: remote.key, baseUrl: remote.baseUrl };
      if (remote.operations) parsed.operations = remote.operations;
      if (remote.auth) parsed.auth = remote.auth;
      remotes.set(remote.key, parsed);
    }
  }

  // Parse endpoints
  const endpoints = new Map<string, ManifestEndpoint>();
  for (const ep of (Array.isArray(modules.endpoint) ? modules.endpoint : []) as any[]) {
    if (ep.key && ep.remote) {
      const parsed: ManifestEndpoint = { key: ep.key, remote: ep.remote };
      if (ep.route) parsed.route = ep.route;
      if (ep.auth) parsed.auth = ep.auth;
      endpoints.set(ep.key, parsed);
    }
  }

  // Parse auth providers
  const authProviders = new Map<string, ManifestAuthProvider>();
  for (const provider of (Array.isArray(raw.providers?.auth) ? raw.providers.auth : []) as ManifestAuthProvider[]) {
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
    webTriggers,
    permissions: raw.permissions?.scopes ?? [],
    remotes,
    endpoints,
    authProviders,
  };
}
