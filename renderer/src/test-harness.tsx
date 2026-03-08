/**
 * Minimal test harness for Playwright e2e tests.
 *
 * Renders a single ForgeDoc fixture selected by URL hash:
 *   http://localhost:5173/test-harness.html#dynamic-table-basic
 *
 * Events are logged to a DOM element (#event-log) so Playwright can assert on them.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { TEST_FIXTURES } from './test-fixtures';

import '@atlaskit/css-reset';

function TestHarness() {
  const [fixtureName, setFixtureName] = useState(
    window.location.hash.slice(1) || Object.keys(TEST_FIXTURES)[0]
  );
  const [eventLog, setEventLog] = useState<string[]>([]);

  useEffect(() => {
    const onHash = () => setFixtureName(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const doc = TEST_FIXTURES[fixtureName];

  const handleEvent = useCallback((handlerId: string, eventName: string) => {
    const entry = `${eventName}:${handlerId}`;
    setEventLog((prev) => [...prev, entry]);
  }, []);

  if (!doc) {
    return (
      <div id="test-error">
        Unknown fixture: {fixtureName}. Available: {Object.keys(TEST_FIXTURES).join(', ')}
      </div>
    );
  }

  return (
    <div>
      <div id="test-root" data-fixture={fixtureName}>
        <ForgeDocRenderer doc={doc} onEvent={handleEvent} />
      </div>
      <div id="event-log" data-events={JSON.stringify(eventLog)} style={{ display: 'none' }}>
        {eventLog.map((e, i) => (
          <div key={i} className="event-entry" data-event={e}>{e}</div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('app')!).render(<TestHarness />);
