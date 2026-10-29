import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import React, { useState, useEffect } from 'react';

// Both panels invoke the same key; which function answers depends on the
// module the call is made in.
const App = () => {
  const [text, setText] = useState(null);
  useEffect(() => {
    invoke('getText', { from: 'ui' }).then(setText);
  }, []);
  return <Text>{text ?? 'Loading...'}</Text>;
};

ForgeReconciler.render(<App />);
