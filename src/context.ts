/**
 * Forge Context — builds the full context object returned by
 * view.getContext() and useProductContext().
 *
 * Context shape matches Forge's FullContext type:
 *   accountId, cloudId, siteUrl, moduleKey, extension, environmentId,
 *   environmentType, localId, locale, timezone, license, theme, etc.
 *
 * The extension object contains module-type-specific data:
 *   - jira:issuePanel → { type, issue: { key, id, type, typeId }, project: { key, id } }
 *   - confluence:contentBylineItem → { type, content: { id }, space: { key, id } }
 *   - jira:globalPage → { type }
 *   - macro → { type, content: { id }, space: { key } }
 */

import type { ForgeSimulator } from './simulator.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface ForgeContext {
  accountId: string;
  cloudId: string;
  siteUrl: string;
  moduleKey: string;
  environmentId: string;
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  localId: string;
  locale: string;
  timezone: string;
  extension: Record<string, any>;
  license?: {
    active: boolean;
    type: string;
    billingPeriod?: string;
    isEvaluation?: boolean;
  };
  theme?: { colorMode?: 'light' | 'dark' };
  surfaceColor?: string;
  userAccess?: { enabled: boolean; hasAccess: boolean };
  permissions?: { scopes?: string[] };
}

/**
 * Canonical top-level ForgeContext fields. When `options.context` is passed
 * to `buildForgeContext`, fields named in this set are promoted to the top
 * level of the returned ForgeContext (e.g. `context.accountId` → `ctx.accountId`,
 * NOT `ctx.extension.accountId`). Anything else in `options.context` ends up
 * in `extension` (matching legacy behavior, used for things like `issueKey`,
 * custom field state, etc.).
 *
 * `moduleKey` is excluded — it always comes from the render argument.
 * `extension` is excluded — it has its own dedicated option.
 */
const CANONICAL_CONTEXT_FIELDS = new Set<string>([
  'accountId',
  'cloudId',
  'siteUrl',
  'environmentId',
  'environmentType',
  'localId',
  'locale',
  'timezone',
  'license',
  'theme',
  'surfaceColor',
  'userAccess',
  'permissions',
]);

/**
 * Split `options.context` into (canonical top-level overrides, extension overrides).
 * Used in two places below: explicit `options.context` handling and the smart
 * issueKey hydration branch.
 */
function partitionContextOverrides(
  raw: Record<string, unknown> | undefined,
): { canonical: Partial<ForgeContext>; extensionFields: Record<string, unknown> } {
  const canonical: Partial<ForgeContext> = {};
  const extensionFields: Record<string, unknown> = {};
  if (!raw) return { canonical, extensionFields };
  for (const [key, value] of Object.entries(raw)) {
    if (CANONICAL_CONTEXT_FIELDS.has(key)) {
      (canonical as Record<string, unknown>)[key] = value;
    } else {
      extensionFields[key] = value;
    }
  }
  return { canonical, extensionFields };
}

export interface RenderContextOptions {
  /**
   * Raw context fields. Canonical ForgeContext fields (`accountId`, `cloudId`,
   * `siteUrl`, `locale`, `timezone`, `environmentId`, `environmentType`,
   * `localId`, `license`, `theme`, `surfaceColor`, `userAccess`, `permissions`)
   * are promoted to the top level of the rendered context — they appear at
   * `ctx.accountId`, NOT `ctx.extension.accountId`. Anything else is merged
   * into `extension`. The same partial-context shape is used by
   * `sim.invoke(fn, payload, { context })`; this is the parallel UI surface.
   */
  context?: Record<string, unknown>;
  /** Jira issue key — fetches issue data to build context */
  issueKey?: string;
  /** Jira project key — fetches project data to build context */
  projectKey?: string;
  /** Confluence content ID — fetches content data to build context */
  contentId?: string;
  /** Confluence space key — fetches space data to build context */
  spaceKey?: string;
  /** Override the full extension object */
  extension?: Record<string, any>;
  /**
   * One-shot macro config injection. For `macro` modules only — surfaced
   * to the component via `useConfig()` as if a previous
   * `renderInlineConfig().save(values)` had set it. This is a per-render
   * override; it doesn't persist into the simulator's saved macroConfigs
   * map. The MCP `forge.ui_render` tool has accepted this field since it
   * shipped — this in-process equivalent closes the API drift (F3 from
   * run #8). For sticky values across renders, use `sim.ui.setMacroConfig`.
   */
  macroConfig?: Record<string, unknown>;
}

// ── Module type → extension field mapping ───────────────────────────────

const JIRA_ISSUE_MODULES = new Set([
  'jira:issuePanel', 'jira:issueActivity', 'jira:issueContext',
  'jira:issueGlance', 'jira:issueAction',
]);

const CONFLUENCE_CONTENT_MODULES = new Set([
  'confluence:contentAction', 'confluence:contentBylineItem',
  'confluence:contextMenu', 'macro',
]);

const JIRA_PROJECT_MODULES = new Set([
  'jira:projectPage',
  'jira:projectSettingsPage',
]);

const CONFLUENCE_SPACE_MODULES = new Set([
  'confluence:spaceSettings',
  'confluence:spaceSidebar',
  'confluence:spacePage',
]);

const CONFLUENCE_GLOBAL_MODULES = new Set([
  'confluence:globalSettings',
  'confluence:homepageFeed',
]);

const CUSTOM_FIELD_TYPES = new Set([
  'jira:customField', 'jira:customFieldType',
]);

const MACRO_TYPES = new Set([
  'macro',
]);

/** Provide a sensible default field value based on the field's data type */
function getDefaultFieldValue(fieldType?: string): any {
  switch (fieldType) {
    case 'number': return 42;
    case 'string': return 'Sample value';
    case 'user': return { accountId: 'sim-user-001', displayName: 'Sim User' };
    case 'group': return { groupId: 'sim-group-001', name: 'Sim Group' };
    case 'date': return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    case 'datetime': return new Date().toISOString();
    case 'object': return { key: 'value' };
    default: return 'Sample value';
  }
}

// ── Context Builder ─────────────────────────────────────────────────────

/**
 * Build a full ForgeContext for a given module.
 *
 * Top-level canonical field precedence (lowest → highest):
 *   defaults (from connected account) < sticky resolver context
 *     < options.context's canonical fields (if provided)
 *
 * This mirrors `sim.invoke()`'s resolver-side merge order, so the rendered
 * UI's `useProductContext()` and the resolver invokes it triggers see the
 * same view of the world. Sticky context promotion means a user who did
 * `sim.resolver.setContext({ accountId: 'alice' })` before render sees
 * `useProductContext().accountId === 'alice'` without having to repeat
 * themselves in the render options.
 *
 * Resolution order for extension data:
 *   1. Explicit `extension` override (used as-is)
 *   2. Item key shortcuts (`issueKey`, `contentId`) — hydrated via product API
 *   3. Raw `context` object — non-canonical fields spread into extension,
 *      canonical fields promoted to top level
 *   4. Defaults based on module type
 */
export async function buildForgeContext(
  sim: ForgeSimulator,
  moduleKey: string,
  moduleType: string,
  options: RenderContextOptions = {},
): Promise<ForgeContext> {
  const account = sim.productApi.connectedAccount;
  const sticky = sim.resolver.getContextOverrides();

  // Base context — use real credentials if available
  const base: ForgeContext = {
    accountId: account?.accountId ?? 'sim-user-001',
    cloudId: account?.cloudId ?? 'sim-cloud-001',
    siteUrl: account ? `https://${account.site}` : 'https://sim-site.atlassian.net',
    moduleKey,
    environmentId: 'sim-env',
    environmentType: 'DEVELOPMENT',
    localId: `forge-sim-${Date.now()}`,
    locale: 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    extension: { type: moduleType },
  };

  // Layer sticky resolver context's canonical fields onto the base. The
  // options.context partitioning below will further override these if the
  // caller named the same field explicitly.
  const baseRecord = base as unknown as Record<string, unknown>;
  for (const field of CANONICAL_CONTEXT_FIELDS) {
    if (sticky[field] !== undefined) {
      baseRecord[field] = sticky[field];
    }
  }

  // 1. Explicit extension override → use as-is
  if (options.extension) {
    base.extension = { type: moduleType, ...options.extension };
    return base;
  }

  // 2. Item key shortcuts → hydrate via product API
  if (options.issueKey) {
    base.extension = await hydrateJiraIssueContext(sim, moduleType, options.issueKey);
    return base;
  }

  if (options.contentId) {
    base.extension = await hydrateConfluenceContentContext(sim, moduleType, options.contentId, options.spaceKey);
    return base;
  }

  if (options.projectKey) {
    base.extension = await hydrateJiraProjectContext(sim, moduleType, options.projectKey);
    return base;
  }

  // 2b. Auto-detect context from module type when no explicit options given
  if (!options.context && !options.extension) {
    // Jira project modules get default project context
    if (JIRA_PROJECT_MODULES.has(moduleType)) {
      base.extension = {
        type: moduleType,
        project: { key: 'SIM', id: '10001', type: 'software' },
        projectKey: 'SIM',
        projectId: '10001',
      };
      return base;
    }

    // Confluence space modules get default space context
    if (CONFLUENCE_SPACE_MODULES.has(moduleType)) {
      base.extension = {
        type: moduleType,
        space: { key: options.spaceKey ?? 'SIM', id: '65536' },
        spaceKey: options.spaceKey ?? 'SIM',
      };
      return base;
    }

    // Confluence global modules just need type
    if (CONFLUENCE_GLOBAL_MODULES.has(moduleType)) {
      base.extension = { type: moduleType };
      return base;
    }
  }

  // 3. Raw context → whitelist-promote canonical top-level fields, rest into extension
  if (options.context) {
    const { canonical, extensionFields } = partitionContextOverrides(options.context);

    // Smart mapping: if they pass issueKey in context, treat it like the shortcut.
    // (issueKey lives in extensionFields after partitioning — it's not canonical.)
    if (extensionFields.issueKey && JIRA_ISSUE_MODULES.has(moduleType)) {
      try {
        base.extension = await hydrateJiraIssueContext(sim, moduleType, extensionFields.issueKey as string);
        // Merge extra non-canonical fields from original context, but don't overwrite hydrated values
        for (const [key, value] of Object.entries(extensionFields)) {
          if (!(key in base.extension)) {
            base.extension[key] = value;
          }
        }
        Object.assign(base, canonical);
        return base;
      } catch {
        // Fall through to simple merge if API call fails
      }
    }

    base.extension = { type: moduleType, ...extensionFields };
    Object.assign(base, canonical);
    return base;
  }

  // 4. Custom field defaults — provide mock fieldValue and fieldType
  // (fieldType should be passed via buildDefaultContext's extraExtension in the dev command)
  if (CUSTOM_FIELD_TYPES.has(moduleType)) {
    if (!base.extension.fieldValue) {
      base.extension.fieldValue = getDefaultFieldValue(base.extension.fieldType);
    }
  }

  // 4b. Macro defaults — provide an empty config object so useConfig() resolves
  // (real Forge returns the saved config; dev-server overrides this with stored values)
  if (MACRO_TYPES.has(moduleType)) {
    if (base.extension.config === undefined) {
      base.extension.config = {};
    }
  }

  // 5. Defaults — module type has no item context
  return base;
}

// ── Hydration helpers ───────────────────────────────────────────────────

async function hydrateJiraIssueContext(
  sim: ForgeSimulator,
  moduleType: string,
  issueKey: string,
): Promise<Record<string, any>> {
  const extension: Record<string, any> = { type: moduleType };

  try {
    const response = await sim.productApi.request(
      'jira',
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,issuetype,project`,
      { method: 'GET' },
    );

    if (response.ok) {
      const issue = JSON.parse(await response.text());
      extension.issue = {
        key: issue.key ?? issueKey,
        id: issue.id,
        type: issue.fields?.issuetype?.name,
        typeId: issue.fields?.issuetype?.id,
      };
      extension.project = {
        id: issue.fields?.project?.id,
        key: issue.fields?.project?.key,
        type: issue.fields?.project?.projectTypeKey,
      };
      // Convenience fields (many apps read these directly)
      extension.issueKey = extension.issue.key;
      extension.issueId = extension.issue.id;
      extension.projectKey = extension.project.key;
      extension.projectId = extension.project.id;
    } else {
      // API call failed — use the key as-is with project key extracted
      extension.issueKey = issueKey;
      extension.issue = { key: issueKey };
      const projectKey = issueKey.split('-')[0];
      if (projectKey) {
        extension.projectKey = projectKey;
        extension.project = { key: projectKey };
      }
    }
  } catch {
    // No real API available — use the key as-is with minimal context
    extension.issueKey = issueKey;
    extension.issue = { key: issueKey };
    const projectKey = issueKey.split('-')[0];
    if (projectKey) {
      extension.projectKey = projectKey;
      extension.project = { key: projectKey };
    }
  }

  return extension;
}

async function hydrateConfluenceContentContext(
  sim: ForgeSimulator,
  moduleType: string,
  contentId: string,
  spaceKey?: string,
): Promise<Record<string, any>> {
  const extension: Record<string, any> = { type: moduleType };

  try {
    const response = await sim.productApi.request(
      'confluence',
      `/rest/api/content/${encodeURIComponent(contentId)}?expand=space`,
      { method: 'GET' },
    );

    if (response.ok) {
      const content = JSON.parse(await response.text());
      extension.content = {
        id: content.id ?? contentId,
        type: content.type,
      };
      extension.space = {
        key: content.space?.key ?? spaceKey,
        id: content.space?.id,
      };
      // Convenience fields
      extension.contentId = extension.content.id;
      extension.spaceKey = extension.space.key;
    } else {
      extension.contentId = contentId;
      extension.content = { id: contentId };
      if (spaceKey) {
        extension.spaceKey = spaceKey;
        extension.space = { key: spaceKey };
      }
    }
  } catch {
    extension.contentId = contentId;
    extension.content = { id: contentId };
    if (spaceKey) {
      extension.spaceKey = spaceKey;
      extension.space = { key: spaceKey };
    }
  }

  return extension;
}

async function hydrateJiraProjectContext(
  sim: ForgeSimulator,
  moduleType: string,
  projectKey: string,
): Promise<Record<string, any>> {
  const extension: Record<string, any> = { type: moduleType };

  try {
    const response = await sim.productApi.request(
      'jira',
      `/rest/api/3/project/${encodeURIComponent(projectKey)}`,
      { method: 'GET' },
    );

    if (response.ok) {
      const project = JSON.parse(await response.text());
      extension.project = {
        id: project.id,
        key: project.key ?? projectKey,
        type: project.projectTypeKey,
      };
      extension.projectKey = extension.project.key;
      extension.projectId = extension.project.id;
    } else {
      extension.project = { key: projectKey };
      extension.projectKey = projectKey;
    }
  } catch {
    extension.project = { key: projectKey };
    extension.projectKey = projectKey;
  }

  return extension;
}

/**
 * Build a minimal context from whatever we have.
 * Used when no render options are provided — returns defaults.
 */
export function buildDefaultContext(
  moduleKey: string,
  moduleType?: string,
  account?: { accountId: string; cloudId: string; site: string } | null,
  extraExtension?: Record<string, any>,
): ForgeContext {
  const extension: Record<string, any> = moduleType ? { type: moduleType } : {};

  // Enrich custom field modules with mock fieldValue
  if (moduleType && CUSTOM_FIELD_TYPES.has(moduleType)) {
    const fieldType = extraExtension?.fieldType || 'string';
    extension.fieldValue = getDefaultFieldValue(fieldType);
    extension.fieldType = fieldType;
  }

  // Enrich macro modules with an empty config so useConfig() resolves
  // The dev-server overrides this with any stored config when serving getContext.
  if (moduleType && MACRO_TYPES.has(moduleType)) {
    extension.config = {};
  }

  if (extraExtension) {
    Object.assign(extension, extraExtension);
  }

  return {
    accountId: account?.accountId ?? 'sim-user-001',
    cloudId: account?.cloudId ?? 'sim-cloud-001',
    siteUrl: account ? `https://${account.site}` : 'https://sim-site.atlassian.net',
    moduleKey,
    environmentId: 'sim-env',
    environmentType: 'DEVELOPMENT',
    localId: `forge-sim-${Date.now()}`,
    locale: 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    extension,
  };
}
