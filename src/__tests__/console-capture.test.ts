/**
 * Tests for console-capture — particularly its reentrancy behavior, which
 * matters when a Forge handler calls another handler (e.g. resolver →
 * appEvents.publish → trigger handler), causing capture scopes to nest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  withCapture,
  startCapture,
  stopCapture,
  __resetCaptureForTests,
} from '../console-capture.js';

describe('console-capture', () => {
  // Track that `console.log` was restored after captures drain.
  let originalLog: typeof console.log;

  beforeEach(() => {
    originalLog = console.log;
  });

  afterEach(() => {
    __resetCaptureForTests();
    // Should be back to whatever it was before the test
    expect(console.log).toBe(originalLog);
  });

  it('captures basic console output during a single scope', async () => {
    const { console: lines } = await withCapture(async () => {
      console.log('hello');
      console.warn('careful');
      console.error('boom');
    });
    expect(lines.map(l => l.message)).toEqual(['hello', 'careful', 'boom']);
    expect(lines.map(l => l.level)).toEqual(['log', 'warn', 'error']);
  });

  it('restores console.log after capture stops', async () => {
    const before = console.log;
    await withCapture(async () => {
      // patched during this block
      expect(console.log).not.toBe(before);
    });
    expect(console.log).toBe(before);
  });

  describe('nested withCapture (regression: reentrancy bug)', () => {
    it('captures outer logs that occur AFTER an inner capture returns', async () => {
      const { console: outerLines } = await withCapture(async () => {
        console.log('outer-before');
        await withCapture(async () => {
          console.log('inner-1');
        });
        // BUG: pre-fix, this line was lost because stopCapture restored
        // console immediately when the inner scope ended.
        console.log('outer-after');
      });

      // Outer scope sees its own direct logs, NOT the inner scope's logs.
      expect(outerLines.map(l => l.message)).toEqual([
        'outer-before',
        'outer-after',
      ]);
    });

    it('inner capture sees only inner logs, not outer logs', async () => {
      let innerLines: string[] = [];

      await withCapture(async () => {
        console.log('outer-before');
        const inner = await withCapture(async () => {
          console.log('inner-1');
          console.log('inner-2');
        });
        innerLines = inner.console.map(l => l.message);
        console.log('outer-after');
      });

      expect(innerLines).toEqual(['inner-1', 'inner-2']);
    });

    it('handles three-deep nesting without losing or duplicating lines', async () => {
      const { console: outerLines } = await withCapture(async () => {
        console.log('A');
        const mid = await withCapture(async () => {
          console.log('B');
          const deep = await withCapture(async () => {
            console.log('C');
          });
          expect(deep.console.map(l => l.message)).toEqual(['C']);
          console.log('D');
        });
        expect(mid.console.map(l => l.message)).toEqual(['B', 'D']);
        console.log('E');
      });
      expect(outerLines.map(l => l.message)).toEqual(['A', 'E']);
    });

    it('restores console after error propagates through nested captures', async () => {
      const before = console.log;

      await expect(async () => {
        await withCapture(async () => {
          await withCapture(async () => {
            throw new Error('inner-fail');
          });
        });
      }).rejects.toThrow('inner-fail');

      expect(console.log).toBe(before);
    });

    it('attaches captured console to thrown errors at every level', async () => {
      const innerErr: any = await withCapture(async () => {
        try {
          await withCapture(async () => {
            console.log('about-to-throw');
            throw new Error('inner-fail');
          });
        } catch (err) {
          return err;
        }
      });

      // The thrown error from inner scope carries its captured console
      const captured = (innerErr.result as any).capturedConsole;
      expect(captured).toBeDefined();
      expect(captured.map((l: any) => l.message)).toEqual(['about-to-throw']);
    });
  });

  describe('startCapture / stopCapture (low-level API)', () => {
    it('returns empty array when no capture is active', () => {
      expect(stopCapture()).toEqual([]);
    });

    it('supports manual stack management', () => {
      startCapture();
      console.log('a');
      startCapture();
      console.log('b');
      const inner = stopCapture();
      console.log('c');
      const outer = stopCapture();

      expect(inner.map(l => l.message)).toEqual(['b']);
      expect(outer.map(l => l.message)).toEqual(['a', 'c']);
    });
  });

  describe('argument rendering (eval-6 F7)', () => {
    it('renders a top-level Error as its stack, not "{}"', async () => {
      const { console: lines } = await withCapture(async () => {
        console.error(new Error('database connection refused'));
      });
      // Pre-fix: JSON.stringify(err) → "{}" because Error props are
      // non-enumerable. Now it renders like Node's console: the stack
      // string, which starts "Error: <message>".
      expect(lines[0].message).toContain('Error: database connection refused');
      expect(lines[0].message).toContain('console-capture.test.ts');
      expect(lines[0].message).not.toBe('{}');
    });

    it('surfaces Errors nested inside objects', async () => {
      const { console: lines } = await withCapture(async () => {
        console.error('handler failed:', { err: new Error('boom'), retries: 3 });
      });
      const msg = lines[0].message;
      expect(msg).toContain('handler failed:');
      expect(msg).toContain('"message": "boom"');
      expect(msg).toContain('"stack"');
      expect(msg).toContain('"retries": 3');
    });

    it('includes Error cause when present', async () => {
      const { console: lines } = await withCapture(async () => {
        console.error({ err: new Error('outer', { cause: 'ETIMEDOUT' }) });
      });
      expect(lines[0].message).toContain('"cause": "ETIMEDOUT"');
    });

    it('never throws into app code on unserializable args', async () => {
      const circular: any = { name: 'loop' };
      circular.self = circular;

      const { console: lines } = await withCapture(async () => {
        // Pre-fix latent bomb: JSON.stringify throws on circular refs and
        // BigInt — inside the patched console, i.e. INTO the app's code.
        console.log(circular);
        console.log(123n);
      });

      expect(lines).toHaveLength(2);
      expect(lines[0].message).toBe('[object Object]');
      expect(lines[1].message).toBe('123');
    });
  });

  describe('passthrough to real console', () => {
    it('still calls the real (pre-patch) console.log', async () => {
      // Replace console.log with our spy BEFORE startCapture, so the spy
      // becomes the "original" that the wrapper passes through to.
      const originalForSpy = console.log;
      const spy = vi.fn();
      console.log = spy;
      try {
        await withCapture(async () => {
          console.log('passthrough-test');
        });
        expect(spy).toHaveBeenCalledWith('passthrough-test');
      } finally {
        console.log = originalForSpy;
      }
    });
  });
});
