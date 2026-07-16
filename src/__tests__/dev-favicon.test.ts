/**
 * Publish-gate F7 — the dev server 404'd on /favicon.ico, the single red
 * line in an otherwise clean browser console. `serveFavicon` handles the
 * request from the forge middleware.
 */
import { describe, it, expect, vi } from 'vitest';
import { serveFavicon, FAVICON_SVG } from '../dev-command.js';

function mockRes() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; },
    writeHead(code: number) { this.statusCode = code; },
    end(body?: string) { this.body = body ?? ''; },
  };
}

describe('dev server favicon (F7)', () => {
  it('serves /favicon.ico with an SVG payload and cache headers', () => {
    const res = mockRes();
    const handled = serveFavicon('/favicon.ico', res);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/svg+xml');
    expect(res.headers['Cache-Control']).toContain('max-age');
    expect(res.body).toBe(FAVICON_SVG);
    expect(res.body).toContain('<svg');
  });

  it('serves /favicon.svg too', () => {
    const res = mockRes();
    expect(serveFavicon('/favicon.svg', res)).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('passes through every other path untouched', () => {
    const res = mockRes();
    const end = vi.spyOn(res, 'end');
    expect(serveFavicon('/', res)).toBe(false);
    expect(serveFavicon('/module/panel/', res)).toBe(false);
    expect(serveFavicon('/favicon.png', res)).toBe(false);
    expect(end).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});
