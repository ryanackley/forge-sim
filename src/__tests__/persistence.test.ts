/**
 * Tests for state persistence — save on shutdown, restore on startup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ForgeSimulator } from '../simulator.js';
import { saveState, loadState, hasPersistedState, getSQLDumpPath } from '../persistence.js';

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

  // ── SQL Persistence ─────────────────────────────────────────────────

  describe('SQL', () => {
    it('saves and restores SQL tables and data', async () => {
      // Start SQL and create a table with data
      await sim.sql.start();
      await sim.sql.executeMultiStatement(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255)
        );
        INSERT INTO users (name, email) VALUES ('Alice', 'alice@test.com');
        INSERT INTO users (name, email) VALUES ('Bob', 'bob@test.com');
      `);

      // Save
      await saveState(sim, stateDir);

      // Verify dump file exists
      const dump = await readFile(join(stateDir, 'sql.dump'), 'utf-8');
      expect(dump).toContain('CREATE TABLE');
      expect(dump).toContain('users');

      // Create fresh simulator — set initSQLFilePath BEFORE start (like dev-command does)
      const sim2 = new ForgeSimulator();
      const sqlDumpPath = await getSQLDumpPath(stateDir);
      expect(sqlDumpPath).toBeDefined();
      sim2.sql.setInitSQLFilePath(sqlDumpPath!);
      await sim2.sql.start();

      // Query restored data — tables restored during MySQL boot
      const rows = await sim2.sql.query<{ id: number; name: string; email: string }>('SELECT * FROM users ORDER BY id');
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Alice');
      expect(rows[1].name).toBe('Bob');

      await sim2.sql.stop();
    }, 60_000);

    it('handles foreign key constraints on restore', async () => {
      await sim.sql.start();
      await sim.sql.executeMultiStatement(`
        CREATE TABLE departments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );
        CREATE TABLE employees (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          dept_id INT,
          FOREIGN KEY (dept_id) REFERENCES departments(id)
        );
        INSERT INTO departments (name) VALUES ('Engineering');
        INSERT INTO employees (name, dept_id) VALUES ('Alice', 1);
      `);

      // Save (dump will have DROP TABLE in arbitrary order)
      await saveState(sim, stateDir);

      // Verify dump has foreign_key_checks wrapper
      const dump = await readFile(join(stateDir, 'sql.dump'), 'utf-8');
      expect(dump).toContain('SET foreign_key_checks = 0');
      expect(dump).toContain('SET foreign_key_checks = 1');
      expect(dump).toContain('USE forge_app');

      // Restore into fresh sim — should not fail on FK ordering
      const sim2 = new ForgeSimulator();
      const sqlDumpPath = await getSQLDumpPath(stateDir);
      sim2.sql.setInitSQLFilePath(sqlDumpPath!);
      await sim2.sql.start();

      const rows = await sim2.sql.query<{ name: string }>('SELECT e.name FROM employees e JOIN departments d ON e.dept_id = d.id');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Alice');

      await sim2.sql.stop();
    }, 60_000);

    afterAll(async () => {
      await sim.sql.stop();
    }, 30_000);
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
