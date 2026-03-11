/**
 * Popup Isolation Test
 *
 * Three panels:
 *   1. Raw Atlaskit Popup (no ForgeDocRenderer)
 *   2. Popup through ForgeDocRenderer
 *   3. StrictMode toggle
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Popup from '@atlaskit/popup';
import Button from '@atlaskit/button/new';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import type { ForgeDoc } from './types';

import '@atlaskit/css-reset';

// ── Raw Atlaskit Popup (control) ────────────────────────────────────────

function RawPopup() {
  const [open, setOpen] = useState(false);
  return (
    <Popup
      isOpen={open}
      onClose={() => setOpen(false)}
      placement="bottom-start"
      content={() => (
        <div style={{ padding: '16px' }}>Hello from raw Atlaskit Popup!</div>
      )}
      trigger={(triggerProps) => (
        <Button {...triggerProps} appearance="primary" onClick={() => setOpen(!open)}>
          Raw Atlaskit Popup
        </Button>
      )}
    />
  );
}

// ── ForgeDoc with Popup ─────────────────────────────────────────────────

const popupDoc: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.200' },
      key: 'stack-1',
      children: [
        {
          type: 'Popup',
          props: { placement: 'bottom-start', triggerText: 'ForgeDoc Popup' },
          key: 'popup-1',
          children: [
            {
              type: 'Text',
              props: {},
              key: 'popup-content',
              children: [
                { type: 'String', props: { text: 'Hello from ForgeDoc Popup!' }, key: 'popup-s', children: [] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ── App ─────────────────────────────────────────────────────────────────

function App() {
  const [strict, setStrict] = useState(true);

  const content = (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', padding: '24px' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        padding: '8px 20px', background: strict ? '#de350b' : '#36b37e',
        color: '#fff', fontWeight: 600, fontSize: '14px', zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={strict} onChange={() => setStrict(!strict)} />
          React.StrictMode {strict ? 'ON' : 'OFF'}
        </label>
      </div>

      <div style={{ marginTop: '50px', display: 'flex', gap: '40px' }}>
        {/* Panel 1: Raw Atlaskit */}
        <div style={{
          flex: 1, padding: '24px', background: '#fff',
          borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#172b4d' }}>1. Raw Atlaskit</h3>
          <RawPopup />
        </div>

        {/* Panel 2: Through ForgeDocRenderer */}
        <div style={{
          flex: 1, padding: '24px', background: '#fff',
          borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#172b4d' }}>2. ForgeDocRenderer</h3>
          <ForgeDocRenderer doc={popupDoc} />
        </div>
      </div>
    </div>
  );

  return strict
    ? <React.StrictMode>{content}</React.StrictMode>
    : content;
}

createRoot(document.getElementById('app')!).render(<App />);
