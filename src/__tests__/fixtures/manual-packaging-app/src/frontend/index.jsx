import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [text, setText] = React.useState(null);
  React.useEffect(() => {
    invoke('getText').then(setText);
  }, []);
  return <Text>{text ?? 'Loading...'}</Text>;
};

ForgeReconciler.render(<App />);
