/**
 * Manifest parser for Forge apps.
 *
 * Reads manifest.yml and extracts module definitions, function mappings,
 * consumer/queue relationships, and scheduled triggers.
 */

import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import type {
  ForgeManifest,
  ManifestModule,
  ManifestRemote,
  ManifestEndpoint,
  ManifestAuthProvider,
  ManifestEntityDef,
  ManifestEntityIndex,
} from './types.js';

export interface ManifestWarning {
  level: 'error' | 'warning' | 'info';
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
  /** Rovo action definitions (for tools UI invocation) */
  actions: ManifestAction[];
  /**
   * Custom Entity Store schemas parsed from app.storage.entities, keyed by
   * entity name. Auto-registered with sim.kvs at deploy time so type
   * validation and indexed queries match real Forge behavior.
   */
  entities: Map<string, ManifestEntityDef>;
}

export interface ManifestAction {
  key: string;
  name: string;
  description: string;
  functionKey: string;
  actionVerb?: string;
  inputs: Record<string, { title: string; type: string; required: boolean; description?: string }>;
  /** If the action has a config UI resource */
  configResourceKey?: string;
}

export interface ManifestResource {
  key: string;
  path: string; // e.g. "src/frontend/index.tsx"
}

export interface ManifestFunction {
  key: string;
  handler: string; // e.g. "index.handler" or "resolvers.handler"
  timeoutSeconds?: number;
  /** Function type: 'workflow' for post-functions/validators, 'resolver' for resolvers, etc. */
  type?: string;
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
  /** For jira:customField / jira:customFieldType / macro sub-modules */
  viewMode?: 'view' | 'edit' | 'create' | 'config';
  /** The data type of the custom field (number, string, user, etc.) */
  fieldType?: string;
  /** The key of the value function (computes field value from issue data) */
  valueFunctionKey?: string;
  /** Whether the field is read-only */
  readOnly?: boolean;
  // ── Macro Properties ──
  /** For macro modules: true if the manifest uses simple/inline config (config: true or config: {} without resource) */
  inlineMacroConfig?: boolean;
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
 * Canonical Forge module types, sourced from Atlassian's official module
 * list (forge-mcp `list-forge-modules`, 2025-10-15) plus sim-supported
 * extras (`endpoint`, `jira:globalBackgroundScript`, `jira:fullPage`).
 *
 * Unknown module types get a WARNING but still deploy — real Forge lint
 * rejects them, but hard-failing here would break forge-sim for everyone
 * whenever Atlassian ships a new module type. A future strict mode can
 * upgrade the warning to a hard reject. (Decided 2026-07-01.)
 */
export const KNOWN_MODULE_TYPES = new Set([
  // Platform (product-agnostic)
  'function', 'consumer', 'scheduledTrigger', 'trigger', 'webtrigger',
  'endpoint', 'action',
  // Jira
  'jira:adminPage', 'jira:backlogAction', 'jira:boardAction',
  'jira:customField', 'jira:customFieldType', 'jira:dashboardBackgroundScript',
  'jira:dashboardGadget', 'jira:entityProperty', 'jira:globalPage',
  'jira:globalPermission', 'jira:issueAction', 'jira:issueActivity',
  'jira:issueContext', 'jira:issueGlance', 'jira:issueNavigatorAction',
  'jira:issuePanel', 'jira:issueViewBackgroundScript', 'jira:jqlFunction',
  'jira:personalSettingsPage', 'jira:projectPage', 'jira:projectPermission',
  'jira:projectSettingsPage', 'jira:sprintAction', 'jira:timeTrackingProvider',
  'jira:uiModifications', 'jira:workflowValidator', 'jira:workflowCondition',
  'jira:workflowPostFunction', 'jira:command',
  // Sim-supported Jira extras (not in the official list but in the wild)
  'jira:globalBackgroundScript', 'jira:fullPage',
  // Bitbucket
  'bitbucket:mergeCheck', 'bitbucket:dynamicPipelinesProvider',
  'bitbucket:repoCodeOverviewCard', 'bitbucket:repoCodeOverviewAction',
  'bitbucket:repoCodeOverviewPanel', 'bitbucket:repoPullRequestCard',
  'bitbucket:repoPullRequestAction', 'bitbucket:repoPullRequestOverviewPanel',
  'bitbucket:repoMainMenuPage', 'bitbucket:repoSettingsMenuPage',
  'bitbucket:workspaceSettingsMenuPage',
  // Compass
  'compass:adminPage', 'compass:componentPage', 'compass:dataProvider',
  'compass:globalPage', 'compass:teamPage',
  // Confluence
  'confluence:contentAction', 'confluence:contentBylineItem',
  'confluence:contextMenu', 'confluence:customContent',
  'confluence:globalPage', 'confluence:globalSettings',
  'confluence:homepageFeed', 'macro', 'confluence:pageBanner',
  'confluence:spacePage', 'confluence:spaceSettings',
  'confluence:backgroundScript',
  // Jira Service Management
  'jiraServiceManagement:assetsImportType',
  'jiraServiceManagement:organizationPanel',
  'jiraServiceManagement:portalFooter',
  'jiraServiceManagement:portalHeader',
  'jiraServiceManagement:portalProfilePanel',
  'jiraServiceManagement:portalRequestCreatePropertyPanel',
  'jiraServiceManagement:portalRequestDetail',
  'jiraServiceManagement:portalRequestDetailPanel',
  'jiraServiceManagement:portalRequestViewAction',
  'jiraServiceManagement:portalSubheader',
  'jiraServiceManagement:portalUserMenuAction',
  'jiraServiceManagement:queuePage',
  // Rovo
  'rovo:agent',
]);

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

  // Warn on unknown module types — deploy anyway (see KNOWN_MODULE_TYPES).
  for (const moduleType of Object.keys(modules)) {
    if (!KNOWN_MODULE_TYPES.has(moduleType)) {
      warnings.push({
        level: 'warning',
        message: `Unknown module type '${moduleType}' — not validated, deploying anyway. ` +
          `Real Forge lint may reject this manifest.`,
      });
    }
  }
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

  // Rovo actions
  const actions: ManifestAction[] = [];

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

    // ── Rovo actions ─────────────────────────────────────────────────
    if (moduleType === 'action') {
      for (const mod of moduleDefs as any[]) {
        if (!mod.key || !mod.function) continue;
        const name = mod.name || mod.key;
        const description = mod.description || '';
        const functionKey = mod.function;

        // Parse inputs schema
        const inputs: Record<string, { title: string; type: string; required: boolean; description?: string }> = {};
        if (mod.inputs && typeof mod.inputs === 'object') {
          for (const [inputName, inputDef] of Object.entries(mod.inputs as Record<string, any>)) {
            inputs[inputName] = {
              title: inputDef.title || inputName,
              type: inputDef.type || 'string',
              required: inputDef.required === true || inputDef.required === 'true',
              description: inputDef.description,
            };
          }
        }

        // Register the action function
        if (!functions.has(functionKey)) {
          functions.set(functionKey, { key: functionKey, handler: functionKey, type: 'action' });
        }

        // Track as an action
        actions.push({
          key: mod.key,
          name,
          description,
          functionKey,
          actionVerb: mod.actionVerb,
          inputs,
          configResourceKey: mod.config?.resource,
        });

        // If it has a config UI resource, add as UI module
        if (mod.config?.resource) {
          uiModules.push({
            type: moduleType,
            key: mod.key,
            title: `${name} (Config)`,
            resolverFunctionKey: mod.resolver?.function,
            endpointKey: mod.resolver?.endpoint,
            resourceKey: mod.config.resource,
            icon: mod.icon,
          });
        }

        // Register resolver if present
        if (mod.resolver?.function && !functions.has(mod.resolver.function)) {
          functions.set(mod.resolver.function, { key: mod.resolver.function, handler: mod.resolver.function });
        }
      }
      continue;
    }

    // ── Workflow modules: create/edit/view config UIs + function invocation ──
    const WORKFLOW_TYPES = new Set(['jira:workflowCondition', 'jira:workflowValidator', 'jira:workflowPostFunction']);
    if (WORKFLOW_TYPES.has(moduleType)) {
      for (const mod of moduleDefs as any[]) {
        if (!mod.key) continue;
        const baseName = typeof mod.name === 'string' ? mod.name : mod.name?.i18n || mod.key;
        const resolverFunctionKey = mod.resolver?.function;
        const endpointKey = mod.resolver?.endpoint;

        // Extract create/edit/view resources as sub-modules
        const viewModes = [
          { mode: 'create', resource: mod.create?.resource },
          { mode: 'edit', resource: mod.edit?.resource },
          { mode: 'view', resource: mod.view?.resource },
        ] as const;

        let hasAnyResource = false;
        for (const { mode, resource } of viewModes) {
          if (!resource) continue;
          hasAnyResource = true;
          uiModules.push({
            type: moduleType,
            key: `${mod.key}--${mode}`,
            title: `${baseName} (${mode.charAt(0).toUpperCase() + mode.slice(1)})`,
            resolverFunctionKey,
            endpointKey,
            resourceKey: resource,
            viewMode: mode,
          });
        }

        // If no resources at all, skip UI — it's function/expression only
        // Still register the function for invocation

        // Register the direct function (workflowPostFunction has top-level `function`)
        if (mod.function) {
          const fnKey = mod.function;
          if (!functions.has(fnKey)) {
            functions.set(fnKey, { key: fnKey, handler: fnKey, type: 'workflow' });
          }
        }

        // Register resolver function if present
        if (resolverFunctionKey && !functions.has(resolverFunctionKey)) {
          functions.set(resolverFunctionKey, { key: resolverFunctionKey, handler: resolverFunctionKey });
        }

        // Store expression and errorMessage metadata on the module for invocation context
        if (!hasAnyResource) {
          // No UI resources — but we still want this function to be invocable
          // Log it so devs know it's registered
          const exprInfo = mod.expression ? ` (expression: ${mod.expression.substring(0, 50)}...)` : '';
          console.log(`  ℹ️  Workflow ${moduleType.split(':')[1]} "${mod.key}" — no config UI, function-only${exprInfo}`);
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

    // ── Macro modules: extract optional config sub-module ──
    // Macros without config keep their flat module shape (key = mod.key).
    // Macros with `config.resource` split into --view + --config sub-modules,
    // mirroring the custom field view/edit pattern.
    if (moduleType === 'macro') {
      for (const mod of moduleDefs as any[]) {
        if (!mod.key) continue;
        const baseTitle = typeof mod.title === 'string'
          ? mod.title
          : (mod.title?.i18n || mod.key);
        const resolverFunctionKey = mod.resolver?.function;
        const endpointKey = mod.resolver?.endpoint;

        const configField = mod.config;
        const configResource = configField && typeof configField === 'object' ? configField.resource : undefined;
        const hasInlineConfig = configField === true ||
          (configField && typeof configField === 'object' && !configResource);

        if (configResource && mod.resource) {
          // Custom config: split into --view + --config sub-modules
          uiModules.push({
            type: moduleType,
            key: `${mod.key}--view`,
            title: `${baseTitle} (View)`,
            resolverFunctionKey,
            endpointKey,
            resourceKey: mod.resource,
            viewMode: 'view',
            icon: mod.icon,
          });
          uiModules.push({
            type: moduleType,
            key: `${mod.key}--config`,
            title: `${baseTitle} (Config)`,
            resolverFunctionKey,
            endpointKey,
            resourceKey: configResource,
            viewMode: 'config',
            icon: (configField && typeof configField === 'object' ? configField.icon : undefined) || mod.icon,
          });
        } else if (mod.resource) {
          // No config or inline config — keep the flat shape for backward compat
          uiModules.push({
            type: moduleType,
            key: mod.key,
            title: baseTitle,
            resolverFunctionKey,
            endpointKey,
            resourceKey: mod.resource,
            icon: mod.icon,
            inlineMacroConfig: hasInlineConfig || undefined,
          });
        }

        if (hasInlineConfig) {
          warnings.push({
            level: 'info',
            message: `Macro "${mod.key}" uses inline config (config: ${configField === true ? 'true' : '{}'}). ` +
              `forge-sim captures the second ForgeDoc tree from ForgeReconciler.addConfig() and shows ` +
              `View/Config tabs inside the iframe. Submitting the config form stores the payload and ` +
              `re-renders the view so useConfig() returns the new values.`,
          });
        }

        // Register resolver function if present
        if (resolverFunctionKey && !functions.has(resolverFunctionKey)) {
          functions.set(resolverFunctionKey, { key: resolverFunctionKey, handler: resolverFunctionKey });
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

  // Parse app.storage.entities (Custom Entity Store schemas).
  // These are auto-registered with sim.kvs at deploy time so entity.set
  // validates attribute types and entity.query().index() uses partition/range
  // filters — matching real Forge behavior. Without this, an app that works
  // in forge-sim can fail in production (silent full-table scans, wrong types
  // accepted, etc.).
  const entities = new Map<string, ManifestEntityDef>();
  const VALID_ENTITY_TYPES = new Set(['integer', 'float', 'string', 'boolean', 'any']);
  const rawEntities = raw.app?.storage?.entities;
  if (rawEntities !== undefined && !Array.isArray(rawEntities)) {
    warnings.push({
      level: 'error',
      message: 'app.storage.entities must be an array.',
    });
  } else if (Array.isArray(rawEntities)) {
    for (const [idx, rawEntity] of rawEntities.entries()) {
      if (!rawEntity || typeof rawEntity !== 'object') {
        warnings.push({
          level: 'error',
          message: `app.storage.entities[${idx}] must be an object with name/attributes/indexes.`,
        });
        continue;
      }
      const name = (rawEntity as ManifestEntityDef).name;
      if (typeof name !== 'string' || !name) {
        warnings.push({
          level: 'error',
          message: `app.storage.entities[${idx}] is missing a "name" string.`,
        });
        continue;
      }
      if (entities.has(name)) {
        warnings.push({
          level: 'error',
          message: `app.storage.entities: duplicate entity name "${name}". ` +
            'Each entity must have a unique name within the manifest.',
        });
        continue;
      }

      const rawAttrs = (rawEntity as any).attributes;
      const attributes: Record<string, { type: string }> = {};
      if (!rawAttrs || typeof rawAttrs !== 'object') {
        warnings.push({
          level: 'error',
          message: `Entity "${name}" is missing the "attributes" map.`,
        });
        continue;
      }
      for (const [attrName, attrDef] of Object.entries(rawAttrs)) {
        const t = (attrDef as { type?: string })?.type;
        if (typeof t !== 'string' || !t) {
          warnings.push({
            level: 'error',
            message: `Entity "${name}" attribute "${attrName}" is missing a "type" string.`,
          });
          continue;
        }
        if (!VALID_ENTITY_TYPES.has(t)) {
          warnings.push({
            level: 'warning',
            message: `Entity "${name}" attribute "${attrName}" uses an unknown type "${t}". ` +
              `Valid types: ${[...VALID_ENTITY_TYPES].join(', ')}. ` +
              'forge-sim will accept any value for this attribute, but real Forge may reject it.',
          });
        }
        attributes[attrName] = { type: t };
      }

      const rawIndexes = (rawEntity as any).indexes;
      const indexes: ManifestEntityIndex[] = [];
      if (rawIndexes !== undefined && !Array.isArray(rawIndexes)) {
        warnings.push({
          level: 'error',
          message: `Entity "${name}" indexes must be an array (got ${typeof rawIndexes}).`,
        });
      } else if (Array.isArray(rawIndexes)) {
        const seenIndexNames = new Set<string>();
        for (const [iIdx, rawIndex] of rawIndexes.entries()) {
          if (!rawIndex || typeof rawIndex !== 'object') {
            warnings.push({
              level: 'error',
              message: `Entity "${name}" indexes[${iIdx}] must be an object.`,
            });
            continue;
          }
          const indexName = (rawIndex as ManifestEntityIndex).name;
          if (typeof indexName !== 'string' || !indexName) {
            warnings.push({
              level: 'error',
              message: `Entity "${name}" indexes[${iIdx}] is missing a "name" string.`,
            });
            continue;
          }
          if (seenIndexNames.has(indexName)) {
            warnings.push({
              level: 'error',
              message: `Entity "${name}" has duplicate index name "${indexName}".`,
            });
            continue;
          }
          seenIndexNames.add(indexName);
          const partition = (rawIndex as any).partition;
          if (partition !== undefined && !Array.isArray(partition)) {
            warnings.push({
              level: 'error',
              message: `Entity "${name}" index "${indexName}" partition must be an array of attribute names.`,
            });
            continue;
          }
          // Warn on partition attrs that don't exist in the attributes map
          if (Array.isArray(partition)) {
            for (const attrName of partition) {
              if (typeof attrName === 'string' && !(attrName in attributes)) {
                warnings.push({
                  level: 'warning',
                  message: `Entity "${name}" index "${indexName}" partitions on "${attrName}" ` +
                    'but no such attribute is declared. Real Forge will reject this manifest.',
                });
              }
            }
          }
          // `range` accepts two YAML shapes:
          //   range: <attr>          # scalar (canonical)
          //   range: [<attr>]        # list-of-one (matches the official docs YAML example;
          //                          #  Atlassian's docs sometimes show this even though
          //                          #  the surrounding prose says "only one attribute")
          // Real Forge accepts both. Anything else — non-string, empty array, multi-element
          // array — is a hard error.
          const rawRange = (rawIndex as any).range;
          let range: string | undefined;
          if (rawRange === undefined) {
            range = undefined;
          } else if (typeof rawRange === 'string') {
            range = rawRange;
          } else if (Array.isArray(rawRange)) {
            if (rawRange.length === 0) {
              warnings.push({
                level: 'error',
                message: `Entity "${name}" index "${indexName}" range is an empty array. ` +
                  'Specify a single attribute as a string (range: <attr>) or a list-of-one.',
              });
              continue;
            }
            if (rawRange.length > 1) {
              warnings.push({
                level: 'error',
                message: `Entity "${name}" index "${indexName}" range may only have one attribute, ` +
                  `got ${rawRange.length}: ${JSON.stringify(rawRange)}. ` +
                  'Real Forge rejects multi-attribute range keys.',
              });
              continue;
            }
            if (typeof rawRange[0] !== 'string') {
              warnings.push({
                level: 'error',
                message: `Entity "${name}" index "${indexName}" range must be an attribute name (string), ` +
                  `got ${typeof rawRange[0]}.`,
              });
              continue;
            }
            range = rawRange[0];
          } else {
            warnings.push({
              level: 'error',
              message: `Entity "${name}" index "${indexName}" range must be an attribute name (string) ` +
                `or a list-of-one. Got ${typeof rawRange}.`,
            });
            continue;
          }
          if (range !== undefined && !(range in attributes)) {
            warnings.push({
              level: 'warning',
              message: `Entity "${name}" index "${indexName}" ranges on "${range}" ` +
                'but no such attribute is declared. Real Forge will reject this manifest.',
            });
          }
          indexes.push({
            name: indexName,
            partition: Array.isArray(partition) ? partition.filter((p): p is string => typeof p === 'string') : [],
            range,
          });
        }
      }

      entities.set(name, { name, attributes, indexes });
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
    actions,
    entities,
  };
}
