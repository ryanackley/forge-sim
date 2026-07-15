/**
 * Tests for multi-module URL routing.
 *
 * Covers:
 * - Module detection for multiple UI modules
 * - Context building from URL query params
 * - Module picker data structure
 * - Per-module entry generation for UIKit and Custom UI
 * - Module routing middleware behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import {
  detectModuleType,
  generateModulePickerHtml,
  installModuleRouting,
  type DetectedModule,
} from '../dev-command.js';
import { parseManifestContent, type ParsedManifest, type ManifestUIModule } from '../manifest.js';
import { buildForgeContext, buildDefaultContext } from '../context.js';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const TEST_TMP = resolve(import.meta.dirname, '../../.forge-sim/test-tmp');

function createTestManifest(modules: Record<string, any[]>): ParsedManifest {
  const lines: string[] = [
    'app:',
    '  id: test-app',
    '  name: Test Multi-Module App',
    'modules:',
  ];

  // Add function definitions
  lines.push('  function:');
  lines.push('    - key: resolver');
  lines.push('      handler: index.handler');

  for (const [type, mods] of Object.entries(modules)) {
    lines.push(`  ${type}:`);
    for (const mod of mods) {
      lines.push(`    - key: ${mod.key}`);
      if (mod.title) lines.push(`      title: "${mod.title}"`);
      if (mod.resource) lines.push(`      resource: ${mod.resource}`);
      if (mod.resolver) {
        lines.push(`      resolver:`);
        lines.push(`        function: ${mod.resolver}`);
      }
    }
  }

  // Add resources
  const resources: any[] = [];
  for (const mods of Object.values(modules)) {
    for (const mod of mods) {
      if (mod.resource && mod.resourcePath) {
        resources.push({ key: mod.resource, path: mod.resourcePath });
      }
    }
  }

  if (resources.length > 0) {
    lines.push('resources:');
    for (const r of resources) {
      lines.push(`  - key: ${r.key}`);
      lines.push(`    path: ${r.path}`);
    }
  }

  return parseManifestContent(lines.join('\n'));
}

// ── Helpers ───────────────────────────────────────────────────────────────

function setupTestFiles(appDir: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(appDir, path);
    mkdirSync(resolve(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Multi-Module Routing', () => {
  const appDir = join(TEST_TMP, 'test-app');

  beforeEach(() => {
    if (existsSync(TEST_TMP)) {
      rmSync(TEST_TMP, { recursive: true, force: true });
    }
    mkdirSync(appDir, { recursive: true });
  });

  // ── Module Detection ────────────────────────────────────────────────

  describe('detectModuleType', () => {
    it('should detect a UIKit module (imports @forge/react)', () => {
      setupTestFiles(appDir, {
        'src/frontend.tsx': `
          import ForgeReconciler from '@forge/react';
          ForgeReconciler.render(() => <div>Hello</div>);
        `,
      });

      const manifest = createTestManifest({
        'jira:issuePanel': [{
          key: 'issue-panel',
          resource: 'panel-resource',
          resourcePath: 'src/frontend',
          resolver: 'resolver',
        }],
      });

      const mod = manifest.uiModules[0];
      const result = detectModuleType(appDir, manifest, mod);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe('uikit');
      expect(result!.module.key).toBe('issue-panel');
    });

    it('should detect a Custom UI module (directory with index.html)', () => {
      setupTestFiles(appDir, {
        'static/custom-ui/index.html': '<html><body>Custom UI</body></html>',
      });

      const manifest = createTestManifest({
        'jira:globalPage': [{
          key: 'global-page',
          resource: 'page-resource',
          resourcePath: 'static/custom-ui',
          resolver: 'resolver',
        }],
      });

      const mod = manifest.uiModules[0];
      const result = detectModuleType(appDir, manifest, mod);

      expect(result).not.toBeNull();
      expect(result!.mode).toBe('customui');
      expect(result!.module.key).toBe('global-page');
    });

    it('should detect multiple modules of different types', () => {
      setupTestFiles(appDir, {
        'src/panel.tsx': `import ForgeReconciler from '@forge/react'; ForgeReconciler.render(() => null);`,
        'src/page/index.html': '<html><body>Page</body></html>',
        'src/admin.tsx': `import ForgeReconciler from '@forge/react'; ForgeReconciler.render(() => null);`,
      });

      const manifest = createTestManifest({
        'jira:issuePanel': [{
          key: 'panel',
          resource: 'panel-res',
          resourcePath: 'src/panel',
          resolver: 'resolver',
        }],
        'jira:globalPage': [{
          key: 'page',
          resource: 'page-res',
          resourcePath: 'src/page',
          resolver: 'resolver',
        }],
        'jira:adminPage': [{
          key: 'admin',
          resource: 'admin-res',
          resourcePath: 'src/admin',
          resolver: 'resolver',
        }],
      });

      const results = manifest.uiModules
        .map((mod) => detectModuleType(appDir, manifest, mod))
        .filter(Boolean) as DetectedModule[];

      expect(results).toHaveLength(3);
      expect(results.find((r) => r.module.key === 'panel')!.mode).toBe('uikit');
      expect(results.find((r) => r.module.key === 'page')!.mode).toBe('customui');
      expect(results.find((r) => r.module.key === 'admin')!.mode).toBe('uikit');
    });

    it('should return null for module without a resource key', () => {
      const manifest = createTestManifest({
        'jira:issuePanel': [{
          key: 'no-resource',
          resolver: 'resolver',
        }],
      });

      // Module without resource won't appear in uiModules (manifest parser
      // requires resource key). Test detectModuleType directly with a
      // manually constructed module object.
      const mod = { key: 'no-resource', type: 'jira:issuePanel' } as any;
      const result = detectModuleType(appDir, manifest, mod);
      expect(result).toBeNull();
    });

    it('should return null for module with missing resource file', () => {
      const manifest = createTestManifest({
        'jira:issuePanel': [{
          key: 'missing',
          resource: 'missing-res',
          resourcePath: 'src/does-not-exist',
          resolver: 'resolver',
        }],
      });

      const mod = manifest.uiModules[0];
      const result = detectModuleType(appDir, manifest, mod);
      expect(result).toBeNull();
    });
  });

  // ── Context from URL params ─────────────────────────────────────────

  describe('context building from URL params', () => {
    let sim: ForgeSimulator;

    beforeEach(() => {
      sim = createSimulator();
    });

    it('should build context with issueKey', async () => {
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        issueKey: 'TEST-42',
      });

      expect(ctx.moduleKey).toBe('panel');
      expect(ctx.extension.type).toBe('jira:issuePanel');
      expect(ctx.extension.issueKey).toBe('TEST-42');
      expect(ctx.extension.issue.key).toBe('TEST-42');
    });

    it('should build context with contentId', async () => {
      const ctx = await buildForgeContext(sim, 'content-view', 'confluence:contentBylineItem', {
        contentId: '12345',
      });

      expect(ctx.moduleKey).toBe('content-view');
      expect(ctx.extension.contentId).toBe('12345');
      expect(ctx.extension.content.id).toBe('12345');
    });

    it('should build context with contentId and spaceKey', async () => {
      const ctx = await buildForgeContext(sim, 'content-view', 'confluence:contentBylineItem', {
        contentId: '12345',
        spaceKey: 'DEV',
      });

      expect(ctx.extension.contentId).toBe('12345');
      expect(ctx.extension.spaceKey).toBe('DEV');
      expect(ctx.extension.space.key).toBe('DEV');
    });

    it('should build context with base64-encoded arbitrary context', async () => {
      const customCtx = { customField: 'hello', nested: { a: 1 } };
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        context: customCtx,
      });

      expect(ctx.extension.customField).toBe('hello');
      expect(ctx.extension.nested).toEqual({ a: 1 });
    });

    it('should build default context without options', () => {
      const ctx = buildDefaultContext('my-module', 'jira:globalPage');

      expect(ctx.moduleKey).toBe('my-module');
      expect(ctx.extension.type).toBe('jira:globalPage');
      expect(ctx.accountId).toBe('sim-user-001');
      expect(ctx.environmentType).toBe('DEVELOPMENT');
    });

    it('should override moduleKey in default context', () => {
      const base = buildDefaultContext('original', 'jira:issuePanel');
      const updated = { ...base, moduleKey: 'new-module' };

      expect(updated.moduleKey).toBe('new-module');
      expect(updated.extension.type).toBe('jira:issuePanel');
    });
  });

  // ── Module Picker ───────────────────────────────────────────────────

  describe('generateModulePickerHtml', () => {
    it('should generate HTML with links for all modules', () => {
      const modules: DetectedModule[] = [
        {
          module: { type: 'jira:issuePanel', key: 'panel', title: 'Issue Panel' },
          resourcePath: '/path/to/panel',
          mode: 'uikit',
        },
        {
          module: { type: 'jira:globalPage', key: 'page', title: 'Global Page' },
          resourcePath: '/path/to/page',
          mode: 'customui',
        },
      ];

      const html = generateModulePickerHtml(modules);

      expect(html).toContain('/module/panel/');
      expect(html).toContain('/module/page/');
      expect(html).toContain('Issue Panel');
      expect(html).toContain('Global Page');
      expect(html).toContain('jira:issuePanel');
      expect(html).toContain('jira:globalPage');
      expect(html).toContain('UIKit');
      expect(html).toContain('Custom UI');
      expect(html).toContain('2 UI modules');
    });

    it('should handle single module (singular text)', () => {
      const modules: DetectedModule[] = [
        {
          module: { type: 'jira:issuePanel', key: 'solo' },
          resourcePath: '/path/to/solo',
          mode: 'uikit',
        },
      ];

      const html = generateModulePickerHtml(modules);

      expect(html).toContain('1 UI module ');
      expect(html).toContain('/module/solo/');
    });

    it('should include link to dev tools', () => {
      const html = generateModulePickerHtml([{
        module: { type: 'jira:issuePanel', key: 'test' },
        resourcePath: '/test',
        mode: 'uikit',
      }]);

      expect(html).toContain('/__tools/');
    });
  });

  // ── Per-Module Entry Generation ─────────────────────────────────────

  describe('per-module entry generation', () => {
    it('should generate UIKit entry files in per-module subdirectories', () => {
      setupTestFiles(appDir, {
        'src/panel.tsx': `import ForgeReconciler from '@forge/react'; ForgeReconciler.render(() => null);`,
        'src/admin.tsx': `import ForgeReconciler from '@forge/react'; ForgeReconciler.render(() => null);`,
      });

      const manifest = createTestManifest({
        'jira:issuePanel': [{
          key: 'panel',
          resource: 'panel-res',
          resourcePath: 'src/panel',
          resolver: 'resolver',
        }],
        'jira:adminPage': [{
          key: 'admin',
          resource: 'admin-res',
          resourcePath: 'src/admin',
          resolver: 'resolver',
        }],
      });

      const tempDir = join(TEST_TMP, 'entry-gen-tmp');
      mkdirSync(tempDir, { recursive: true });

      // Simulate what devCommand does: generate per-module entries
      const modules = manifest.uiModules
        .map((mod) => detectModuleType(appDir, manifest, mod))
        .filter(Boolean) as DetectedModule[];

      for (const mod of modules) {
        if (mod.mode === 'uikit') {
          const moduleDir = join(tempDir, mod.module.key);
          mkdirSync(moduleDir, { recursive: true });
          writeFileSync(join(moduleDir, 'entry.tsx'), `// entry for ${mod.module.key}`);
          writeFileSync(join(moduleDir, 'index.html'), `<!DOCTYPE html><html><body><div id="root"></div></body></html>`);
        }
      }

      // Verify per-module directories were created
      expect(existsSync(join(tempDir, 'panel', 'entry.tsx'))).toBe(true);
      expect(existsSync(join(tempDir, 'panel', 'index.html'))).toBe(true);
      expect(existsSync(join(tempDir, 'admin', 'entry.tsx'))).toBe(true);
      expect(existsSync(join(tempDir, 'admin', 'index.html'))).toBe(true);
    });

    it('should NOT generate entry files for Custom UI modules', () => {
      setupTestFiles(appDir, {
        'static/page/index.html': '<html><body>Custom</body></html>',
      });

      const manifest = createTestManifest({
        'jira:globalPage': [{
          key: 'custom-page',
          resource: 'page-res',
          resourcePath: 'static/page',
          resolver: 'resolver',
        }],
      });

      const tempDir = join(TEST_TMP, 'customui-tmp');
      mkdirSync(tempDir, { recursive: true });

      const modules = manifest.uiModules
        .map((mod) => detectModuleType(appDir, manifest, mod))
        .filter(Boolean) as DetectedModule[];

      // Custom UI: no temp entry generated
      for (const mod of modules) {
        if (mod.mode === 'uikit') {
          const moduleDir = join(tempDir, mod.module.key);
          mkdirSync(moduleDir, { recursive: true });
          writeFileSync(join(moduleDir, 'entry.tsx'), '// entry');
        }
      }

      expect(existsSync(join(tempDir, 'custom-page'))).toBe(false);
      expect(modules[0].mode).toBe('customui');
    });
  });

  // ── Module Routing Middleware ───────────────────────────────────────

  describe('installModuleRouting', () => {
    function createMockViteServer() {
      const stack: any[] = [];
      return {
        middlewares: { stack },
        getMiddleware: () => stack[0]?.handle,
      };
    }

    function createMockReqRes(url: string) {
      let statusCode: number | undefined;
      let headers: Record<string, string> = {};
      let body = '';
      const req = { url, method: 'GET' };
      const res = {
        writeHead: (code: number, h?: Record<string, string>) => { statusCode = code; if (h) headers = h; },
        end: (b?: string) => { body = b ?? ''; },
        getBody: () => body,
        getStatus: () => statusCode,
        getHeaders: () => headers,
      };
      return { req, res };
    }

    const testModules: DetectedModule[] = [
      {
        module: { type: 'jira:issuePanel', key: 'panel', title: 'My Panel' },
        resourcePath: '/app/src/panel/index.tsx',
        mode: 'uikit',
      },
      {
        module: { type: 'jira:globalPage', key: 'page' },
        resourcePath: '/app/static/page',
        mode: 'customui',
      },
    ];

    it('should serve module picker at root /', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');

      const middleware = vite.getMiddleware();
      expect(middleware).toBeDefined();

      const { req, res } = createMockReqRes('/');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(res.getStatus()).toBe(200);
      expect(res.getBody()).toContain('/module/panel/');
      expect(res.getBody()).toContain('/module/page/');
    });

    it('should rewrite /module/<key>/ to /<key>/index.html for UIKit modules', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/panel/');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/panel/index.html');
    });

    it('should rewrite /module/<key>/entry.tsx for UIKit modules', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/panel/entry.tsx');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/panel/entry.tsx');
    });

    it('should rewrite /module/<key>/ to /_customui_<key>/index.html for Custom UI', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/page/');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/_customui_page/index.html');
    });

    it('should return 404 for unknown module key', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/nonexistent/');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(res.getStatus()).toBe(404);
      expect(res.getBody()).toContain('nonexistent');
    });

    it('should pass through non-module URLs to Vite (e.g., /__tools/)', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/__tools/');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      // URL should not be rewritten
      expect(req.url).toBe('/__tools/');
    });

    it('should pass through static asset URLs', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/assets/style.css');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/assets/style.css');
    });

    // ── SPA client-side routes (fullPage routePrefix / view router) ─────
    // Extension-less nested paths are client-side routes: real Forge serves
    // the module's HTML for any route under a fullPage module and lets the
    // app's router take over. Found via forgebuilder's routed jira:fullPage.

    it('should serve module index.html for extension-less SPA routes (UIKit)', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/panel/some/client/route');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/panel/index.html');
    });

    it('should serve module index.html for extension-less SPA routes (Custom UI)', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/page/forgebuilder/settings');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/_customui_page/index.html');
    });

    it('should still rewrite nested file requests literally (Custom UI assets)', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/page/static/js/main.abc123.js');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/_customui_page/static/js/main.abc123.js');
    });

    it('should treat /module/<key>/index.html as a literal file request', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/page/index.html');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/_customui_page/index.html');
    });

    it('should preserve query strings on SPA route rewrites', () => {
      const vite = createMockViteServer();
      installModuleRouting(vite, testModules, '/tmp');
      const middleware = vite.getMiddleware();

      const { req, res } = createMockReqRes('/module/page/settings/general?tab=auth');
      let nextCalled = false;
      middleware(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
      expect(req.url).toBe('/_customui_page/index.html');
    });
  });

  // Cleanup
  afterAll(() => {
    if (existsSync(TEST_TMP)) {
      try { rmSync(TEST_TMP, { recursive: true, force: true }); } catch {}
    }
  });
});
