import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react auto-cleanup requires globals: true in vitest;
// since we use explicit imports, wire it up manually.
afterEach(() => cleanup());

// Mock window.matchMedia — required by Atlaskit theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver — required by recharts ResponsiveContainer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

// Mock IntersectionObserver — required by @atlaskit/width-detector (used by @atlaskit/renderer)
class IntersectionObserverMock {
  constructor(_cb: any, _opts?: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserverMock as any;

// Mock WebSocket — Node 25's undici WebSocket has a cross-realm Event issue
// in jsdom that surfaces as "Uncaught Exception: TypeError: The 'event' argument
// must be an instance of Event. Received an instance of Event". The bridge shim
// auto-connects on import; without a mock, the connection attempt blows up.
// Tests that need WebSocket behavior should override this locally.
class WebSocketMock {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 0;
  url: string;
  // No-op event handlers
  onopen: ((e: any) => void) | null = null;
  onmessage: ((e: any) => void) | null = null;
  onclose: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  send() {}
  close() {
    this.readyState = WebSocketMock.CLOSED;
  }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}
globalThis.WebSocket = WebSocketMock as any;
