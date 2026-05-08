/**
 * Tests for SimulatedForgeSQL — ephemeral MySQL backend for Forge SQL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

describe('SimulatedForgeSQL', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    // Eagerly start the MySQL server so we don't pay startup cost in each test
    await sim.sql.start();
  }, 60_000); // MySQL init can take a while

  afterAll(async () => {
    await sim.stop();
  }, 30_000);

  it('should start and report running', () => {
    expect(sim.sql.isRunning).toBe(true);
    expect(sim.sql.port).toBeGreaterThan(0);
  });

  it('should execute raw queries directly', async () => {
    await sim.sql.query('CREATE TABLE IF NOT EXISTS test_direct (id INT PRIMARY KEY, name VARCHAR(255))');
    await sim.sql.query('INSERT INTO test_direct (id, name) VALUES (1, ?)', ['hello']);
    const rows = await sim.sql.query<{ id: number; name: string }>('SELECT * FROM test_direct WHERE id = 1');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('hello');
  });

  it('should handle requests through the fetch function (like @forge/sql)', async () => {
    const fetchFn = sim.sql.createFetchFunction();

    // Create table via DDL endpoint
    const ddlRes = await fetchFn('/api/v1/execute/ddl', {
      method: 'POST',
      body: JSON.stringify({
        query: 'CREATE TABLE IF NOT EXISTS test_fetch (id INT AUTO_INCREMENT PRIMARY KEY, value TEXT)',
        params: [],
        method: 'all',
      }),
    });
    expect(ddlRes.ok).toBe(true);

    // Insert
    const insertRes = await fetchFn('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'INSERT INTO test_fetch (value) VALUES (?)',
        params: ['test_value'],
        method: 'all',
      }),
    });
    expect(insertRes.ok).toBe(true);
    const insertData = await insertRes.json();
    expect(insertData.rows.affectedRows).toBe(1);
    expect(insertData.rows.insertId).toBeGreaterThan(0);

    // Select
    const selectRes = await fetchFn('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'SELECT * FROM test_fetch',
        params: [],
        method: 'all',
      }),
    });
    expect(selectRes.ok).toBe(true);
    const selectData = await selectRes.json();
    expect(selectData.rows).toHaveLength(1);
    expect(selectData.rows[0].value).toBe('test_value');
    expect(selectData.metadata).toBeDefined();
  });

  it('should return structured errors for bad SQL', async () => {
    const fetchFn = sim.sql.createFetchFunction();
    const res = await fetchFn('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'SELECT * FROM nonexistent_table_xyz',
        params: [],
      }),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBeDefined();
    expect(data.message).toContain('nonexistent_table_xyz');
  });

  it('should work through __fetchProduct shim', async () => {
    // Import the shim's __fetchProduct
    const { __fetchProduct } = await import('../shims/forge-api.js');

    // __fetchProduct with sql descriptor returns a fetch function
    const fetchFn = __fetchProduct({ provider: 'app', remote: 'sql', type: 'sql' });
    expect(typeof fetchFn).toBe('function');

    // Use it
    await (fetchFn as Function)('/api/v1/execute/ddl', {
      method: 'POST',
      body: JSON.stringify({
        query: 'CREATE TABLE IF NOT EXISTS test_shim (id INT PRIMARY KEY, val VARCHAR(100))',
        params: [],
      }),
    });

    const insertRes = await (fetchFn as Function)('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'INSERT INTO test_shim VALUES (42, ?)',
        params: ['from_shim'],
      }),
    });
    const insertData = await insertRes.json();
    expect(insertData.rows.affectedRows).toBe(1);

    const selectRes = await (fetchFn as Function)('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'SELECT * FROM test_shim WHERE id = 42',
        params: [],
      }),
    });
    const selectData = await selectRes.json();
    expect(selectData.rows[0].val).toBe('from_shim');
  });

  it('should support MySQL-specific features (JSON, generated columns)', async () => {
    await sim.sql.query(`
      CREATE TABLE IF NOT EXISTS test_json (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data JSON NOT NULL,
        name VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.name'))) STORED
      )
    `);
    await sim.sql.query(
      "INSERT INTO test_json (data) VALUES (?)",
      [JSON.stringify({ name: 'Nyx', level: 99 })]
    );
    const rows = await sim.sql.query<{ id: number; data: any; name: string }>(
      'SELECT * FROM test_json WHERE id = 1'
    );
    expect(rows[0].name).toBe('Nyx');
  });

  it('should support migrations table pattern (like @forge/sql migrationRunner)', async () => {
    const fetchFn = sim.sql.createFetchFunction();

    // This is exactly what migrationRunner does
    await fetchFn('/api/v1/execute/ddl', {
      method: 'POST',
      body: JSON.stringify({
        query: 'CREATE TABLE IF NOT EXISTS __migrations (id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, migratedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        params: [],
      }),
    });

    // Run a migration
    await fetchFn('/api/v1/execute/ddl', {
      method: 'POST',
      body: JSON.stringify({
        query: 'CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255) UNIQUE)',
        params: [],
      }),
    });

    // Record it
    await fetchFn('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'INSERT INTO __migrations (name) VALUES (?)',
        params: ['001_create_users'],
      }),
    });

    // List migrations
    const res = await fetchFn('/api/v1/execute', {
      method: 'POST',
      body: JSON.stringify({
        query: 'SELECT id, name, migratedAt FROM __migrations',
        params: [],
      }),
    });
    const data = await res.json();
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].name).toBe('001_create_users');
  });

  describe('reset (regression: SQL state should clear on sim.reset())', () => {
    it('drops all tables on sql.reset() but keeps the server running', async () => {
      // Seed two tables, one with FK to the other (ensures we handle FKs)
      await sim.sql.query('CREATE TABLE IF NOT EXISTS reset_parent (id INT PRIMARY KEY)');
      await sim.sql.query(
        'CREATE TABLE IF NOT EXISTS reset_child (id INT PRIMARY KEY, parent_id INT, FOREIGN KEY (parent_id) REFERENCES reset_parent(id))',
      );
      await sim.sql.query('INSERT INTO reset_parent (id) VALUES (1)');
      await sim.sql.query('INSERT INTO reset_child (id, parent_id) VALUES (10, 1)');

      // Sanity: tables exist and have rows
      const before = await sim.sql.query<{ TABLE_NAME: string }>(
        "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = 'forge_app' AND TABLE_NAME IN ('reset_parent', 'reset_child')",
      );
      expect(before).toHaveLength(2);

      // Reset
      await sim.sql.reset();

      // Tables should be gone
      const after = await sim.sql.query<{ TABLE_NAME: string }>(
        "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = 'forge_app' AND TABLE_NAME IN ('reset_parent', 'reset_child')",
      );
      expect(after).toHaveLength(0);

      // Server is still up
      expect(sim.sql.isRunning).toBe(true);
      expect(sim.sql.port).toBeGreaterThan(0);
    });

    it('sim.reset() also drops SQL tables', async () => {
      // Top-level sim.reset should propagate to SQL.
      await sim.sql.query('CREATE TABLE IF NOT EXISTS reset_top (id INT PRIMARY KEY)');
      await sim.sql.query('INSERT INTO reset_top (id) VALUES (42)');

      const before = await sim.sql.query<{ id: number }>('SELECT id FROM reset_top');
      expect(before).toHaveLength(1);

      await sim.reset();

      // Table is gone — querying should error
      await expect(sim.sql.query('SELECT id FROM reset_top')).rejects.toThrow();
      expect(sim.sql.isRunning).toBe(true);
    });

    it('sql.reset() is a no-op when server has not been started', async () => {
      // Use a fresh simulator that hasn't started SQL
      const freshSim = createSimulator();
      expect(freshSim.sql.isRunning).toBe(false);
      // Should not throw
      await expect(freshSim.sql.reset()).resolves.toBeUndefined();
      expect(freshSim.sql.isRunning).toBe(false);
    });
  });
});
