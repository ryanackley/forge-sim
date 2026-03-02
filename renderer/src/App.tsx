/**
 * Test Harness — renders sample ForgeDoc trees with the UIKit renderer.
 * This is our proof-of-concept app for verifying the ForgeDoc → Atlaskit mapping.
 */

import React, { useState } from 'react';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { ALL_SAMPLES } from './sample-docs';

import '@atlaskit/css-reset';

const sampleNames = Object.keys(ALL_SAMPLES);

export function App() {
  const [activeSample, setActiveSample] = useState(sampleNames[0]);
  const [showJson, setShowJson] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const doc = ALL_SAMPLES[activeSample];

  const handleEvent = (handlerId: string, eventName: string, ...args: any[]) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${eventName} → ${handlerId}`;
    setEventLog((prev) => [entry, ...prev].slice(0, 50));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '240px',
          borderRight: '1px solid #dfe1e6',
          padding: '16px',
          background: '#fafbfc',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#172b4d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔥 ForgeDoc Renderer
        </h3>

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

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={showJson} onChange={(e) => setShowJson(e.target.checked)} />
            Show ForgeDoc JSON
          </label>
        </div>

        {/* Event Log */}
        <div>
          <div style={{ fontSize: '11px', color: '#6b778c', marginBottom: '8px', textTransform: 'uppercase' }}>Event Log</div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
            {eventLog.length === 0 ? (
              <span style={{ color: '#97a0af' }}>Click buttons to see events...</span>
            ) : (
              eventLog.map((entry, i) => (
                <div key={i} style={{ padding: '2px 0', color: '#505f79' }}>
                  {entry}
                </div>
              ))
            )}
          </div>
          {eventLog.length > 0 && (
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
          <span>Rendering: <strong style={{ color: '#172b4d' }}>{activeSample}</strong></span>
          <span>•</span>
          <span>{countNodes(doc)} nodes</span>
          <span>•</span>
          <span>{countTypes(doc)} component types</span>
        </div>

        {/* Rendered output */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              padding: '24px',
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <ForgeDocRenderer doc={doc} onEvent={handleEvent} />
          </div>
        </div>

        {/* JSON panel */}
        {showJson && (
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
    </div>
  );
}

/** Count total nodes in a ForgeDoc tree */
function countNodes(doc: any): number {
  let count = 1;
  for (const child of doc.children ?? []) {
    count += countNodes(child);
  }
  return count;
}

/** Count unique component types in a ForgeDoc tree */
function countTypes(doc: any): number {
  const types = new Set<string>();
  function walk(node: any) {
    types.add(node.type);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return types.size;
}

/** JSON replacer that handles functions */
function replacer(key: string, value: any) {
  if (typeof value === 'function') return `[Function: ${value.__id__ ?? key}]`;
  return value;
}
