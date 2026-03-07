/**
 * Tests for state persistence — save on shutdown, restore on startup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ForgeSimulator } from '../simulator.js';
import { saveState, loadState, hasPersistedState } from '../persistence.js';

describe('Persistence', () => {
  let sim: ForgeSimulator;
  let stateDir: string;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    stateDir = await mkdtemp(join(tmpdir(), 'forge-sim-persist-'));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  // ── KVS Persistence ────────────────────────────────────────────────

  describe('KVS', () => {
    it('saves and restores KVS state', async () => {
      // Populate KVS
      await sim.kvs.set('key1', 'value1');
      await sim.kvs.set('key2', { nested: true, count: 42 });
      await sim.kvs.set('key3', [1, 2, 3]);

      // Save
      await saveState(sim, stateDir);

      // Verify file exists
      const raw = await readFile(join(stateDir, 'kvs.json'), 'utf-8');
      const saved = JSON.parse(raw);
      expect(saved.key1).toBe('value1');
      expect(saved.key2).toEqual({ nested: true, count: 42 });
      expect(saved.key3).toEqual([1, 2, 3]);

      // Create fresh simulator and restore
      const sim2 = new ForgeSimulator();
      await loadState(sim2, stateDir);

      expect(await sim2.kvs.get('key1')).toBe('value1');
      expect(await sim2.kvs.get('key2')).toEqual({ nested: true, count: 42 });
      expect(await sim2.kvs.get('key3')).toEqual([1, 2, 3]);
    });

    it('skips save when KVS is empty', async () => {
      await saveState(sim, stateDir);

      // File should not exist
      await expect(access(join(stateDir, 'kvs.json'))).rejects.toThrow();
    });

    it('handles missing state dir gracefully', async () => {
      const result = await loadState(sim, join(stateDir, 'nonexistent'));
      expect(result).toBe(false);
    });

    it('merges into existing KVS state', async () => {
      await sim.kvs.set('existing', 'stays');
      await sim.kvs.set('overwrite', 'old');

      // Save a different sim's state
      const sim2 = new ForgeSimulator();
      await sim2.kvs.set('overwrite', 'new');
      await sim2.kvs.set('added', 'fresh');
      await saveState(sim2, stateDir);

      // Restore into sim (which has 'existing')
      await loadState(sim, stateDir);

      expect(await sim.kvs.get('existing')).toBe('stays');
      expect(await sim.kvs.get('overwrite')).toBe('new');
      expect(await sim.kvs.get('added')).toBe('fresh');
    });
  });

  // ── hasPersistedState ──────────────────────────────────────────────

  describe('hasPersistedState', () => {
    it('returns false for empty directory', async () => {
      expect(await hasPersistedState(stateDir)).toBe(false);
    });

    it('returns true when KVS state exists', async () => {
      await sim.kvs.set('test', 'data');
      await saveState(sim, stateDir);
      expect(await hasPersistedState(stateDir)).toBe(true);
    });

    it('returns false for nonexistent directory', async () => {
      expect(await hasPersistedState('/tmp/no-such-dir-12345')).toBe(false);
    });
  });
});
