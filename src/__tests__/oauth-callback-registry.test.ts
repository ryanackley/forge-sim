/**
 * Tests for OAuthCallbackRegistry — the in-memory pending-flow dispatcher
 * that replaces the two duplicate `waitForCallback` impls.
 *
 * Covers:
 * - register() returns state + redirectUri + promise
 * - handle() with matching state resolves and runs onCode
 * - handle() with unknown state returns 400 and does not consume any flow
 * - handle() with provider `error` param rejects + returns failure HTML
 * - handle() with onCode that throws rejects + returns failure HTML
 * - Timeout fires when no callback arrives
 * - cancelAll() rejects every pending flow
 * - Concurrent flows resolve independently
 * - HTML escaping of error params (no injection)
 * - Singleton sharing across getOAuthCallbackRegistry() calls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OAuthCallbackRegistry,
  getOAuthCallbackRegistry,
  _resetOAuthCallbackRegistryForTests,
  OAUTH_CALLBACK_PATH,
  OAUTH_CALLBACK_PORT,
} from '../auth/oauth-callback-registry.js';

describe('OAuthCallbackRegistry', () => {
  let registry: OAuthCallbackRegistry;

  beforeEach(() => {
    registry = new OAuthCallbackRegistry();
  });

  describe('register()', () => {
    it('returns a random state, the default redirect URI, and a pending promise', () => {
      const result = registry.register({
        providerKey: 'google',
        onCode: async () => {},
      });

      expect(result.state).toMatch(/^[0-9a-f]{32}$/);
      expect(result.redirectUri).toBe(
        `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`,
      );
      expect(result.promise).toBeInstanceOf(Promise);
      expect(registry.size()).toBe(1);
    });

    it('generates a fresh state for each register call', () => {
      const a = registry.register({ providerKey: 'google', onCode: async () => {} });
      const b = registry.register({ providerKey: 'github', onCode: async () => {} });
      expect(a.state).not.toBe(b.state);
      expect(registry.size()).toBe(2);
    });

    it('honors a custom redirectUri (used by the standalone CLI fallback)', () => {
      const result = registry.register({
        providerKey: 'google',
        onCode: async () => {},
        redirectUri: 'http://localhost:9999/callback',
      });
      expect(result.redirectUri).toBe('http://localhost:9999/callback');
    });

    it('tracks the providerKey for diagnostics via listProviders()', () => {
      registry.register({ providerKey: 'google', onCode: async () => {} });
      registry.register({ providerKey: 'github', onCode: async () => {} });
      expect(registry.listProviders().sort()).toEqual(['github', 'google']);
    });
  });

  describe('handle() — happy path', () => {
    it('resolves the matching flow, runs onCode, and returns 200 + success HTML with auto-close', async () => {
      const onCode = vi.fn(async (_code: string) => {});
      const { state, promise } = registry.register({ providerKey: 'google', onCode });

      const result = await registry.handle({ state, code: 'auth-code-123' });

      expect(onCode).toHaveBeenCalledWith('auth-code-123');
      expect(result.status).toBe(200);
      expect(result.html).toContain('✅ Authorized');
      expect(result.html).toContain('window.close()'); // popup auto-close
      await expect(promise).resolves.toBeUndefined();
      expect(registry.size()).toBe(0);
    });

    it('awaits onCode before resolving the promise', async () => {
      let onCodeCompleted = false;
      const onCode = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        onCodeCompleted = true;
      });
      const { state, promise } = registry.register({ providerKey: 'google', onCode });

      await registry.handle({ state, code: 'c' });
      await promise;
      expect(onCodeCompleted).toBe(true);
    });
  });

  describe('handle() — unknown state', () => {
    it('returns 400 + invalid-callback HTML, and leaves the registry intact', async () => {
      const { promise } = registry.register({ providerKey: 'google', onCode: async () => {} });
      promise.catch(() => {}); // avoid unhandled-rejection if the test ever times out

      const result = await registry.handle({ state: 'not-a-real-state', code: 'whatever' });

      expect(result.status).toBe(400);
      expect(result.html).toContain('Invalid callback');
      expect(registry.size()).toBe(1); // pending flow untouched
    });

    it('returns 400 for an empty state too', async () => {
      const result = await registry.handle({ state: '', code: 'c' });
      expect(result.status).toBe(400);
    });
  });

  describe('handle() — error param from provider', () => {
    it('rejects the pending flow and returns 200 + failure HTML', async () => {
      const { state, promise } = registry.register({ providerKey: 'google', onCode: async () => {} });

      const result = await registry.handle({ state, error: 'access_denied' });

      expect(result.status).toBe(200);
      expect(result.html).toContain('Authorization failed');
      expect(result.html).toContain('access_denied');
      await expect(promise).rejects.toThrow(/access_denied/);
      expect(registry.size()).toBe(0);
    });

    it('escapes the error param in HTML (no injection)', async () => {
      const { state, promise } = registry.register({ providerKey: 'google', onCode: async () => {} });
      promise.catch(() => {});

      const result = await registry.handle({
        state,
        error: '<script>alert(1)</script>',
      });

      expect(result.html).not.toContain('<script>alert(1)</script>');
      expect(result.html).toContain('&lt;script&gt;');
    });
  });

  describe('handle() — onCode throws', () => {
    it('rejects the promise and returns failure HTML', async () => {
      const onCode = vi.fn(async () => {
        throw new Error('token exchange failed');
      });
      const { state, promise } = registry.register({ providerKey: 'google', onCode });

      const result = await registry.handle({ state, code: 'c' });

      expect(result.status).toBe(200);
      expect(result.html).toContain('Authorization failed');
      expect(result.html).toContain('token exchange failed');
      await expect(promise).rejects.toThrow('token exchange failed');
      expect(registry.size()).toBe(0);
    });

    it('handles non-Error throws by wrapping them', async () => {
      const onCode = vi.fn(async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'something weird';
      });
      const { state, promise } = registry.register({ providerKey: 'google', onCode });

      await registry.handle({ state, code: 'c' });
      await expect(promise).rejects.toThrow('something weird');
    });
  });

  describe('handle() — missing code', () => {
    it('rejects when state matches but code is absent and no error param', async () => {
      const { state, promise } = registry.register({ providerKey: 'google', onCode: async () => {} });

      const result = await registry.handle({ state });

      expect(result.status).toBe(400);
      expect(result.html).toContain('Missing authorization code');
      await expect(promise).rejects.toThrow(/missing code/i);
    });
  });

  describe('timeout', () => {
    it('rejects the pending flow when no callback arrives within timeoutMs', async () => {
      const { promise } = registry.register({
        providerKey: 'google',
        onCode: async () => {},
        timeoutMs: 25,
      });

      await expect(promise).rejects.toThrow(/timeout/i);
      expect(registry.size()).toBe(0);
    });

    it('does NOT fire the timeout if the callback arrives first', async () => {
      const { state, promise } = registry.register({
        providerKey: 'google',
        onCode: async () => {},
        timeoutMs: 100,
      });

      await registry.handle({ state, code: 'c' });
      await promise; // resolves, not rejects

      // Wait past the original timeout window — nothing should blow up.
      await new Promise((r) => setTimeout(r, 150));
      expect(registry.size()).toBe(0);
    });
  });

  describe('cancelAll()', () => {
    it('rejects every pending flow', async () => {
      const a = registry.register({ providerKey: 'google', onCode: async () => {} });
      const b = registry.register({ providerKey: 'github', onCode: async () => {} });

      registry.cancelAll('shutdown');

      await expect(a.promise).rejects.toThrow('shutdown');
      await expect(b.promise).rejects.toThrow('shutdown');
      expect(registry.size()).toBe(0);
    });

    it('uses a default reason if none is provided', async () => {
      const { promise } = registry.register({ providerKey: 'google', onCode: async () => {} });
      registry.cancelAll();
      await expect(promise).rejects.toThrow(/cancelled/i);
    });
  });

  describe('concurrent flows', () => {
    it('resolves each flow independently by state', async () => {
      const onCodeA = vi.fn(async () => {});
      const onCodeB = vi.fn(async () => {});
      const a = registry.register({ providerKey: 'google', onCode: onCodeA });
      const b = registry.register({ providerKey: 'github', onCode: onCodeB });

      await registry.handle({ state: a.state, code: 'A-CODE' });
      await registry.handle({ state: b.state, code: 'B-CODE' });

      expect(onCodeA).toHaveBeenCalledWith('A-CODE');
      expect(onCodeB).toHaveBeenCalledWith('B-CODE');
      await Promise.all([a.promise, b.promise]);
      expect(registry.size()).toBe(0);
    });

    it("doesn't disturb sibling flows when one is handled", async () => {
      const a = registry.register({ providerKey: 'google', onCode: async () => {} });
      const b = registry.register({ providerKey: 'github', onCode: async () => {} });

      await registry.handle({ state: a.state, code: 'c' });
      await a.promise;

      expect(registry.size()).toBe(1);
      expect(registry.listProviders()).toEqual(['github']);

      await registry.handle({ state: b.state, code: 'c' });
      await b.promise;
    });
  });
});

describe('getOAuthCallbackRegistry() singleton', () => {
  beforeEach(() => {
    _resetOAuthCallbackRegistryForTests();
  });

  it('returns the same instance across calls', () => {
    const a = getOAuthCallbackRegistry();
    const b = getOAuthCallbackRegistry();
    expect(a).toBe(b);
  });

  it('shares pending flows across getOAuthCallbackRegistry() callers', async () => {
    const initiator = getOAuthCallbackRegistry();
    const handler = getOAuthCallbackRegistry();

    const onCode = vi.fn(async () => {});
    const { state, promise } = initiator.register({ providerKey: 'google', onCode });

    // A different caller (e.g. the dev server route) handles the callback.
    await handler.handle({ state, code: 'c' });
    await promise;
    expect(onCode).toHaveBeenCalled();
  });

  it('_resetOAuthCallbackRegistryForTests cancels in-flight flows and rebuilds', async () => {
    const first = getOAuthCallbackRegistry();
    const { promise } = first.register({ providerKey: 'google', onCode: async () => {} });

    _resetOAuthCallbackRegistryForTests();
    await expect(promise).rejects.toThrow();

    const second = getOAuthCallbackRegistry();
    expect(second).not.toBe(first);
    expect(second.size()).toBe(0);
  });
});
