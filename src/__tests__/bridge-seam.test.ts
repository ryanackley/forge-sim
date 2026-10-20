/**
 * `globalThis.__bridge` is a platform seam, present before any app code runs
 * — Phase 4a of the bare-seam migration. The real `@forge/bridge` captures it
 * at module evaluation: `getCallBridge()` in
 * node_modules/@forge/bridge/out/bridge.js throws BridgeAPIError if
 * `globalThis.__bridge.callBridge` is missing, and ~25 of its modules call it
 * in a top-level `const callBridge = getCallBridge()`. So the seam must exist
 * from the moment a ForgeSimulator does, not from the first render.
 *
 * Only the REAL package proves the real path (lesson #5): the in-process
 * checks use createRequire (CJS bypasses the vitest alias to the shim), and
 * the spawned-node checks run plain `node` against dist/ with no loader at
 * all — the same way the loader-hooks facade E2Es do.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createSimulator } from '../simulator.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);

/** Run an ESM script under plain node from the repo root; returns the last stdout line parsed as JSON. */
function spawnNode(lines: string[], tag: string): Record<string, unknown> {
  const scriptPath = join(REPO_ROOT, `.tmp-bridge-seam-${tag}-${process.pid}.mjs`);
  writeFileSync(scriptPath, lines.join('\n'));
  try {
    const out = execFileSync(process.execPath, [scriptPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out.trim().split('\n').pop()!);
  } finally {
    rmSync(scriptPath, { force: true });
  }
}

describe('globalThis.__bridge is installed by the ForgeSimulator constructor', () => {
  it('is present, with a callable callBridge, before any render', () => {
    createSimulator();
    const bridge = (globalThis as any).__bridge;
    expect(typeof bridge?.callBridge).toBe('function');
    // The real package also reads it off `window` in some paths; both must agree.
    expect((globalThis as any).window.__bridge).toBe(bridge);
  });

  it('the REAL @forge/bridge evaluates and answers a frame, with no sim.ui.render() involved', async () => {
    const sim = createSimulator();
    // CJS require → the real package, not the aliased shim. It captures
    // globalThis.__bridge NOW, at evaluation.
    const bridge = require('@forge/bridge') as typeof import('@forge/bridge');
    expect(typeof bridge.invoke).toBe('function');
    // A real frame through the real package → dispatcher → headless host.
    // No context has been set, so the host answers the default context.
    const ctx = await bridge.view.getContext();
    expect(ctx).toMatchObject({ localId: expect.any(String) });
    expect(sim.ui.getBridgeCalls().some((c) => c.cmd === 'getContext')).toBe(true);
  });
});

describe('plain node, no loader (dist/)', () => {
  const distReady = existsSync(join(REPO_ROOT, 'dist', 'simulator.js'));

  it.skipIf(!distReady)('import @forge/bridge after constructing a sim: evaluates and answers', () => {
    const result = spawnNode([
      `import { createSimulator } from './dist/simulator.js';`,
      `import { createRequire } from 'node:module';`,
      `const sim = createSimulator();`,
      `const bridge = createRequire(import.meta.url)('@forge/bridge');`,
      `const ctx = await bridge.view.getContext();`,
      `console.log(JSON.stringify({`,
      `  seam: typeof globalThis.__bridge?.callBridge,`,
      `  invoke: typeof bridge.invoke,`,
      `  localId: typeof ctx?.localId,`,
      `}));`,
    ], 'with-sim');
    expect(result).toEqual({ seam: 'function', invoke: 'function', localId: 'string' });
  });

  it.skipIf(!distReady)('negative control: without a sim the real package throws at import (so the pin above is load-bearing)', () => {
    const result = spawnNode([
      `import { createRequire } from 'node:module';`,
      `let name = null, message = '';`,
      `try { createRequire(import.meta.url)('@forge/bridge'); }`,
      `catch (e) { name = e.constructor.name; message = e.message; }`,
      `console.log(JSON.stringify({ seam: typeof globalThis.__bridge, name, mentionsBridge: /Custom UI bridge/.test(message) }));`,
    ], 'no-sim');
    // node_modules/@forge/bridge/out/bridge.js getCallBridge → BridgeAPIError
    expect(result).toEqual({ seam: 'undefined', name: 'BridgeAPIError', mentionsBridge: true });
  });
});
