/**
 * End-to-end test: real @forge/sql package through the full shim chain.
 * 
 * @forge/sql → @forge/api (real CJS) → global.__forge_fetch__ → SimulatedForgeSQL → MySQL
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ForgeSimulator, setSimulator } from '../simulator.js';

// These will be dynamically imported since they need the global hooks set up first
let sql: any;
let migrationRunner: any;

describe('Forge SQL E2E (@forge/sql → MySQL)', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.sql.start();

    // Import the real @forge/sql — it uses require('@forge/api') internally
    // which hits global.__forge_fetch__ installed by setSimulator()
    const forgeSql = await import('@forge/sql');
    sql = forgeSql.sql;
    migrationRunner = forgeSql.migrationRunner;
  }, 60_000);

  afterAll(async () => {
    await sim.stop();
  }, 30_000);

  it('should run migrations', async () => {
    migrationRunner
      .enqueue('001_create_posts', `
        CREATE TABLE posts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          body TEXT,
          author VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      .enqueue('002_add_tags', 'ALTER TABLE posts ADD COLUMN tags JSON');

    const ran = await migrationRunner.run();
    expect(ran).toEqual(['001_create_posts', '002_add_tags']);

    // Running again should be idempotent
    const ranAgain = await migrationRunner.run();
    expect(ranAgain).toEqual([]);
  });

  it('should list migrations', async () => {
    const list = await migrationRunner.list();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('001_create_posts');
    expect(list[1].name).toBe('002_add_tags');
    expect(list[0].migratedAt).toBeInstanceOf(Date);
  });

  it('should insert and query with prepare/bindParams', async () => {
    await sql.prepare('INSERT INTO posts (title, body, author, tags) VALUES (?, ?, ?, ?)')
      .bindParams('Hello World', 'First post!', 'Ryan', JSON.stringify(['intro', 'test']))
      .execute();

    await sql.prepare('INSERT INTO posts (title, body, author, tags) VALUES (?, ?, ?, ?)')
      .bindParams('Forge SQL Works', 'Real MySQL baby', 'Nyx', JSON.stringify(['forge', 'sql']))
      .execute();

    const result = await sql.prepare('SELECT * FROM posts ORDER BY id').execute();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].title).toBe('Hello World');
    expect(result.rows[1].author).toBe('Nyx');
  });

  it('should return metadata with column types', async () => {
    const result = await sql.prepare('SELECT id, title, created_at FROM posts LIMIT 1').execute();
    expect(result.metadata).toBeDefined();
    // metadata should have column info
    expect(result.metadata.id).toBeDefined();
    expect(result.metadata.title).toBeDefined();
  });

  it('should handle INSERT/UPDATE returning affected rows', async () => {
    const updateResult = await sql.prepare('UPDATE posts SET body = ? WHERE author = ?')
      .bindParams('Updated!', 'Ryan')
      .execute();
    expect(updateResult.rows.affectedRows).toBe(1);
  });

  it('should work with executeRaw', async () => {
    const result = await sql.executeRaw('SELECT COUNT(*) as total FROM posts');
    expect(result.rows[0].total).toBe(2);
  });

  it('should handle SQL errors gracefully', async () => {
    await expect(
      sql.executeRaw('SELECT * FROM nonexistent_table_xyz')
    ).rejects.toThrow();
  });

  it('should support JSON queries (MySQL-native)', async () => {
    const result = await sql.prepare(
      "SELECT title, JSON_EXTRACT(tags, '$[0]') as first_tag FROM posts WHERE JSON_CONTAINS(tags, '\"forge\"')"
    ).execute();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('Forge SQL Works');
  });

  it('should support transactions via executeRaw', async () => {
    await sql.executeRaw('START TRANSACTION');
    await sql.prepare('INSERT INTO posts (title, author) VALUES (?, ?)')
      .bindParams('Will be rolled back', 'Ghost')
      .execute();
    await sql.executeRaw('ROLLBACK');

    const result = await sql.executeRaw('SELECT COUNT(*) as total FROM posts');
    expect(result.rows[0].total).toBe(2); // Still 2, rollback worked
  });
});
