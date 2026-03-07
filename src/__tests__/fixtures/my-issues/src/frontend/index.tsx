import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Box,
  Stack,
  Inline,
  Badge,
  Lozenge,
  Button,
  Spinner,
  SectionMessage,
  Table,
  Head,
  Row,
  Cell,
  Link,
  TextField,
} from '@forge/react';
import { invoke } from '@forge/bridge';

interface Issue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  type: string;
  project: string;
  projectKey: string;
  updated: string;
}

interface UserInfo {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl: string;
  active: boolean;
}

function statusAppearance(category: string): string {
  switch (category) {
    case 'done': return 'success';
    case 'indeterminate': return 'inprogress';
    case 'new': return 'default';
    default: return 'default';
  }
}

function priorityAppearance(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'highest':
    case 'high': return 'removed';
    case 'medium': return 'default';
    case 'low':
    case 'lowest': return 'success';
    default: return 'default';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const App = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState<'assigned' | 'search'>('assigned');

  const loadMyIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userResult, issuesResult] = await Promise.all([
        invoke('getMyself', {}),
        invoke('getMyIssues', {}),
      ]);

      if (userResult.error) setError(userResult.error);
      else setUser(userResult);

      if (issuesResult.error) setError(issuesResult.error);
      else {
        setIssues(issuesResult.issues);
        setTotal(issuesResult.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load issues');
    }
    setLoading(false);
  };

  const searchIssues = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await invoke('searchIssues', { query: searchQuery });
      if (result.error) setError(result.error);
      else {
        setIssues(result.issues);
        setTotal(result.total);
        setView('search');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSearching(false);
  };

  useEffect(() => { loadMyIssues(); }, []);

  if (loading) {
    return (
      <Box padding="space.400">
        <Stack space="space.200" alignInline="center">
          <Spinner size="large" />
          <Text>Loading your issues...</Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box padding="space.200">
      <Stack space="space.300">
        {/* Header */}
        <Inline spread="space-between" alignBlock="center">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h3">
              {view === 'assigned' ? 'My Issues' : 'Search Results'}
            </Heading>
            <Badge appearance="primary">{total}</Badge>
          </Inline>
          {user && (
            <Text>{user.displayName}</Text>
          )}
        </Inline>

        {/* Search */}
        <Inline space="space.100" alignBlock="center">
          <TextField
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
          <Button
            appearance="default"
            onClick={searchIssues}
            isLoading={searching}
          >
            Search
          </Button>
          {view === 'search' && (
            <Button appearance="subtle" onClick={() => { setView('assigned'); loadMyIssues(); }}>
              Back to My Issues
            </Button>
          )}
        </Inline>

        {/* Error */}
        {error && (
          <SectionMessage appearance="error" title="Error">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        {/* Issues table */}
        {issues.length === 0 ? (
          <SectionMessage appearance="information" title="No issues">
            <Text>
              {view === 'assigned'
                ? 'No issues assigned to you. Nice work! 🎉'
                : 'No issues match your search.'}
            </Text>
          </SectionMessage>
        ) : (
          <Table>
            <Head>
              <Cell><Text weight="bold">Key</Text></Cell>
              <Cell><Text weight="bold">Summary</Text></Cell>
              <Cell><Text weight="bold">Type</Text></Cell>
              <Cell><Text weight="bold">Status</Text></Cell>
              <Cell><Text weight="bold">Priority</Text></Cell>
              <Cell><Text weight="bold">Updated</Text></Cell>
            </Head>
            {issues.map((issue) => (
              <Row key={issue.key}>
                <Cell>
                  <Link href={`#`}>
                    <Text>{issue.key}</Text>
                  </Link>
                </Cell>
                <Cell><Text>{issue.summary}</Text></Cell>
                <Cell><Lozenge>{issue.type}</Lozenge></Cell>
                <Cell>
                  <Lozenge appearance={statusAppearance(issue.statusCategory)}>
                    {issue.status}
                  </Lozenge>
                </Cell>
                <Cell>
                  <Lozenge appearance={priorityAppearance(issue.priority)}>
                    {issue.priority}
                  </Lozenge>
                </Cell>
                <Cell>
                  <Text>{issue.updated ? timeAgo(issue.updated) : '-'}</Text>
                </Cell>
              </Row>
            ))}
          </Table>
        )}

        {/* Refresh */}
        <Inline>
          <Button
            appearance="subtle"
            onClick={() => { setView('assigned'); loadMyIssues(); }}
          >
            ↻ Refresh
          </Button>
        </Inline>
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(<App />);
