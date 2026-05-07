// @ts-nocheck — fixture file, runs through forge-sim's loader
//
// This frontend deliberately mixes hooks from `react` (useState, useEffect)
// with @forge/react. If the bundle's `react` resolves to a different copy
// than @forge/react's `react`, useState reads a null dispatcher and crashes
// with `Cannot read properties of null (reading 'useState')`.
//
// The regression test creates a fake project-local node_modules/react for
// this fixture, which forces resolution to a different inode than forge-sim's
// own react. With the loader's React-dedup interception working, both
// resolutions end up at forge-sim's copy and the render succeeds.
import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [data, setData] = useState<{ message: string } | null>(null);

  useEffect(() => {
    invoke('getMessage', {}).then((d: any) => setData(d));
  }, []);

  if (!data) return <Text>Loading…</Text>;
  return <Text>{data.message}</Text>;
};

ForgeReconciler.render(<App />);
