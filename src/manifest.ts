/**
 * Manifest parser for Forge apps.
 *
 * Reads manifest.yml and extracts module definitions, function mappings,
 * consumer/queue relationships, and scheduled triggers.
 */

import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import type { ForgeManifest, ManifestModule, ManifestRemote, ManifestEndpoint, ManifestAuthProvider } from './types.js';

export interface ManifestWarning {
  level: 'error' | 'warning';
  message: string;
}

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
  /** Validation warnings/errors found during parsing */
  warnings: ManifestWarning[];
  /** Command palette entries that reference existing module pages (not rendered separately) */
  commandPageTargets: Array<{ key: string; title: string; targetPage: string; shortcut?: string }>;
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
  /** Icon URL or resource reference (e.g. "resource:main;icons/icon.svg" or absolute URL) */
  icon?: string;
  /** For jira:globalBackgroundScript — which experiences this script runs on */
  experience?: string[];
  // ── Custom Field Properties ──
  /** For jira:customField / jira:customFieldType sub-modules */
  viewMode?: 'view' | 'edit';
  /** The data type of the custom field (number, string, user, etc.) */
  fieldType?: string;
  /** The key of the value function (computes field value from issue data) */
  valueFunctionKey?: string;
  /** Whether the field is read-only */
  readOnly?: boolean;
}

/** Module types where `icon` is required per the Forge manifest schema */
export const ICON_REQUIRED_MODULES = new Set([
  'jira:issuePanel',
]);

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
  // Global background scripts use the `experience` field to scope
  // where they run. Without experience, they don't run anywhere.
  // The mapping here covers all possible experiences.
  'jira:globalBackgroundScript': [
    'jira:globalPage', 'jira:fullPage',
    'jira:issuePanel', 'jira:issueContext', 'jira:issueGlance',
    'jira:issueActivity', 'jira:issueAction',
    'jira:dashboardGadget',
    'jira:boardAction', 'jira:backlogAction',
  ],
  'confluence:backgroundScript': [
    'confluence:globalPage', 'confluence:spacePage', 'confluence:contentByLineItem',
    'confluence:contextMenu', 'confluence:contentAction', 'confluence:homepageFeed',
  ],
};

/**
 * Maps global background script `experience` values to the UI module types
 * they're compatible with. Used to scope globalBackgroundScript by experience.
 *
 * Per Forge docs: if no experience is specified, the script won't run anywhere.
 */
export const GLOBAL_BG_EXPERIENCE_MAP: Record<string, string[]> = {
  'issue-view': [
    'jira:issuePanel', 'jira:issueContext', 'jira:issueGlance',
    'jira:issueActivity', 'jira:issueAction',
  ],
  'dashboard': [
    'jira:dashboardGadget',
  ],
  'board': [
    'jira:boardAction', 'jira:backlogAction',
  ],
  'all': [
    // all means everywhere — matches any Jira module
    'jira:issuePanel', 'jira:issueContext', 'jira:issueGlance',
    'jira:issueActivity', 'jira:issueAction',
    'jira:globalPage', 'jira:fullPage',
    'jira:dashboardGadget',
    'jira:boardAction', 'jira:backlogAction',
    'jira:projectPage', 'jira:projectSettingsPage', 'jira:adminPage',
  ],
};

/**
 * Find background scripts compatible with a given UI module type.
 * Returns the ManifestUIModule entries for matching background scripts.
 *
 * For jira:globalBackgroundScript, respects the `experience` field:
 * - If experience includes 'all', matches any Jira module
 * - If experience includes specific values (issue-view, dashboard, board),
 *   only matches modules in those contexts
 * - If no experience is set, the script doesn't match anything
 *   (per Forge docs: "will not run anywhere on Jira")
 */
export function getCompatibleBackgroundScripts(
  moduleType: string,
  allModules: ManifestUIModule[],
): ManifestUIModule[] {
  const bgScripts: ManifestUIModule[] = [];

  for (const [bgType, defaultCompatibleTypes] of Object.entries(BACKGROUND_SCRIPT_CONTEXTS)) {
    const candidates = allModules.filter((m) => m.type === bgType);

    for (const bg of candidates) {
      // Global background scripts use experience-based scoping
      if (bgType === 'jira:globalBackgroundScript') {
        if (!bg.experience || bg.experience.length === 0) {
          // No experience = doesn't run anywhere
          continue;
        }
        // Build the set of compatible module types from experience values
        const compatibleFromExperience = new Set<string>();
        for (const exp of bg.experience) {
          const mapped = GLOBAL_BG_EXPERIENCE_MAP[exp];
          if (mapped) {
            for (const t of mapped) compatibleFromExperience.add(t);
          }
        }
        if (compatibleFromExperience.has(moduleType)) {
          bgScripts.push(bg);
        }
      } else {
        // Non-global background scripts use static context mapping
        if (defaultCompatibleTypes.includes(moduleType)) {
          bgScripts.push(bg);
        }
      }
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
  const warnings: ManifestWarning[] = [];
  // Non-UI module types that should never be treated as UI modules
  // (they appear at the top level of modules: but don't render UI)
  const nonUIModuleTypes = new Set([
    'function', 'endpoint', 'consumer', 'scheduledTrigger',
    'trigger', 'webtrigger', 'remote',
  ]);

  // Module types with nested resource patterns (view.resource / edit.resource)
  const CUSTOM_FIELD_TYPES = new Set(['jira:customField', 'jira:customFieldType']);

  // Track command modules that reference existing pages (for dedup)
  const commandPageTargets: Array<{ key: string; title: string; targetPage: string; shortcut?: string }> = [];

  for (const [moduleType, moduleDefs] of Object.entries(modules)) {
    if (nonUIModuleTypes.has(moduleType)) continue;
    if (!Array.isArray(moduleDefs)) continue;

    // ── Command palette modules ──────────────────────────────────────
    if (moduleType === 'jira:command') {
      for (const mod of moduleDefs as any[]) {
        if (!mod.key || !mod.target) continue;
        const title = typeof mod.title === 'string' ? mod.title : mod.title?.i18n || mod.key;

        if (mod.target.resource) {
          // Dedicated resource → treat as a UI module
          uiModules.push({
            type: moduleType,
            key: mod.key,
            title,
            resolverFunctionKey: mod.resolver?.function,
            endpointKey: mod.resolver?.endpoint,
            resourceKey: mod.target.resource,
            icon: mod.icon,
          });
        } else if (mod.target.page) {
          // References an existing module's page → log, don't add to picker
          commandPageTargets.push({
            key: mod.key,
            title,
            targetPage: mod.target.page,
            shortcut: mod.shortcut,
          });
        }

        // Register resolver function if present
        if (mod.resolver?.function) {
          const fnKey = mod.resolver.function;
          if (!functions.has(fnKey)) {
            functions.set(fnKey, { key: fnKey, handler: fnKey });
          }
        }
      }
      continue;
    }

    // ── Custom field modules: extract view/edit as separate sub-modules ──
    if (CUSTOM_FIELD_TYPES.has(moduleType)) {
      for (const mod of moduleDefs as any[]) {
        if (!mod.key) continue;
        const baseName = mod.name
          ? (typeof mod.name === 'string' ? mod.name : mod.name.i18n || mod.key)
          : mod.key;
        const resolver = mod.resolver?.function || mod.resolver?.endpoint;
        const resolverFunctionKey = mod.resolver?.function;
        const endpointKey = mod.resolver?.endpoint;
        const valueFnKey = mod.value?.function || mod.view?.value?.function;

        // View sub-module
        const viewResource = mod.view?.resource || mod.resource;
        if (viewResource) {
          uiModules.push({
            type: moduleType,
            key: `${mod.key}--view`,
            title: `${baseName} (View)`,
            resolverFunctionKey,
            endpointKey,
            resourceKey: viewResource,
            viewMode: 'view',
            fieldType: mod.type,
            valueFunctionKey: valueFnKey,
            readOnly: mod.readOnly === true,
          });
        }

        // Edit sub-module (optional — not all custom fields have edit UI)
        const editResource = mod.edit?.resource;
        if (editResource) {
          uiModules.push({
            type: moduleType,
            key: `${mod.key}--edit`,
            title: `${baseName} (Edit)`,
            resolverFunctionKey,
            endpointKey,
            resourceKey: editResource,
            viewMode: 'edit',
            fieldType: mod.type,
            readOnly: mod.readOnly === true,
          });
        }

        // Register value function as a resolver if present
        if (valueFnKey) {
          const existing = functions.get(valueFnKey);
          if (!existing) {
            functions.set(valueFnKey, { key: valueFnKey, handler: valueFnKey });
          }
        }

        // Warn about missing experience — without it, Jira renders the
        // built-in control instead of the custom view/edit UI
        const viewExperience = mod.view?.experience;
        const editExperience = mod.edit?.experience;
        if (viewResource && (!Array.isArray(viewExperience) || viewExperience.length === 0)) {
          warnings.push({
            level: 'warning',
            message: `Custom field "${mod.key}" has a view resource but no view.experience. ` +
              `In Jira, this field will render the built-in control instead of your custom view UI. ` +
              `Add view.experience (e.g. ["issue-view"]) to your manifest.`,
          });
        }
        if (editResource && (!Array.isArray(editExperience) || editExperience.length === 0)) {
          warnings.push({
            level: 'warning',
            message: `Custom field "${mod.key}" has an edit resource but no edit.experience. ` +
              `In Jira, this field will render the built-in edit control instead of your custom edit UI. ` +
              `Add edit.experience (e.g. ["issue-view", "issue-create", "issue-transition"]) to your manifest.`,
          });
        }
      }
      continue;
    }

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

      const uiModule: ManifestUIModule = {
        type: moduleType,
        key: mod.key,
        title: mod.title,
        resolverFunctionKey: mod.resolver?.function,
        endpointKey: mod.resolver?.endpoint,
        resourceKey: mod.resource,
      };
      // Parse icon
      if (mod.icon) {
        uiModule.icon = mod.icon;
      }
      // Parse experience field for global background scripts
      if (Array.isArray(mod.experience) && mod.experience.length > 0) {
        uiModule.experience = mod.experience;
      }
      uiModules.push(uiModule);
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

  // ── Manifest Validation ──────────────────────────────────────────────
  const VALID_RUNTIME_NAMES = ['nodejs24.x', 'nodejs22.x', 'nodejs20.x'];

  // app.runtime is required (legacy sandbox runtime is deprecated)
  if (!raw.app?.runtime) {
    warnings.push({
      level: 'error',
      message: 'Missing required field: app.runtime. Add a runtime section to your manifest:\n' +
        '  app:\n    runtime:\n      name: nodejs22.x\n' +
        'Valid values: ' + VALID_RUNTIME_NAMES.join(', '),
    });
  } else if (!raw.app.runtime.name) {
    warnings.push({
      level: 'error',
      message: 'Missing required field: app.runtime.name. ' +
        'Valid values: ' + VALID_RUNTIME_NAMES.join(', '),
    });
  } else if (!VALID_RUNTIME_NAMES.includes(raw.app.runtime.name)) {
    warnings.push({
      level: 'warning',
      message: `Unknown runtime name: "${raw.app.runtime.name}". ` +
        'Known values: ' + VALID_RUNTIME_NAMES.join(', '),
    });
  }

  // Validate runtime.architecture if present
  if (raw.app?.runtime?.architecture && !['arm64', 'x86_64'].includes(raw.app.runtime.architecture)) {
    warnings.push({
      level: 'warning',
      message: `Unknown runtime architecture: "${raw.app.runtime.architecture}". ` +
        'Valid values: arm64, x86_64',
    });
  }

  // Validate runtime.memoryMB if present
  if (raw.app?.runtime?.memoryMB != null) {
    const mem = raw.app.runtime.memoryMB;
    if (mem < 128 || mem > 1024) {
      warnings.push({
        level: 'warning',
        message: `runtime.memoryMB (${mem}) is outside the valid range of 128-1024 MB.`,
      });
    }
  }

  // Validate icon on modules that require it
  for (const mod of uiModules) {
    if (ICON_REQUIRED_MODULES.has(mod.type) && !mod.icon) {
      warnings.push({
        level: 'error',
        message: `Module "${mod.key}" (${mod.type}) is missing the required "icon" property. ` +
          'Use an absolute URL or a resource reference:\n' +
          '  icon: https://example.com/icon.svg\n' +
          '  icon: resource:<resource-key>;icons/icon.svg',
      });
    }
  }

  // Check for runtime version mismatch with local Node
  if (raw.app?.runtime?.name && VALID_RUNTIME_NAMES.includes(raw.app.runtime.name)) {
    const manifestMajor = parseInt(raw.app.runtime.name.replace('nodejs', '').replace('.x', ''), 10);
    const localMajor = parseInt(process.versions.node.split('.')[0], 10);
    if (!isNaN(manifestMajor) && !isNaN(localMajor) && manifestMajor !== localMajor) {
      warnings.push({
        level: 'warning',
        message: `Runtime mismatch: manifest specifies ${raw.app.runtime.name} but local Node is v${process.versions.node}. ` +
          `Your app will run on Node ${manifestMajor} in Forge — behavior may differ locally.`,
      });
    }
  }

  // Log command palette entries that reference existing pages
  for (const cmd of commandPageTargets) {
    const shortcutInfo = cmd.shortcut ? ` (shortcut: ${cmd.shortcut})` : '';
    console.log(`  ℹ️  Command "${cmd.key}" → opens module "${cmd.targetPage}"${shortcutInfo}`);
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
    warnings,
    commandPageTargets,
  };
}
