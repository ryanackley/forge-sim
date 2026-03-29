/**
 * Tests for invocation time limit checking and Rovo action input validation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../index.js';

describe('validateActionInputs', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    // Load a manifest with an action
    await sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
modules:
  action:
    - key: fetch-data
      name: Fetch Data
      function: fetcher
      actionVerb: GET
      description: Fetches data
      inputs:
        query:
          title: Query
          type: string
          required: true
          description: The search query
        limit:
          title: Limit
          type: integer
          required: false
        enabled:
          title: Enabled
          type: boolean
          required: true
  function:
    - key: fetcher
      handler: src/fetcher.handler
`);
  });

  it('returns empty for valid inputs', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      query: 'hello',
      limit: 10,
      enabled: true,
    });
    expect(errors).toEqual([]);
  });

  it('catches missing required string input', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      enabled: true,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('query');
    expect(errors[0]).toContain('required');
  });

  it('catches missing required boolean input', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      query: 'hello',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('enabled');
  });

  it('allows missing optional input', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      query: 'hello',
      enabled: true,
      // limit is optional — not provided
    });
    expect(errors).toEqual([]);
  });

  it('catches wrong type — string expected', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      query: 42,
      enabled: true,
    });
    expect(errors.some(e => e.includes('query') && e.includes('string'))).toBe(true);
  });

  it('catches wrong type — integer expected', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      query: 'hello',
      limit: 3.5,
      enabled: true,
    });
    expect(errors.some(e => e.includes('limit') && e.includes('integer'))).toBe(true);
  });

  it('catches wrong type — boolean expected', () => {
    const errors = sim.validateActionInputs('fetch-data', {
      query: 'hello',
      enabled: 'yes',
    });
    expect(errors.some(e => e.includes('enabled') && e.includes('boolean'))).toBe(true);
  });

  it('returns empty for unknown action key', () => {
    const errors = sim.validateActionInputs('nonexistent', { foo: 'bar' });
    expect(errors).toEqual([]);
  });

  it('catches multiple errors at once', () => {
    const errors = sim.validateActionInputs('fetch-data', {});
    expect(errors.length).toBeGreaterThanOrEqual(2); // query + enabled are required
  });
});

describe('invocation timing', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
  });

  it('does not warn for fast invocations', async () => {
    await sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
modules:
  function:
    - key: fast-fn
      handler: src/fast.handler
`);
    await sim.deploy(new URL('../__tests__/fixtures/simple-panel', import.meta.url).pathname);

    await sim.invoke('getData', {});

    const logs = sim.getLogs();
    const timeoutLogs = logs.filter(l => l.message.includes('TIMEOUT') || l.message.includes('SLOW'));
    expect(timeoutLogs).toHaveLength(0);
  });
});
