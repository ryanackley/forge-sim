import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, Badge, Stack, SectionMessage } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [text, setText] = useState('Loading...');
  const [count, setCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    invoke('getText', {}).then((data: any) => {
      setText(data.text);
    });
  }, []);

  const handleClick = async () => {
    setClickCount((n) => n + 1);
    const data: any = await invoke('getCount', {});
    setCount(data.count);
  };

  return (
    <Stack space="space.200">
      <SectionMessage appearance="information" title="forge-sim Test App">
        <Text>This is a real Forge app running in the browser with forge-sim!</Text>
      </SectionMessage>

      <Text>Resolver says: {text}</Text>

      <Button appearance="primary" onClick={handleClick}>
        Get Random Number
      </Button>

      <Text>
        Random number: <Badge appearance="primary">{count}</Badge>
      </Text>

      <Text>
        Button clicked <Badge appearance="added">{clickCount}</Badge> times
      </Text>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
