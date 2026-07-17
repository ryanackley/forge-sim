/**
 * Tests for the hand-rolled MySQL dump (src/sql-dump.ts), which replaced the
 * abandoned `mysqldump` npm package (eval 3 finding #3: npm `overrides` don't
 * propagate to consumers, so its vulnerable pinned mysql2 surfaced 3 critical
 * audit findings on every fresh `npm install forge-sim`).
 *
 * escapeSqlValue is covered as pure-function unit tests; the full
 * dump-and-restore round trip (real MySQL) lives in persistence.test.ts and
 * persistence-okr.test.ts. Here we add one live-MySQL test for the dump
 * shape itself plus tricky value types (JSON, binary, datetime, quotes).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { dumpDatabase, escapeSqlValue } from '../sql-dump.js';

describe('escapeSqlValue', () => {
  it('maps null and undefined to NULL', () => {
    expect(escapeSqlValue(null)).toBe('NULL');
    expect(escapeSqlValue(undefined)).toBe('NULL');
  });

  it('escapes strings with quotes and backslashes', () => {
    expect(escapeSqlValue("O'Brien")).toBe("'O\\'Brien'");
    expect(escapeSqlValue('back\\slash')).toBe("'back\\\\slash'");
  });

  it('passes numbers and booleans through', () => {
    expect(escapeSqlValue(42)).toBe('42');
    expect(escapeSqlValue(true)).toBe('true');
  });

  it('emits Buffers as hex literals', () => {
    expect(escapeSqlValue(Buffer.from([0xde, 0xad]))).toBe("X'dead'");
    expect(escapeSqlValue(Buffer.alloc(0))).toBe("''");
  });

  it('serializes JSON-column objects/arrays as escaped strings', () => {
    // SqlString backslash-escapes double quotes — valid MySQL string syntax.
    expect(escapeSqlValue({ a: 1 })).toBe("'{\\\"a\\\":1}'");
    expect(escapeSqlValue([1, 'two'])).toBe("'[1,\\\"two\\\"]'");
  });
});

describe('dumpDatabase (live MySQL)', () => {
  let sim: ForgeSimulator;

  afterAll(async () => {
    await sim?.sql.stop();
  });

  it('dumps schema + data that survive a restore, including tricky values', async () => {
    sim = createSimulator();
    await sim.sql.start();
    await sim.sql.executeMultiStatement(`
      CREATE TABLE tricky (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100),
        meta JSON,
        blob_col VARBINARY(16),
        created DATETIME
      );
      INSERT INTO tricky (name, meta, blob_col, created) VALUES
        ('O''Brien', '{"tags":["a","b"]}', X'CAFE', '2026-07-17 06:07:08'),
        (NULL, NULL, NULL, NULL);
      CREATE TABLE empty_table (id INT PRIMARY KEY);
    `);

    const config = sim.sql.getConnectionConfig()!;
    const dump = await dumpDatabase(config);

    // Schema for both tables, DROP-guarded
    expect(dump).toContain('DROP TABLE IF EXISTS `tricky`;');
    expect(dump).toContain('CREATE TABLE `tricky`');
    expect(dump).toContain('DROP TABLE IF EXISTS `empty_table`;');
    // Data only for the non-empty table
    expect(dump).toContain('INSERT INTO `tricky`');
    expect(dump).not.toContain('INSERT INTO `empty_table`');
    // Tricky values made it into literals
    expect(dump).toContain("O\\'Brien");
    expect(dump).toContain("X'cafe'");
    expect(dump).toContain('2026-07-17 06:07:08');

    // Round trip: wipe and replay the dump on the same server
    await sim.sql.reset();
    await sim.sql.executeMultiStatement(dump);

    const rows = await sim.sql.query<any>('SELECT * FROM tricky ORDER BY id');
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("O'Brien");
    expect(JSON.parse(JSON.stringify(rows[0].meta))).toEqual({ tags: ['a', 'b'] });
    expect(Buffer.from(rows[0].blob_col).toString('hex')).toBe('cafe');
    expect(rows[1].name).toBeNull();

    const empty = await sim.sql.query<any>('SELECT * FROM empty_table');
    expect(empty).toHaveLength(0);
  }, 120_000);
});
