/**
 * Test Harness — renders ForgeDoc trees with the UIKit renderer.
 *
 * Two modes:
 *   1. Sample mode — pick from built-in ForgeDoc samples
 *   2. Live mode — connect to forge-sim dev server via WebSocket for real-time updates
 */

import React, { useState, useCallback } from 'react';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { ALL_SAMPLES } from './sample-docs';
import { useLiveDoc, type ConnectionStatus } from './use-live-doc';

import '@atlaskit/css-reset';

const sampleNames = Object.keys(ALL_SAMPLES);

type Mode = 'samples' | 'live';

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connecting: '#ff991f',
  connected: '#36b37e',
  disconnected: '#6b778c',
  error: '#de350b',
};

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: '⏳ Connecting...',
  connected: '🟢 Connected',
  disconnected: '⚫ Disconnected',
  error: '🔴 Error',
};

export function App() {
  const [mode, setMode] = useState<Mode>('samples');
  const [activeSample, setActiveSample] = useState(sampleNames[0]);
  const [showJson, setShowJson] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [wsUrl, setWsUrl] = useState('ws://localhost:5174');

  const live = useLiveDoc({ url: wsUrl, autoReconnect: mode === 'live' });

  const doc = mode === 'live' ? live.doc : ALL_SAMPLES[activeSample];

  const handleEvent = useCallback((handlerId: string, eventName: string) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${eventName} → ${handlerId}`;
    setEventLog((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  /** Bridge event handler — sends events to forge-sim via WebSocket and logs result */
  const handleBridgeEvent = useCallback(async (handlerId: string, eventName: string, ...args: any[]) => {
    const entry = `[${new Date().toLocaleTimeString()}] ⚡ ${eventName} → ${handlerId}`;
    setEventLog((prev) => [entry, ...prev].slice(0, 50));

    const result = await live.sendEvent(handlerId, eventName, ...args);

    if (result.success) {
      const successEntry = `[${new Date().toLocaleTimeString()}] ✅ ${handlerId} completed`;
      setEventLog((prev) => [successEntry, ...prev].slice(0, 50));
    } else {
      const errorEntry = `[${new Date().toLocaleTimeString()}] ❌ ${handlerId}: ${result.error}`;
      setEventLog((prev) => [errorEntry, ...prev].slice(0, 50));
    }

    return result;
  }, [live.sendEvent]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid #dfe1e6',
          padding: '16px',
          background: '#fafbfc',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#172b4d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔥 ForgeDoc Renderer
        </h3>

        {/* Mode switcher */}
        <div style={{ display: 'flex', marginBottom: '16px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #dfe1e6' }}>
          {(['samples', 'live'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                background: mode === m ? '#0052cc' : '#fff',
                color: mode === m ? '#fff' : '#172b4d',
              }}
            >
              {m === 'samples' ? '📋 Samples' : '⚡ Live'}
            </button>
          ))}
        </div>

        {mode === 'samples' ? (
          /* Sample picker */
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: '#6b778c', marginBottom: '8px', textTransform: 'uppercase' }}>Samples</div>
            {sampleNames.map((name) => (
              <button
                key={name}
                onClick={() => setActiveSample(name)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  marginBottom: '4px',
                  border: 'none',
                  borderRadius: '4px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  background: activeSample === name ? '#0052cc' : 'transparent',
                  color: activeSample === name ? '#fff' : '#172b4d',
                }}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          /* Live connection panel */
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: '#6b778c', marginBottom: '8px', textTransform: 'uppercase' }}>Dev Server</div>

            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #dfe1e6',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ fontSize: '13px', color: STATUS_COLORS[live.status], marginBottom: '8px', fontWeight: 600 }}>
              {STATUS_LABELS[live.status]}
            </div>

            {live.isReloading && (
              <div style={{
                fontSize: '12px',
                color: '#ff991f',
                padding: '6px 8px',
                background: '#fffae6',
                borderRadius: '4px',
                marginBottom: '8px',
              }}>
                🔄 Reloading{live.lastChangedFile ? `: ${live.lastChangedFile}` : '...'}
              </div>
            )}

            {live.lastError && (
              <div style={{
                fontSize: '12px',
                color: '#de350b',
                padding: '6px 8px',
                background: '#ffebe6',
                borderRadius: '4px',
                marginBottom: '8px',
              }}>
                ❌ {live.lastError}
              </div>
            )}

            {live.status === 'connected' && live.doc && (
              <div style={{ fontSize: '12px', color: '#36b37e' }}>
                📄 Receiving ForgeDoc updates
              </div>
            )}

            {live.status === 'disconnected' && (
              <div style={{ fontSize: '12px', color: '#6b778c' }}>
                Start forge-sim dev server to connect:
                <pre style={{ fontSize: '11px', background: '#f4f5f7', padding: '8px', borderRadius: '4px', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
{`import { createDevServer } from 'forge-sim';
const dev = createDevServer({
  watchDir: './my-app/src'
});`}
                </pre>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={showJson} onChange={(e) => setShowJson(e.target.checked)} />
            Show ForgeDoc JSON
          </label>
        </div>

        {/* Event Log */}
        <div>
          <div style={{ fontSize: '11px', color: '#6b778c', marginBottom: '8px', textTransform: 'uppercase' }}>
            {mode === 'live' ? 'Live Events' : 'Event Log'}
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
            {mode === 'live' && live.events.length > 0 ? (
              live.events.slice(0, 20).map((event, i) => (
                <div key={i} style={{ padding: '2px 0', color: '#505f79' }}>
                  [{new Date(event.timestamp).toLocaleTimeString()}] {event.type}
                  {event.file ? ` — ${event.file}` : ''}
                </div>
              ))
            ) : eventLog.length > 0 ? (
              eventLog.map((entry, i) => (
                <div key={i} style={{ padding: '2px 0', color: '#505f79' }}>
                  {entry}
                </div>
              ))
            ) : (
              <span style={{ color: '#97a0af' }}>
                {mode === 'live' ? 'Waiting for events...' : 'Click buttons to see events...'}
              </span>
            )}
          </div>
          {eventLog.length > 0 && mode === 'samples' && (
            <button
              onClick={() => setEventLog([])}
              style={{ marginTop: '8px', fontSize: '12px', color: '#6b778c', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear log
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid #dfe1e6',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px',
            color: '#6b778c',
          }}
        >
          {mode === 'live' ? (
            <>
              <span style={{ color: STATUS_COLORS[live.status] }}>●</span>
              <span>Live Preview</span>
              {live.doc && (
                <>
                  <span>•</span>
                  <span>{countNodes(live.doc)} nodes</span>
                  <span>•</span>
                  <span>{countTypes(live.doc)} component types</span>
                </>
              )}
              {live.pendingEvents > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: '#ff991f' }}>⏳ {live.pendingEvents} pending</span>
                </>
              )}
            </>
          ) : (
            <>
              <span>Rendering: <strong style={{ color: '#172b4d' }}>{activeSample}</strong></span>
              {doc && (
                <>
                  <span>•</span>
                  <span>{countNodes(doc)} nodes</span>
                  <span>•</span>
                  <span>{countTypes(doc)} component types</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Rendered output */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#f4f5f7' }}>
          {doc ? (
            <div
              style={{
                maxWidth: '800px',
                margin: '0 auto',
                padding: '24px',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                position: 'relative',
              }}
            >
              {live.isReloading && mode === 'live' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #0052cc 0%, #4c9aff 50%, #0052cc 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                  borderRadius: '8px 8px 0 0',
                }} />
              )}
              <ForgeDocRenderer
                doc={doc}
                onEvent={handleEvent}
                onBridgeEvent={mode === 'live' ? handleBridgeEvent : undefined}
              />
            </div>
          ) : (
            <div style={{
              maxWidth: '800px',
              margin: '100px auto',
              textAlign: 'center',
              color: '#6b778c',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                {mode === 'live' ? 'Waiting for ForgeDoc...' : 'No document selected'}
              </div>
              <div style={{ fontSize: '14px' }}>
                {mode === 'live'
                  ? 'Connect forge-sim dev server to start receiving live updates'
                  : 'Select a sample from the sidebar'}
              </div>
            </div>
          )}
        </div>

        {/* JSON panel */}
        {showJson && doc && (
          <div
            style={{
              height: '300px',
              borderTop: '1px solid #dfe1e6',
              overflow: 'auto',
              padding: '16px',
              background: '#1e1e1e',
              color: '#d4d4d4',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            <pre>{JSON.stringify(doc, replacer, 2)}</pre>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function countNodes(doc: any): number {
  let count = 1;
  for (const child of doc.children ?? []) count += countNodes(child);
  return count;
}

function countTypes(doc: any): number {
  const types = new Set<string>();
  function walk(node: any) {
    types.add(node.type);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return types.size;
}

function replacer(key: string, value: any) {
  if (typeof value === 'function') return `[Function: ${value.__id__ ?? key}]`;
  if (typeof value === 'string' && value.startsWith('__fn__:')) return `[Function: ${value.slice(7)}]`;
  return value;
}
