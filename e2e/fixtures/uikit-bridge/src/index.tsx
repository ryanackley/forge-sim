import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, Stack } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [jiraResult, setJiraResult] = useState('loading...');
  const [confResult, setConfResult] = useState('waiting...');
  const [echoResult, setEchoResult] = useState('waiting...');

  // Test requestJira on mount (via resolver that calls @forge/api)
  useEffect(() => {
    (async () => {
      try {
        const res = await invoke('getJiraData');
        setJiraResult(`jira:${JSON.stringify(res)}`);
      } catch (err: any) {
        setJiraResult(`jira-error:${err.message}`);
      }
    })();
  }, []);

  return (
    <Stack>
      <Text>jira-result:{jiraResult}</Text>
      <Text>conf-result:{confResult}</Text>
      <Text>echo-result:{echoResult}</Text>
      <Button
        text="Test Confluence"
        onClick={async () => {
          try {
            const res = await invoke('getConfluenceData');
            setConfResult(`confluence:${JSON.stringify(res)}`);
          } catch (err: any) {
            setConfResult(`confluence-error:${err.message}`);
          }
        }}
      />
      <Button
        text="Test Echo"
        onClick={async () => {
          try {
            const res = await invoke('echo', { message: 'hello from uikit' });
            setEchoResult(`echo:${JSON.stringify(res)}`);
          } catch (err: any) {
            setEchoResult(`echo-error:${err.message}`);
          }
        }}
      />
    </Stack>
  );
};

ForgeReconciler.render(<App />);
