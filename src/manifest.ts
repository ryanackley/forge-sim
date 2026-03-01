/**
 * Manifest parser for Forge apps.
 *
 * Reads manifest.yml and extracts module definitions, function mappings,
 * consumer/queue relationships, and scheduled triggers.
 */

import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import type { ForgeManifest, ManifestModule } from './types.js';

export interface ParsedManifest {
  raw: ForgeManifest;
  functions: Map<string, ManifestFunction>;
  consumers: ManifestConsumer[];
  triggers: ManifestTrigger[];
  scheduledTriggers: ManifestScheduledTrigger[];
  uiModules: ManifestUIModule[];
  permissions: string[];
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
  const raw = parseYaml(content) as ForgeManifest;
  const modules = raw.modules ?? {};

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
  const uiModuleTypes = new Set([
    'jira:issuePanel', 'jira:issueActivity', 'jira:issueContext',
    'jira:issueGlance', 'jira:issueAction', 'jira:globalPage',
    'jira:projectPage', 'jira:adminPage', 'jira:dashboardGadget',
    'confluence:globalPage', 'confluence:spacePage', 'confluence:contentAction',
    'confluence:contentBylineItem', 'confluence:contextMenu',
    'macro',
  ]);

  for (const [moduleType, moduleDefs] of Object.entries(modules)) {
    if (!uiModuleTypes.has(moduleType)) continue;
    for (const mod of moduleDefs as any[]) {
      uiModules.push({
        type: moduleType,
        key: mod.key,
        title: mod.title,
        resolverFunctionKey: mod.resolver?.function,
        resourceKey: mod.resource,
      });
    }
  }

  return {
    raw,
    functions,
    consumers,
    triggers,
    scheduledTriggers,
    uiModules,
    permissions: raw.permissions?.scopes ?? [],
  };
}
