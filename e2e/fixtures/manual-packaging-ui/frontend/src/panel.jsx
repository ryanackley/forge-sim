import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke, requestJira } from '@forge/bridge';

const App = () => {
  const [viaInvoke, setViaInvoke] = useState(null);
  const [viaJira, setViaJira] = useState(null);
  useEffect(() => {
    invoke('getText', { from: 'prebuilt' }).then(setViaInvoke);
    requestJira('/rest/api/3/issue/10001')
      .then((r) => r.json())
      .then((j) => setViaJira(j.key));
  }, []);
  return (
    <>
      <Text>{viaInvoke ? 'invoke:' + viaInvoke : 'invoke-loading'}</Text>
      <Text>{viaJira ? 'jira:' + viaJira : 'jira-loading'}</Text>
    </>
  );
};
ForgeReconciler.render(<App />);
