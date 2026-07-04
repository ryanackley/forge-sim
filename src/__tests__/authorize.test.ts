/**
 * authorize() permission builders — API-029/030, RT-044.
 *
 * Real surface (verified verbatim against @forge/api/out/authorization/index.js
 * and @forge/auth/out/{jira,confluence}):
 *
 *   authorize().onJira(input)                 → Promise<ProjectPermissionResponse[]>
 *   authorize().onJiraProject(projects)       → { canAssignIssues(), ... } (10 methods)
 *   authorize().onJiraIssue(issues)           → { canAssign(), canEdit(), ... } (10 methods)
 *   authorize().onConfluenceContent(id)       → { canRead(), canUpdate(), canDelete() }
 *
 * Sim semantics:
 *   - mocked permission endpoint → EXACT real-client response logic
 *   - unmocked → permissive true (same posture as hasScope())
 *   - no invoking user (accountId missing) → the real error, byte-for-byte
 *
 * Includes drift-detector tests that compare our permission maps and error
 * message against the SHIPPED @forge/auth + @forge/api packages, so this
 * surface can never silently diverge.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { authorize } from '../shims/forge-api.js';
import Resolver from '../shims/forge-resolver.js';
import {
  API_ISSUES_PERMISSIONS_MAP,
  API_PROJECTS_PERMISSIONS_MAP,
  CONFLUENCE_CONTENT_PERMISSIONS_MAP,
  AUTHORIZE_NO_ACCOUNT_ERROR,
} from '../authorize.js';

const require = createRequire(import.meta.url);

describe('authorize() builders', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  // ── Surface shape ─────────────────────────────────────────────────────

  describe('surface shape', () => {
    it('returns the four builder entry points', () => {
      const auth = authorize();
      expect(typeof auth.onJira).toBe('function');
      expect(typeof auth.onJiraProject).toBe('function');
      expect(typeof auth.onJiraIssue).toBe('function');
      expect(typeof auth.onConfluenceContent).toBe('function');
    });

    it('onJiraIssue exposes exactly the 10 real method names', () => {
      const checks = authorize().onJiraIssue(10001);
      expect(Object.keys(checks).sort()).toEqual([
        'canAddComments',
        'canAssign',
        'canCreate',
        'canCreateAttachments',
        'canDelete',
        'canDeleteAllAttachments',
        'canDeleteAllComments',
        'canEdit',
        'canEditAllComments',
        'canMove',
      ]);
      for (const fn of Object.values(checks)) expect(typeof fn).toBe('function');
    });

    it('onJiraProject exposes exactly the 10 real method names', () => {
      const checks = authorize().onJiraProject(10000);
      expect(Object.keys(checks).sort()).toEqual([
        'canAddComments',
        'canAssignIssues',
        'canCreateAttachments',
        'canCreateIssues',
        'canDeleteAllAttachments',
        'canDeleteAllComments',
        'canDeleteIssues',
        'canEditAllComments',
        'canEditIssues',
        'canMoveIssues',
      ]);
    });

    it('onConfluenceContent exposes canRead/canUpdate/canDelete', () => {
      const checks = authorize().onConfluenceContent('12345');
      expect(Object.keys(checks).sort()).toEqual(['canDelete', 'canRead', 'canUpdate']);
    });
  });

  // ── Drift detectors vs the shipped packages ──────────────────────────

  describe('drift detection vs real @forge/auth + @forge/api', () => {
    it('issue permission map matches the shipped @forge/auth byte-for-byte', () => {
      const real = require('@forge/auth/out/jira/permissions.js');
      expect(API_ISSUES_PERMISSIONS_MAP).toEqual(real.API_ISSUES_PERMISSIONS_MAP);
    });

    it('project permission map matches the shipped @forge/auth byte-for-byte', () => {
      const real = require('@forge/auth/out/jira/permissions.js');
      expect(API_PROJECTS_PERMISSIONS_MAP).toEqual(real.API_PROJECTS_PERMISSIONS_MAP);
    });

    it('confluence permission map matches the shipped @forge/auth byte-for-byte', () => {
      const real = require('@forge/auth/out/confluence/permissions.js');
      expect(CONFLUENCE_CONTENT_PERMISSIONS_MAP).toEqual(real.default);
    });

    it('no-account error message matches what real authorize() throws, byte-for-byte', () => {
      // Force the REAL @forge/api authorize() down its throw path by
      // temporarily replacing the runtime global with one that has no aaid.
      const realApi = require('@forge/api');
      const saved = (global as any).__forge_runtime__;
      (global as any).__forge_runtime__ = {};
      try {
        let realMessage: string | undefined;
        try {
          realApi.authorize();
        } catch (err: any) {
          realMessage = err.message;
        }
        expect(realMessage).toBeDefined();
        expect(AUTHORIZE_NO_ACCOUNT_ERROR).toBe(realMessage);
      } finally {
        (global as any).__forge_runtime__ = saved;
      }
    });
  });

  // ── No invoking user → throw ──────────────────────────────────────────

  describe('no invoking user', () => {
    it('throws the exact real error synchronously when accountId is missing', () => {
      sim.resolver.setContext({ accountId: undefined });
      expect(() => authorize()).toThrow(AUTHORIZE_NO_ACCOUNT_ERROR);
    });
  });

  // ── Unmocked → permissive (hasScope posture) ──────────────────────────

  describe('unmocked → permissive default', () => {
    it('issue checks resolve true when the permission endpoint is unmocked', async () => {
      await expect(authorize().onJiraIssue(10001).canEdit()).resolves.toBe(true);
      await expect(authorize().onJiraIssue([1, 2]).canDelete()).resolves.toBe(true);
    });

    it('project checks resolve true when unmocked', async () => {
      await expect(authorize().onJiraProject(10000).canCreateIssues()).resolves.toBe(true);
    });

    it('confluence checks resolve true when unmocked', async () => {
      await expect(authorize().onConfluenceContent('999').canRead()).resolves.toBe(true);
    });

    it('onJira() grants everything requested when unmocked', async () => {
      const result = await authorize().onJira([
        { permissions: ['EDIT_ISSUES', 'ASSIGN_ISSUES'], issues: [1, 2] },
        { permissions: ['CREATE_ISSUES'], projects: [10000] },
      ]);
      expect(result).toEqual([
        { permission: 'EDIT_ISSUES', issues: [1, 2] },
        { permission: 'ASSIGN_ISSUES', issues: [1, 2] },
        { permission: 'CREATE_ISSUES', projects: [10000] },
      ]);
    });

    it('stays permissive when other jira routes are mocked but not permissions/check', async () => {
      // mockRoutes' fallback is a 404 "No mock route matched" — that still
      // means "the sim has no answer for permissions", so stay permissive.
      sim.mockProductRoutes('jira', { 'GET /rest/api/3/myself': { accountId: 'x' } });
      await expect(authorize().onJiraIssue(10001).canEdit()).resolves.toBe(true);
    });
  });

  // ── Mocked → exact real-client semantics ──────────────────────────────

  describe('mocked Jira permission endpoint', () => {
    let capturedBodies: any[];

    beforeEach(() => {
      capturedBodies = [];
      sim.mockProductRoutes('jira', {
        'POST /rest/api/3/permissions/check': (_path: string, options: any) => {
          capturedBodies.push(JSON.parse(options.body));
          return {
            projectPermissions: [{ permission: 'EDIT_ISSUES', issues: [10001] }],
          };
        },
      });
    });

    it('grants when the response covers exactly the requested entities', async () => {
      await expect(authorize().onJiraIssue(10001).canEdit()).resolves.toBe(true);
    });

    it('denies when the response covers only a subset of requested entities', async () => {
      await expect(authorize().onJiraIssue([10001, 10002]).canEdit()).resolves.toBe(false);
    });

    it('denies when the permission has no response entry', async () => {
      await expect(authorize().onJiraIssue(10001).canDelete()).resolves.toBe(false);
    });

    it('sends the real wire body: accountId + [{permissions: [PERM], issues}]', async () => {
      await authorize().onJiraIssue(10001).canEdit();
      expect(capturedBodies[0]).toEqual({
        accountId: 'sim-user-001',
        projectPermissions: [{ permissions: ['EDIT_ISSUES'], issues: [10001] }],
      });
    });

    it('project checks send `projects` as the entity type', async () => {
      await authorize().onJiraProject([10000]).canCreateIssues();
      expect(capturedBodies[0]).toEqual({
        accountId: 'sim-user-001',
        projectPermissions: [{ permissions: ['CREATE_ISSUES'], projects: [10000] }],
      });
    });

    it('entity comparison is order-insensitive and string-coerced (real arrayEquals)', async () => {
      sim.mockProductRoutes('jira', {
        'POST /rest/api/3/permissions/check': {
          projectPermissions: [{ permission: 'EDIT_ISSUES', issues: ['10002', '10001'] }],
        },
      });
      await expect(authorize().onJiraIssue([10001, 10002]).canEdit()).resolves.toBe(true);
    });

    it('onJira() returns the mocked projectPermissions array as-is', async () => {
      const result = await authorize().onJira([{ permissions: ['EDIT_ISSUES'], issues: [10001] }]);
      expect(result).toEqual([{ permission: 'EDIT_ISSUES', issues: [10001] }]);
    });

    it('onJira() returns [] when a mocked body has no projectPermissions (real `|| []`)', async () => {
      sim.mockProductRoutes('jira', { 'POST /rest/api/3/permissions/check': {} });
      const result = await authorize().onJira([{ permissions: ['EDIT_ISSUES'], issues: [1] }]);
      expect(result).toEqual([]);
    });
  });

  describe('mocked Confluence permission endpoint', () => {
    it('returns the mocked hasPermission boolean and sends the real wire body', async () => {
      const captured: any[] = [];
      sim.mockProductRoutes('confluence', {
        'POST /rest/api/content/999/permission/check': (_path: string, options: any) => {
          captured.push(JSON.parse(options.body));
          return { hasPermission: false };
        },
      });

      await expect(authorize().onConfluenceContent('999').canRead()).resolves.toBe(false);
      expect(captured[0]).toEqual({
        subject: { type: 'user', identifier: 'sim-user-001' },
        operation: 'read',
      });
    });

    it('canUpdate/canDelete map to update/delete operations', async () => {
      const operations: string[] = [];
      sim.mockProductRoutes('confluence', {
        'POST /rest/api/content/42/permission/check': (_path: string, options: any) => {
          operations.push(JSON.parse(options.body).operation);
          return { hasPermission: true };
        },
      });

      await expect(authorize().onConfluenceContent(42).canUpdate()).resolves.toBe(true);
      await expect(authorize().onConfluenceContent(42).canDelete()).resolves.toBe(true);
      expect(operations).toEqual(['update', 'delete']);
    });
  });

  // ── Invoking-user resolution ──────────────────────────────────────────

  describe('invoking user resolution', () => {
    it('uses the sticky context accountId outside an invocation', async () => {
      const captured: any[] = [];
      sim.mockProductRoutes('jira', {
        'POST /rest/api/3/permissions/check': (_path: string, options: any) => {
          captured.push(JSON.parse(options.body));
          return { projectPermissions: [] };
        },
      });
      sim.resolver.setContext({ accountId: 'bob' });

      await authorize().onJiraIssue(1).canEdit();
      expect(captured[0].accountId).toBe('bob');
    });

    it('uses the per-call override accountId inside a resolver invocation', async () => {
      const captured: any[] = [];
      sim.mockProductRoutes('jira', {
        'POST /rest/api/3/permissions/check': (_path: string, options: any) => {
          captured.push(JSON.parse(options.body));
          return { projectPermissions: [] };
        },
      });

      const resolver = new Resolver();
      resolver.define('checkPerms', async () => {
        return authorize().onJiraIssue(10001).canEdit();
      });

      await sim.invoke('checkPerms', {}, { context: { accountId: 'alice' } });
      expect(captured[0].accountId).toBe('alice');
    });
  });
});
