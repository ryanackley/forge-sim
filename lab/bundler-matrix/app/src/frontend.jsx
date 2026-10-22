import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [text, setText] = useState('Loading...');
  useEffect(() => {
    invoke('save', { id: 'ui' }).then(() => invoke('summary')).then(setText);
  }, []);
  return <Text>{text}</Text>;
};

ForgeReconciler.render(<App />);
