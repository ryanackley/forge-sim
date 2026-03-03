/**
 * ForgeSimShell — the top-level wrapper for forge-sim dev mode.
 *
 * This component lives in the renderer source directory so that all Atlaskit
 * imports resolve from renderer/node_modules (where they're installed).
 *
 * The generated entry.tsx imports this shell, which handles:
 *   - Atlaskit AppProvider + CSS reset
 *   - Listening for ForgeDoc from the bridge shim (useBrowserDoc)
 *   - Rendering ForgeDoc via ForgeDocRenderer
 */

import React, { useState, useEffect } from 'react';
import AppProvider from '@atlaskit/app-provider';
import '@atlaskit/css-reset';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { onReconcile } from './bridge/forge-bridge-shim';

export function ForgeSimShell() {
  const [doc, setDoc] = useState<any>(null);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    const unbind = onReconcile((forgeDoc: any) => {
      setDoc(forgeDoc);
      setRenderCount((n) => n + 1);
    });
    return unbind;
  }, []);

  if (!doc) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#6b778c',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading Forge app...</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Waiting for ForgeReconciler.render() to produce a ForgeDoc
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppProvider defaultColorMode="light">
      <div style={{
        maxWidth: '900px',
        margin: '24px auto',
        padding: '24px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minHeight: '200px',
      }}>
        <ForgeDocRenderer doc={doc} />
      </div>
      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        background: '#172b4d',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        opacity: 0.8,
      }}>
        🔥 forge-sim • renders: {renderCount}
      </div>
    </AppProvider>
  );
}
