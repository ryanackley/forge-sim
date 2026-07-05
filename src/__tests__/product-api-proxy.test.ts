/**
 * Tests for product API proxy mode — mock route priority over real API.
 */

import { describe, it, expect } from 'vitest';
import { SimulatedProductApi } from '../product-api.js';
import type { AtlassianAccount } from '../auth/credentials.js';

function mockAccount(overrides: Partial<AtlassianAccount> = {}): AtlassianAccount {
  return {
    id: 'test-1',
    name: 'Test User',
    email: 'test@example.com',
    site: 'test.atlassian.net',
    cloudId: 'cloud-123',
    accountId: 'account-456',
    authType: 'pat',
    accessToken: 'pat-test',
    refreshToken: '',
    expiresAt: 0,
    scopes: [],
    ...overrides,
  };
}

describe('Product API Proxy', () => {
  it('starts in mock mode by default', () => {
    const api = new SimulatedProductApi();
    expect(api.isRealMode).toBe(false);
    expect(api.connectedAccount).toBeNull();
  });

  it('switches to real mode on connectRealApis', () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(mockAccount());
    expect(api.isRealMode).toBe(true);
    expect(api.connectedAccount?.name).toBe('Test User');
  });

  it('reverts to mock mode on disconnect', () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(mockAccount());
    api.disconnectRealApis();
    expect(api.isRealMode).toBe(false);
    expect(api.connectedAccount).toBeNull();
  });

  it('mock routes take priority over real API', async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(mockAccount());

    // Register a mock route
    api.mockRoutes('jira', {
      'GET /rest/api/3/myself': { accountId: 'mock-user', displayName: 'Mock User' },
    });

    // This should return the mock, NOT hit the real API
    const response = await api.request('jira', '/rest/api/3/myself');
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.displayName).toBe('Mock User');
  });

  it('unmocked routes in real mode attempt real API call', async () => {
    const api = new SimulatedProductApi();
    // Use a non-existent site so DNS/HTTP fails deterministically — some
    // real Atlassian sites return 200 on /serverInfo even unauthenticated,
    // which would make a token-validity assertion flaky.
    api.connectRealApis(mockAccount({
      site: 'forge-sim-nonexistent-site-for-tests.invalid',
      accessToken: 'invalid-token',
    }));

    // This path has no mock — will try real API and fail (bad host).
    const response = await api.request('jira', '/rest/api/3/serverInfo');
    expect(response.ok).toBe(false);
  });

  it('clear() resets everything', () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(mockAccount());
    api.mockRoutes('jira', { 'GET /test': { ok: true } });
    api.clear();
    expect(api.isRealMode).toBe(false);
  });
});
