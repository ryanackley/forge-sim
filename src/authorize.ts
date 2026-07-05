/**
 * authorize() permission builders — API-029/030, RT-044.
 *
 * Mirrors the real implementation chain verbatim:
 *   @forge/api/out/authorization/index.js  →  @forge/auth/out/{jira,confluence}
 *
 * Real surface:
 *   authorize().onJira(projectPermissionsInput)      → Promise<ProjectPermissionResponse[]>
 *   authorize().onJiraProject(projects)              → { canAssignIssues(), canCreateIssues(), ... }
 *   authorize().onJiraIssue(issues)                  → { canAssign(), canCreate(), canEdit(), ... }
 *   authorize().onConfluenceContent(contentId)       → { canRead(), canUpdate(), canDelete() }
 *
 * Wire calls (all as the invoking user):
 *   Jira:       POST /rest/api/3/permissions/check
 *               body { accountId, projectPermissions: [{ permissions: [PERM], issues|projects }] }
 *   Confluence: POST /rest/api/content/{contentId}/permission/check
 *               body { subject: { type: 'user', identifier: accountId }, operation }
 *
 * Sim semantics (surface-before-behavior posture, same as hasScope()):
 *   - If the sim can answer (mock route matched, or real API connected) →
 *     apply the EXACT real-client response logic (ported byte-for-byte below).
 *     App authors can mock the permission endpoints to test denial paths.
 *   - If the sim cannot answer (unmocked 501, or mockRoutes' 404
 *     "No mock route matched" fallback) → permissive: checks return true,
 *     onJira() grants everything requested.
 */

// ── Permission maps (verbatim from @forge/auth/out/{jira,confluence}/permissions.js) ──

export const API_ISSUES_PERMISSIONS_MAP: Record<string, string> = {
  canAssign: 'ASSIGN_ISSUES',
  canCreate: 'CREATE_ISSUES',
  canEdit: 'EDIT_ISSUES',
  canMove: 'MOVE_ISSUES',
  canDelete: 'DELETE_ISSUES',
  canAddComments: 'ADD_COMMENTS',
  canEditAllComments: 'EDIT_ALL_COMMENTS',
  canDeleteAllComments: 'DELETE_ALL_COMMENTS',
  canCreateAttachments: 'CREATE_ATTACHMENTS',
  canDeleteAllAttachments: 'DELETE_ALL_ATTACHMENTS',
};

export const API_PROJECTS_PERMISSIONS_MAP: Record<string, string> = {
  canAssignIssues: 'ASSIGN_ISSUES',
  canCreateIssues: 'CREATE_ISSUES',
  canEditIssues: 'EDIT_ISSUES',
  canMoveIssues: 'MOVE_ISSUES',
  canDeleteIssues: 'DELETE_ISSUES',
  canAddComments: 'ADD_COMMENTS',
  canEditAllComments: 'EDIT_ALL_COMMENTS',
  canDeleteAllComments: 'DELETE_ALL_COMMENTS',
  canCreateAttachments: 'CREATE_ATTACHMENTS',
  canDeleteAllAttachments: 'DELETE_ALL_ATTACHMENTS',
};

export const CONFLUENCE_CONTENT_PERMISSIONS_MAP: Record<string, string> = {
  canRead: 'read',
  canUpdate: 'update',
  canDelete: 'delete',
};

// ── Types ───────────────────────────────────────────────────────────────

export type Id = string | number;

export interface ProjectPermission {
  permissions: string[];
  issues?: number[];
  projects?: number[];
}

export interface ProjectPermissionResponse {
  permission: string;
  issues?: number[];
  projects?: number[];
}

export type PermissionCheck = (args?: any) => Promise<boolean | object>;

/**
 * Fetch contract for the builders. Unlike the real withFetch functions
 * (which receive a fetch that returns pre-parsed JSON), the sim's contract
 * carries the status code too — that's how we distinguish "the sim answered"
 * from "unmocked, be permissive".
 */
export type AuthorizeFetch = (
  path: string,
  opts: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ status: number; json: any }>;

// ── Helpers (ported verbatim from @forge/auth) ──────────────────────────

/** @forge/auth/out/api.js createApiMethods — method name → factory(permission) */
export function createApiMethods(
  methodToPermissionMap: Record<string, string>,
  permissionCheckFactory: (permission: string) => PermissionCheck
): Record<string, PermissionCheck> {
  return Object.fromEntries(
    Object.entries(methodToPermissionMap).map(([methodName, permission]) => [
      methodName,
      permissionCheckFactory(permission),
    ])
  );
}

/** @forge/auth/out/jira/index.js arrayEquals — order-insensitive, string-coerced */
const arrayEquals = (a: any[], b: any[]): boolean => {
  return (
    JSON.stringify(Array.from(a.map(String)).sort()) ===
    JSON.stringify(Array.from(b.map(String)).sort())
  );
};

/**
 * @forge/auth/out/jira/index.js hasPermissionsForEntities — exact port.
 * NOTE: real code calls `.find()` on projectPermissions unguarded; if a
 * mocked response omits `projectPermissions` this throws a TypeError, same
 * as the real client would on a malformed API response. Parity kept.
 */
const hasPermissionsForEntities = (
  projectPermissions: ProjectPermissionResponse[],
  permission: string,
  type: 'issues' | 'projects',
  entities: Id[]
): boolean => {
  if (!entities || entities.length === 0) return true;
  const allowedEntities = projectPermissions.find(
    (permissionResponse) => permissionResponse.permission === permission
  )?.[type];
  return !!allowedEntities && arrayEquals(allowedEntities, entities);
};

const toArray = (id: Id | Id[]): Id[] => (Array.isArray(id) ? id : [id]);

/**
 * "The sim couldn't answer this request" — either the product API is fully
 * unmocked (501) or mockRoutes is registered but no route matched (its 404
 * fallback body). Both mean: no one told the sim what permissions look like,
 * so default permissive (same posture as hasScope() → true).
 */
function isUnanswered(status: number, json: any): boolean {
  if (status === 501) return true;
  return (
    status === 404 &&
    typeof json?.error === 'string' &&
    json.error.startsWith('No mock route matched')
  );
}

/** Permissive expansion of an onJira() input: grant everything requested. */
function grantAllRequested(input: ProjectPermission[]): ProjectPermissionResponse[] {
  return input.flatMap((entry) =>
    (entry.permissions ?? []).map((permission) => ({
      permission,
      ...(entry.issues !== undefined ? { issues: entry.issues } : {}),
      ...(entry.projects !== undefined ? { projects: entry.projects } : {}),
    }))
  );
}

// ── Jira builders (mirrors authorizeJiraWithFetch) ──────────────────────

export function authorizeJiraWithFetch(requestJira: AuthorizeFetch, accountId: string) {
  const checkJiraPermissions = (projectPermissions: ProjectPermission[]) =>
    requestJira('/rest/api/3/permissions/check', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId, projectPermissions }),
    });

  const getPermissionCheckFactory =
    (type: 'issues' | 'projects', entities: Id[]) =>
    (permission: string): PermissionCheck =>
    async () => {
      const { status, json } = await checkJiraPermissions([
        { permissions: [permission], [type]: entities } as ProjectPermission,
      ]);
      if (isUnanswered(status, json)) return true; // permissive default
      const { projectPermissions } = json ?? {};
      return hasPermissionsForEntities(projectPermissions, permission, type, entities);
    };

  return {
    onJira: async (projectPermissionsInput: ProjectPermission[]): Promise<ProjectPermissionResponse[]> => {
      const { status, json } = await checkJiraPermissions(projectPermissionsInput);
      if (isUnanswered(status, json)) return grantAllRequested(projectPermissionsInput);
      return json?.projectPermissions || [];
    },
    onJiraProject: (projects: Id | Id[]) =>
      createApiMethods(
        API_PROJECTS_PERMISSIONS_MAP,
        getPermissionCheckFactory('projects', toArray(projects))
      ),
    onJiraIssue: (issues: Id | Id[]) =>
      createApiMethods(
        API_ISSUES_PERMISSIONS_MAP,
        getPermissionCheckFactory('issues', toArray(issues))
      ),
  };
}

// ── Confluence builders (mirrors authorizeConfluenceWithFetch) ──────────

export function authorizeConfluenceWithFetch(requestConfluence: AuthorizeFetch, accountId: string) {
  return {
    onConfluenceContent: (contentId: Id) =>
      createApiMethods(CONFLUENCE_CONTENT_PERMISSIONS_MAP, (permission) => async () => {
        const { status, json } = await requestConfluence(
          `/rest/api/content/${contentId}/permission/check`,
          {
            method: 'post',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              subject: { type: 'user', identifier: accountId },
              operation: permission,
            }),
          }
        );
        if (isUnanswered(status, json)) return true; // permissive default
        return Boolean(json?.hasPermission);
      }),
  };
}

/**
 * The exact error real authorize() throws when there's no invoking user
 * (non-user-invoked modules: scheduled triggers, queue consumers, etc.).
 * NOTE the Unicode right single quote (’) — byte-for-byte match with
 * @forge/api/out/authorization/index.js.
 */
export const AUTHORIZE_NO_ACCOUNT_ERROR =
  'Couldn’t find the accountId of the invoking user. This API can only be used inside user-invoked modules.';

/**
 * Build the full authorize() return object — spread order matches real
 * @forge/api (confluence first, then jira).
 */
export function buildAuthorizeApi(
  accountId: string,
  requestJira: AuthorizeFetch,
  requestConfluence: AuthorizeFetch
) {
  return {
    ...authorizeConfluenceWithFetch(requestConfluence, accountId),
    ...authorizeJiraWithFetch(requestJira, accountId),
  };
}
