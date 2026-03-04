/**
 * Sample Forge UIKit app that talks to a backend resolver.
 * 
 * This is a realistic Forge app: the UI calls invoke() to fetch data
 * from the resolver, which in turn calls Jira APIs and uses KVS.
 */
import { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, Stack, Box } from '@forge/react';
import { invoke } from '@forge/bridge';

const IssueViewerApp = () => {
  const [issue, setIssue] = useState<any>(null);
  const [views, setViews] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadIssue = async () => {
    setLoading(true);
    const result = await invoke('getIssue', { issueKey: 'TEST-1' });
    setIssue(result.issue);
    setViews(result.views);
    setLoading(false);
  };

  useEffect(() => {
    loadIssue();
  }, []);

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <Stack>
      <Box>
        <Text>Issue: {issue?.key} - {issue?.summary}</Text>
      </Box>
      <Box>
        <Text>Views: {views}</Text>
      </Box>
      <Button onClick={loadIssue}>Refresh</Button>
    </Stack>
  );
};

ForgeReconciler.render(<IssueViewerApp />);
