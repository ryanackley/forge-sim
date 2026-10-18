import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, Stack, I18nProvider, useTranslation } from '@forge/react';
import { invoke } from '@forge/bridge';

// Source-mode app running the REAL @forge/bridge: its i18n fetches
// ./__LOCALES__/*.json relative to this page, which the dev server answers
// from src/__LOCALES__ via the simulator's i18n store.
const Greeting = () => {
  const { t, ready } = useTranslation();
  return <Text>i18n:{ready ? t('greeting') : 'loading'}</Text>;
};

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
      <Greeting />
      <Button
        onClick={async () => {
          try {
            const res = await invoke('getConfluenceData');
            setConfResult(`confluence:${JSON.stringify(res)}`);
          } catch (err: any) {
            setConfResult(`confluence-error:${err.message}`);
          }
        }}
      >Test Confluence</Button>
      <Button
        onClick={async () => {
          try {
            const res = await invoke('echo', { message: 'hello from uikit' });
            setEchoResult(`echo:${JSON.stringify(res)}`);
          } catch (err: any) {
            setEchoResult(`echo-error:${err.message}`);
          }
        }}
      >Test Echo</Button>
    </Stack>
  );
};

ForgeReconciler.render(<I18nProvider><App /></I18nProvider>);
