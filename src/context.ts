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

export interface RenderContextOptions {
  /** Raw context fields — merged into extension */
  context?: Record<string, unknown>;
  /** Jira issue key — fetches issue data to build context */
  issueKey?: string;
  /** Confluence content ID — fetches content data to build context */
  contentId?: string;
  /** Confluence space key — fetches space data to build context */
  spaceKey?: string;
  /** Override the full extension object */
  extension?: Record<string, any>;
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
]);

// ── Context Builder ─────────────────────────────────────────────────────

/**
 * Build a full ForgeContext for a given module.
 *
 * Resolution order for extension data:
 *   1. Explicit `extension` override (used as-is)
 *   2. Item key shortcuts (`issueKey`, `contentId`) — hydrated via product API
 *   3. Raw `context` object — spread into extension
 *   4. Defaults based on module type
 */
export async function buildForgeContext(
  sim: ForgeSimulator,
  moduleKey: string,
  moduleType: string,
  options: RenderContextOptions = {},
): Promise<ForgeContext> {
  const account = sim.productApi.connectedAccount;

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

  // 3. Raw context → spread into extension
  if (options.context) {
    // Smart mapping: if they pass issueKey in context, treat it like the shortcut
    if (options.context.issueKey && JIRA_ISSUE_MODULES.has(moduleType)) {
      try {
        base.extension = await hydrateJiraIssueContext(sim, moduleType, options.context.issueKey as string);
        // Merge extra fields from original context, but don't overwrite hydrated values
        for (const [key, value] of Object.entries(options.context)) {
          if (!(key in base.extension)) {
            base.extension[key] = value;
          }
        }
        return base;
      } catch {
        // Fall through to simple merge if API call fails
      }
    }

    base.extension = { type: moduleType, ...options.context };
    return base;
  }

  // 4. Defaults — module type has no item context
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

/**
 * Build a minimal context from whatever we have.
 * Used when no render options are provided — returns defaults.
 */
export function buildDefaultContext(
  moduleKey: string,
  moduleType?: string,
  account?: { accountId: string; cloudId: string; site: string } | null,
): ForgeContext {
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
    extension: moduleType ? { type: moduleType } : {},
  };
}
