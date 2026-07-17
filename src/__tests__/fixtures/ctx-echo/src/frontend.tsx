import ForgeReconciler, { Text, Stack } from '@forge/react';
import { invoke } from '@forge/bridge';
import { useState, useEffect } from 'react';

/**
 * Renders what the RESOLVER (not the frontend) sees in its context —
 * the exact probe shape from the 0.1.1 eval's ctx-echo app.
 */
const App = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    invoke('echoContext', {}).then(setData);
  }, []);

  if (!data) return <Text>Loading context...</Text>;

  return (
    <Stack>
      <Text>EXT_PROJECT={data.ext?.project?.key ?? 'null'}</Text>
      <Text>EXT_ISSUE={data.ext?.issue?.key ?? 'null'}</Text>
      <Text>EXT_TYPE={data.ext?.type ?? 'null'}</Text>
      <Text>FLATTENED={data.flattenedProject || data.flattenedIssue ? 'leaked' : 'clean'}</Text>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
