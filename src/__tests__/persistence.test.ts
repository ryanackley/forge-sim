/**
 * Tests for state persistence — save on shutdown, restore on startup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { saveState, loadState, hasPersistedState, getSQLDumpPath } from '../persistence.js';

describe('Persistence', () => {
  let sim: ForgeSimulator;
  let stateDir: string;

  beforeEach(async () => {
    sim = createSimulator();
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
      const sim2 = createSimulator();
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
      const sim2 = createSimulator();
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
      const sim2 = createSimulator();
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
      const sim2 = createSimulator();
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

  // ── Entity Store Persistence ────────────────────────────────────────

  describe('Entity Store', () => {
    it('saves and restores Custom Entities', async () => {
      // Populate entity store via handleRequest (simulates __forge_fetch__)
      await sim.entityStore.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'Task', key: 'task-1', value: { title: 'Build tests', priority: 'high' } }),
      });
      await sim.entityStore.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'Task', key: 'task-2', value: { title: 'Ship feature', priority: 'medium' } }),
      });
      await sim.entityStore.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'User', key: 'user-1', value: { name: 'Ryan', role: 'admin' } }),
      });

      // Save
      await saveState(sim, stateDir);

      // Verify file exists
      const raw = await readFile(join(stateDir, 'entities.json'), 'utf-8');
      const saved = JSON.parse(raw);
      expect(saved.entities).toHaveLength(3);

      // Create fresh simulator and restore
      const sim2 = createSimulator();
      await loadState(sim2, stateDir);

      // Verify entities are restored
      const task1 = await sim2.entityStore.handleRequest('/api/v1/entity/get', {
        body: JSON.stringify({ entityName: 'Task', key: 'task-1' }),
      });
      const task1Data = await task1.json();
      expect(task1Data.value).toEqual({ title: 'Build tests', priority: 'high' });

      const user1 = await sim2.entityStore.handleRequest('/api/v1/entity/get', {
        body: JSON.stringify({ entityName: 'User', key: 'user-1' }),
      });
      const user1Data = await user1.json();
      expect(user1Data.value).toEqual({ name: 'Ryan', role: 'admin' });
    });

    it('saves and restores entity-store plain KVS', async () => {
      // Plain KVS through entity store (the __forge_fetch__ path)
      await sim.entityStore.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'config:theme', value: 'dark' }),
      });

      await saveState(sim, stateDir);

      const sim2 = createSimulator();
      await loadState(sim2, stateDir);

      const resp = await sim2.entityStore.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'config:theme' }),
      });
      const data = await resp.json();
      expect(data.value).toBe('dark');
    });

    it('saves and restores secrets', async () => {
      await sim.entityStore.handleRequest('/api/v1/secret/set', {
        body: JSON.stringify({ key: 'api-key', value: 'sk-12345' }),
      });

      await saveState(sim, stateDir);

      const sim2 = createSimulator();
      await loadState(sim2, stateDir);

      const resp = await sim2.entityStore.handleRequest('/api/v1/secret/get', {
        body: JSON.stringify({ key: 'api-key' }),
      });
      const data = await resp.json();
      expect(data.value).toBe('sk-12345');
    });

    it('skips save when entity store is empty', async () => {
      await saveState(sim, stateDir);
      await expect(access(join(stateDir, 'entities.json'))).rejects.toThrow();
    });

    it('hasPersistedState returns true when entities exist', async () => {
      await sim.entityStore.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'Foo', key: 'bar', value: 'baz' }),
      });
      await saveState(sim, stateDir);
      expect(await hasPersistedState(stateDir)).toBe(true);
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
