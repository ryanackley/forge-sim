import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invokeRemote, requestRemote } from '@forge/bridge';

const App = () => {
  const [viaInvoke, setViaInvoke] = useState(null);
  const [viaFetch, setViaFetch] = useState(null);
  useEffect(() => {
    invokeRemote({ path: '/items', method: 'GET' }).then((r) => setViaInvoke(JSON.stringify(r.body)));
    requestRemote('analytics', { path: '/events' })
      .then((r) => r.json())
      .then((j) => setViaFetch(JSON.stringify(j)));
  }, []);
  return (
    <>
      <Text>{viaInvoke ? 'remote-invoke:' + viaInvoke : 'remote-invoke-loading'}</Text>
      <Text>{viaFetch ? 'remote-fetch:' + viaFetch : 'remote-fetch-loading'}</Text>
    </>
  );
};
ForgeReconciler.render(<App />);
