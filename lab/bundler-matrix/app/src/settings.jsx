import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { label } from './shared.js';

const Settings = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    invoke('summary').then((response) => setData(response));
  }, []);
  return (
    <>
      <Text>{label('settings')}</Text>
      <Text>{data ?? 'Loading...'}</Text>
    </>
  );
};

ForgeReconciler.render(<Settings />);
