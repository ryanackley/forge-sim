import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, Badge, Stack, SectionMessage } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [issue, setIssue] = useState<any>(null);
  const [views, setViews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getIssue', { issueKey: 'TEST-1' }).then((data: any) => {
      setIssue(data.issue);
      setViews(data.views);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <Stack space="space.200">
      <SectionMessage appearance="information" title={issue?.key || 'Issue'}>
        <Text>{issue?.fields?.summary || 'No summary'}</Text>
      </SectionMessage>

      <Text>
        Views: <Badge appearance="primary">{views}</Badge>
      </Text>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
