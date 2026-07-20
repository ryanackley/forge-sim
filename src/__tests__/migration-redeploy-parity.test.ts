/**
 * Characterization for the @forge/sql migrationRunner stale-singleton fix.
 *
 * Background: `@forge/sql`'s migrationRunner is a process-level module singleton
 * whose `enqueue(name, ddl)` dedups by name and DISCARDS a re-enqueue's new DDL.
 * In forge-sim's long-lived process this meant an edited migration DDL never
 * took effect across redeploys (killing the daemon was the only cure). deploy()
 * now clears that singleton — resolved from the APP's own directory — before
 * re-importing app code. See deployer.ts::clearMigrationRegistry.
 *
 * These tests pin three things the repro alone did not:
 *   A. IDENTITY: the fix reaches a real app's OWN node_modules/@forge/sql
 *      (a physically distinct module instance), not just the shared-node_modules
 *      case. This is the make-or-break risk — the app bundle resolves @forge/sql
 *      by walking up from appDir, and so must our clear.
 *   B. DX WIN: sim.reset() + redeploy of edited DDL lands the new schema (the
 *      forge_reset -> forge_deploy workflow, and the local "tweak until it lands
 *      without bumping version numbers" affordance).
 *   C. PARITY BOUNDARY: with the __migrations ledger intact (reset:false, no
 *      manual drop), an already-applied migration is NOT re-run even though its
 *      DDL changed — matching real Forge's persistent ledger. The fix enables
 *      re-landing only when the ledger permits it; it never silently re-runs an
 *      applied migration against live data.
 *
 * SQL tests are slow (mysql-memory-server cold start). Timeouts are generous.
 */
import { describe, it, afterEach, expect } from 'vitest';
import { createSimulator, type ForgeSimulator } from 'forge-sim';
import { mkdtemp, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';

const APP_ID = 'ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000000';

// Temp apps live INSIDE the project tree so bundled app code can resolve its
// dependencies by walking up to node_modules.
async function makeAppDir(): Promise<string> {
  const dir = await mkdtemp(join(process.cwd(), '.migreparity-tmp-'));
  await mkdir(join(dir, 'src'), { recursive: true });
  return dir;
}

async function writeApp(dir: string, manifest: string, index: string): Promise<void> {
  await writeFile(join(dir, 'manifest.yml'), manifest);
  await writeFile(join(dir, 'src', 'index.js'), index);
}

const MANIFEST = `
app:
  id: ${APP_ID}
  runtime: { name: nodejs22.x }
modules:
  scheduledTrigger:
    - { key: migrate, function: migrate, interval: hour }
  function:
    - { key: migrate, handler: index.migrate }
  sql:
    - { key: main, engine: mysql }
permissions: { scopes: [storage:app] }
`;

const indexWithCols = (cols: string) => `
import { migrationRunner } from '@forge/sql';
const migrations = migrationRunner.enqueue(
  'v001_create_widgets',
  'CREATE TABLE IF NOT EXISTS widgets (${cols})'
);
export const migrate = async () => {
  await migrations.run();
  return { statusCode: 200 };
};
`;

const cols = (r: any[]) => r.map((row) => row.Field);

let sim: ForgeSimulator | undefined;
let appDir: string | undefined;

afterEach(async () => {
  if (sim) await sim.stop();
  if (appDir) await rm(appDir, { recursive: true, force: true });
  sim = undefined;
  appDir = undefined;
});

describe('migrationRunner stale-singleton fix', () => {
  // A. The identity proof. Give the app its OWN physical copy of @forge/sql in
  //    appDir/node_modules, so its migrationRunner singleton is a DIFFERENT
  //    module object than the project's. If clearMigrationRegistry resolved
  //    @forge/sql from forge-sim instead of the app, it would clear the wrong
  //    instance and this test would still show the stale ['id','a'].
  it('lands edited DDL when the app has its OWN node_modules/@forge/sql (real-app identity)', async () => {
    appDir = await makeAppDir();

    // Physically copy the real @forge/sql into the app's node_modules — a
    // distinct absolute path -> a distinct require.cache entry -> a distinct
    // singleton from the project's copy.
    const projectForgeSql = dirname(
      createRequire(import.meta.url).resolve('@forge/sql/package.json')
    );
    await mkdir(join(appDir, 'node_modules', '@forge'), { recursive: true });
    await cp(projectForgeSql, join(appDir, 'node_modules', '@forge', 'sql'), {
      recursive: true,
    });

    sim = createSimulator();
    await sim.sql.start();

    // v1: widgets(id, a)
    await writeApp(appDir, MANIFEST, indexWithCols('id BIGINT PRIMARY KEY AUTO_INCREMENT, a INT'));
    await sim.deploy(appDir);
    await sim.fireScheduledTrigger('migrate');
    expect(cols(await sim.sql.query('SHOW COLUMNS FROM widgets'))).toEqual(['id', 'a']);

    // Edit DDL to add column b; redeploy; drop both tables (fresh ledger);
    // migrate. The app's OWN singleton must have been cleared for the new DDL
    // to land.
    await writeApp(appDir, MANIFEST, indexWithCols('id BIGINT PRIMARY KEY AUTO_INCREMENT, a INT, b INT'));
    await sim.deploy(appDir);
    await sim.sql.query('DROP TABLE IF EXISTS widgets');
    await sim.sql.query('DROP TABLE IF EXISTS __migrations');
    await sim.fireScheduledTrigger('migrate');

    expect(cols(await sim.sql.query('SHOW COLUMNS FROM widgets'))).toEqual(['id', 'a', 'b']);
  }, 120_000);

  // B. The DX workflow: sim.reset() drops the ledger + tables, and deploy()
  //    clears the singleton, so a redeploy of edited DDL lands the new schema.
  //    This is forge_reset -> forge_deploy, and the "tweak a migration until it
  //    lands without iterating version numbers" affordance.
  it('lands edited DDL after sim.reset() (the reset -> redeploy workflow)', async () => {
    appDir = await makeAppDir();
    sim = createSimulator();
    await sim.sql.start();

    await writeApp(appDir, MANIFEST, indexWithCols('id BIGINT PRIMARY KEY AUTO_INCREMENT, a INT'));
    await sim.deploy(appDir);
    await sim.fireScheduledTrigger('migrate');
    expect(cols(await sim.sql.query('SHOW COLUMNS FROM widgets'))).toEqual(['id', 'a']);

    await sim.reset();
    await sim.sql.start(); // reset() drops tables; restart backend for the next deploy

    await writeApp(appDir, MANIFEST, indexWithCols('id BIGINT PRIMARY KEY AUTO_INCREMENT, a INT, b INT'));
    await sim.deploy(appDir);
    await sim.fireScheduledTrigger('migrate');
    expect(cols(await sim.sql.query('SHOW COLUMNS FROM widgets'))).toEqual(['id', 'a', 'b']);
  }, 120_000);

  // C. The parity boundary. Ledger intact (no reset, no drop): an already-applied
  //    migration name is NOT re-run, even with edited DDL — real Forge's
  //    persistent __migrations ledger behaves identically. The fix must not turn
  //    every redeploy into a destructive re-migration of live data.
  it('does NOT re-run an already-applied migration when the ledger is intact (parity)', async () => {
    appDir = await makeAppDir();
    sim = createSimulator();
    await sim.sql.start();

    await writeApp(appDir, MANIFEST, indexWithCols('id BIGINT PRIMARY KEY AUTO_INCREMENT, a INT'));
    await sim.deploy(appDir);
    await sim.fireScheduledTrigger('migrate');
    // Seed a row so we can prove the table was not rebuilt.
    await sim.sql.query('INSERT INTO widgets (a) VALUES (42)');
    expect(cols(await sim.sql.query('SHOW COLUMNS FROM widgets'))).toEqual(['id', 'a']);

    // Edit DDL, redeploy WITHOUT reset and WITHOUT dropping __migrations.
    await writeApp(appDir, MANIFEST, indexWithCols('id BIGINT PRIMARY KEY AUTO_INCREMENT, a INT, b INT'));
    await sim.deploy(appDir);
    await sim.fireScheduledTrigger('migrate');

    // v001 is already in the ledger -> skipped. Schema unchanged, row preserved.
    expect(cols(await sim.sql.query('SHOW COLUMNS FROM widgets'))).toEqual(['id', 'a']);
    const rows = await sim.sql.query('SELECT a FROM widgets');
    expect(rows.map((r: any) => r.a)).toEqual([42]);
  }, 120_000);
});
