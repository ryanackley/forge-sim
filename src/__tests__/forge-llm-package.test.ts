/**
 * Behaviors of the REAL `@forge/llm` that apps depend on.
 *
 * Apps run the real package now — forge-sim serves its I/O at the
 * `__forge_fetch__` seam (`type: 'llm'`) instead of aliasing the import
 * (bare-seam migration, phase 3b). `seam-fetch.test.ts` covers the wire side
 * (chat / list / streaming through the seam); this file covers the half that
 * never reaches the seam at all.
 *
 * That half is the point of the flip. The old shim forwarded straight to
 * `sim.llm` with NO validation, so a prompt the platform rejects — no model,
 * no messages, temperature out of range — succeeded in the sim and threw in
 * Forge. Silently succeeding where Forge would fail is the parity violation
 * CLAUDE.md names first; running the real package fixes it by construction.
 *
 * Version pinned by VERIFIED_FORGE_VERSIONS (`@forge/llm`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

// CJS require bypasses any vitest alias — this is the real published package.
// It also reads `__getRuntime().tracing` in a class-field initializer at
// module scope, so a simulator must exist before the first require().
const require = createRequire(import.meta.url);

describe('real @forge/llm — client-side prompt validation', () => {
  let sim: ForgeSimulator;
  let llm: any;

  beforeAll(() => {
    sim = createSimulator();
    llm = require('@forge/llm');
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('rejects a prompt with no model (the shim accepted this)', async () => {
    await expect(
      llm.chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/Model is required/);
  });

  it('rejects a prompt with no messages', async () => {
    await expect(llm.chat({ model: 'claude-sonnet-4-5' })).rejects.toThrow(
      /No messages were provided/,
    );
  });

  it('rejects an out-of-range temperature', async () => {
    await expect(
      llm.chat({
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 5,
      }),
    ).rejects.toThrow(/Temperature must be between 0 and 1/);
  });

  it('rejects a non-object prompt', async () => {
    await expect(llm.chat(undefined)).rejects.toThrow(/Prompt is required/);
  });

  it('throws PromptValidationError, which apps can catch by class', async () => {
    const err = await llm.chat({ model: 'm' }).then(
      () => null,
      (e: Error) => e,
    );
    // Both classes are the REAL ones now, so an app's `instanceof` check
    // against its own @forge/llm import matches what the sim raises.
    expect(err).toBeInstanceOf(llm.PromptValidationError);
    expect(err).toBeInstanceOf(llm.ForgeLlmError);
    expect(err).toBeInstanceOf(Error);
  });

  it('validation happens before any I/O — no mock is consumed', async () => {
    sim.llm.mockResponse({ content: 'should survive' });
    await expect(llm.chat({ model: '', messages: [] })).rejects.toThrow();
    // The queued mock is still pending: the request never reached the seam.
    expect(sim.llm.getPendingMockCount()).toBe(1);

    const ok = await llm.chat({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(ok.choices[0].message.content).toEqual([{ type: 'text', text: 'should survive' }]);
    expect(sim.llm.getPendingMockCount()).toBe(0);
  });
});
