/**
 * src/app-ari.ts — the one place manifest `app.id` ARIs are parsed.
 *
 * Consumers: @forge/events appEvents.publish() (custom app event AVIs) and
 * @forge/api getAppContext() (appAri/environmentAri/installationAri). If you
 * find yourself slicing `app.id` anywhere else, use this helper instead.
 */
import { describe, it, expect } from 'vitest';
import { extractAppIdUuid } from '../app-ari.js';

const TEST_APP_UUID = 'd9022ad7-c220-4836-b1d1-7f9f2c633d3a';
const TEST_APP_ARI = `ari:cloud:ecosystem::app/${TEST_APP_UUID}`;

describe('extractAppIdUuid', () => {
  it('extracts the UUID from a full app ARI', () => {
    expect(extractAppIdUuid(TEST_APP_ARI)).toBe(TEST_APP_UUID);
  });

  it('handles app.id without a slash (legacy/short id)', () => {
    expect(extractAppIdUuid('my-test-app')).toBe('my-test-app');
  });

  it('returns "unknown" for missing app.id', () => {
    expect(extractAppIdUuid(undefined)).toBe('unknown');
  });

  it('returns "unknown" for an empty string', () => {
    expect(extractAppIdUuid('')).toBe('unknown');
  });

  it('is idempotent: re-extracting an already-bare UUID is a no-op', () => {
    expect(extractAppIdUuid(extractAppIdUuid(TEST_APP_ARI))).toBe(TEST_APP_UUID);
  });
});
