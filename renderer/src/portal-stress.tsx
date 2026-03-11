/**
 * Portal Stress Test
 *
 * Renders a Tooltip through ForgeDocRenderer and rapidly re-sets the
 * ForgeDoc tree on a timer — simulating what happens when the WebSocket
 * pushes new docs during normal Forge app usage.
 *
 * Test procedure:
 *   1. Open http://localhost:5173/portal-stress.html
 *   2. Hover the "Hover me" button — tooltip should appear
 *   3. With tooltip showing, watch the counter increment (doc churn)
 *   4. Unhover — tooltip should fade out cleanly (no blip)
 *   5. Hover again, then scroll the page — should NOT crash
 *   6. Check console for removeChild errors
 *
 * If the renderer is rebuilding the tree from scratch on each doc update,
 * you'll see:
 *   - Tooltip blipping/flickering on hover
 *   - "removeChild" portal errors on scroll
 *   - Entire page going blank after the error
 *
 * After fixing the renderer with stable components, all of the above
 * should be gone.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import type { ForgeDoc } from './types';

import '@atlaskit/css-reset';

function makePortalStressDoc(counter: number): ForgeDoc {
  return {
    type: 'App',
    props: {},
    key: 'root',
    children: [
      {
        type: 'Stack',
        props: {},
        key: 'stack-1',
        children: [
          {
            type: 'Text',
            props: {},
            key: 'counter-text',
            children: [
              { type: 'String', props: { text: `Doc update #${counter}` }, key: 'counter-str', children: [] },
            ],
          },
          {
            type: 'Tooltip',
            props: { content: 'Hello from tooltip!' },
            key: 'tooltip-1',
            children: [
              {
                type: 'Button',
                props: { appearance: 'primary' },
                key: 'tooltip-btn',
                children: [
                  { type: 'String', props: { text: 'Hover me for tooltip' }, key: 'tooltip-btn-s', children: [] },
                ],
              },
            ],
          },
          {
            type: 'Text',
            props: {},
            key: 'spacer-text',
            children: [
              { type: 'String', props: { text: 'Scroll down to test portal survival during scroll...' }, key: 'spacer-s', children: [] },
            ],
          },
        ],
      },
    ],
  };
}

function PortalStressTest() {
  const [counter, setCounter] = useState(0);
  const [churning, setChurning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(500);
  const [errors, setErrors] = useState<string[]>([]);
  const errorCountRef = useRef(0);

  // Listen for uncaught errors (portal crashes)
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const msg = event.message || String(event.error);
      if (msg.includes('removeChild') || msg.includes('NotFoundError')) {
        errorCountRef.current++;
        setErrors((prev) => [
          `[${new Date().toLocaleTimeString()}] 💥 PORTAL CRASH: ${msg}`,
          ...prev,
        ].slice(0, 20));
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  // Churn timer — simulates WebSocket ForgeDoc pushes
  useEffect(() => {
    if (!churning) return;
    const id = setInterval(() => {
      setCounter((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [churning, intervalMs]);

  // Build a fresh ForgeDoc on every counter change (this is the key —
  // a new object reference each time, just like WebSocket would deliver)
  const doc = makePortalStressDoc(counter);

  const handleEvent = useCallback(() => {}, []);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Control panel */}
      <div
        id="control-panel"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '13px',
          borderBottom: '2px solid #333',
        }}
      >
        <strong style={{ color: '#ff991f' }}>🧪 Portal Stress Test</strong>

        <button
          id="toggle-churn"
          onClick={() => setChurning(!churning)}
          style={{
            padding: '4px 12px',
            background: churning ? '#de350b' : '#36b37e',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {churning ? '⏸ Stop Churn' : '▶ Start Churn'}
        </button>

        <button
          id="single-update"
          onClick={() => setCounter((n) => n + 1)}
          style={{
            padding: '4px 12px',
            background: '#0052cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Single Update
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Interval:
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', padding: '2px 6px' }}
          >
            <option value={100}>100ms (aggressive)</option>
            <option value={250}>250ms</option>
            <option value={500}>500ms (default)</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s (gentle)</option>
          </select>
        </label>

        <span id="update-counter" style={{ color: '#6b778c' }}>
          Updates: <strong style={{ color: '#fff' }}>{counter}</strong>
        </span>

        <span
          id="error-counter"
          style={{ color: errors.length > 0 ? '#de350b' : '#36b37e', fontWeight: 600 }}
        >
          {errors.length > 0 ? `💥 ${errors.length} portal errors` : '✅ No errors'}
        </span>
      </div>

      {/* Rendered content — in a scrollable container like App.tsx does */}
      <div style={{ padding: '24px', background: '#f4f5f7', minHeight: 'calc(100vh - 48px)' }}>
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: '0 0 16px', color: '#172b4d' }}>
            ForgeDoc Renderer Output
          </h3>

          <ForgeDocRenderer doc={doc} onEvent={handleEvent} />

          {/* Extra content to make the page scrollable */}
          <div style={{ marginTop: '40px' }}>
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i} style={{ color: '#6b778c', margin: '12px 0' }}>
                Filler paragraph #{i + 1} — scroll while hovering the tooltip button above to test portal survival.
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Error log */}
      {errors.length > 0 && (
        <div
          id="error-log"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            background: '#1a0000',
            color: '#ff5630',
            padding: '12px 20px',
            fontFamily: 'monospace',
            fontSize: '12px',
            borderTop: '2px solid #de350b',
          }}
        >
          <strong>Portal Errors:</strong>
          {errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('app')!).render(<PortalStressTest />);
