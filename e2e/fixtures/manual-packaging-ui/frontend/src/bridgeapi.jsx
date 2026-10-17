import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Button } from '@forge/react';
import { router, events, showFlag, view, realtime } from '@forge/bridge';

// Every call below goes through the REAL @forge/bridge, i.e. through
// window.__bridge.callBridge — the seam a prebuilt bundle can only reach
// that way. Each result is written into the rendered text so Playwright can
// assert on it.
const App = () => {
  const [log, setLog] = useState([]);
  const add = (s) => setLog((prev) => (prev.includes(s) ? prev : [...prev, s]));

  useEffect(() => {
    // router.getUrl — the real package requires a NavigationLocation with a
    // target and parses the result with new URL(), so the host must return an
    // absolute string. Resolves through callBridge('getUrl', location).
    router.getUrl({ target: 'issue', issueKey: 'TEST-1' })
      .then((u) => add('getUrl:' + (u ? String(u).replace(/^https?:\/\/[^/]+/, '') : 'null')))
      .catch((e) => add('getUrl-err:' + e.message));

    // events.on + events.emit — callBridge('on'|'emit')
    events.on('ping', (payload) => add('event:' + (payload && payload.n)))
      .then(() => events.emit('ping', { n: 7 }))
      .catch((e) => add('events-err:' + e.message));

    // view.getContext still works alongside the new commands
    view.getContext()
      .then((c) => add('ctx:' + (c && c.moduleKey)))
      .catch((e) => add('ctx-err:' + e.message));

    // realtime.subscribe — callBridge('subscribeRealtimeChannel')
    realtime.subscribe('room', (p) => add('rt:' + (p && p.v)))
      .then(() => add('rt-subscribed'))
      .catch((e) => add('rt-err:' + e.message));
  }, []);

  return (
    <>
      <Text>log:{log.join('|')}</Text>
      <Button
        onClick={async () => {
          const flag = showFlag({ id: 'e2e-flag', title: 'Hello from the bridge' });
          add('flag-shown');
          // Flag.close() → callBridge('closeFlag', { id })
          setTimeout(() => { flag.close(); add('flag-closed'); }, 300);
        }}
      >
        Show Flag
      </Button>
      <Button onClick={() => realtime.publish('room', { v: 'live' }).then(() => add('rt-published'))}>
        Publish
      </Button>
    </>
  );
};
ForgeReconciler.render(<App />);
