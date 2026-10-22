// Canonical multi-entry page, shaped after the Forge "Bundling multi-entry
// frontend with Vite" example: named component, invoke in an effect,
// React.StrictMode around the root.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { label } from './shared.js';

export const Home = ({ title }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    invoke('summary').then((response) => setData(response));
  }, []);
  return (
    <>
      <Text>{title}</Text>
      <Text>{data ?? 'Loading...'}</Text>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <Home title={label('home')} />
  </React.StrictMode>
);
