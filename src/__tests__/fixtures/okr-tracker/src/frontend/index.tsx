import React, { useEffect, useState, useCallback } from 'react';
import ForgeReconciler, {
  Text,
  Stack,
  Box,
  Inline,
  Button,
  Badge,
  Heading,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Textfield,
  SectionMessage,
  Tag,
  TagGroup,
  Lozenge,
  ProgressBar,
  LoadingButton,
  Select,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const POLL_INTERVAL = 10000;
const DEFAULT_CYCLE = 'Q1-2026';

interface Objective {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  cycle: string;
  status: string;
  completion_pct: number;
  kr_count: number;
}

interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  measurement_type: string;
  status: string;
}

interface CycleSummary {
  total_objectives: number;
  total_key_results: number;
  completed_objectives: number;
  avg_completion: number;
  kr_on_track: number;
  kr_at_risk: number;
  kr_behind: number;
  kr_completed: number;
}

// ── Status Lozenge ───────────────────────────────────────────────────
function StatusLozenge({ status }: { status: string }) {
  const appearances: Record<string, string> = {
    'on-track': 'success',
    'completed': 'success',
    'at-risk': 'moved',
    'behind': 'removed',
    'active': 'inprogress',
    'draft': 'default',
    'cancelled': 'removed',
  };
  return (
    <Lozenge appearance={appearances[status] || 'default'}>
      {status.replace('-', ' ').toUpperCase()}
    </Lozenge>
  );
}

// ── KR Progress Card ─────────────────────────────────────────────────
function KrCard({ kr }: { kr: KeyResult }) {
  const pct = kr.target_value > 0
    ? Math.min((kr.current_value / kr.target_value) * 100, 100)
    : 0;

  return (
    <Box padding="space.100">
      <Stack space="space.050">
        <Inline spread="space-between" alignBlock="center">
          <Text>{kr.title}</Text>
          <StatusLozenge status={kr.status} />
        </Inline>
        <ProgressBar value={pct / 100} />
        <Inline space="space.100">
          <Text>
            {String(kr.current_value)} / {String(kr.target_value)} {kr.unit}
          </Text>
          <Badge appearance={pct >= 70 ? 'primary' : 'default'}>
            {String(Math.round(pct))}%
          </Badge>
          {kr.measurement_type === 'jira-linked' && (
            <Tag text="Jira-linked" color="blue" />
          )}
        </Inline>
      </Stack>
    </Box>
  );
}

// ── Objective Card ───────────────────────────────────────────────────
function ObjectiveCard({
  objective,
  onSelect,
}: {
  objective: Objective;
  onSelect: (id: string) => void;
}) {
  const pct = Math.round(objective.completion_pct || 0);

  return (
    <Box padding="space.150">
      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="center">
          <Button appearance="link" onClick={() => onSelect(objective.id)}>
            {objective.title}
          </Button>
          <StatusLozenge status={objective.status} />
        </Inline>
        <ProgressBar value={pct / 100} />
        <Inline space="space.200">
          <Badge>{String(objective.kr_count)} KRs</Badge>
          <Badge appearance={pct >= 70 ? 'primary' : 'default'}>
            {String(pct)}% complete
          </Badge>
          <Text>Owner: {objective.owner_id}</Text>
        </Inline>
      </Stack>
    </Box>
  );
}

// ── Create Objective Form ────────────────────────────────────────────
function CreateObjectiveForm({
  cycle,
  onCreated,
}: {
  cycle: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    await invoke('createObjective', { title: title.trim(), description, cycle });
    setTitle('');
    setDescription('');
    setSubmitting(false);
    onCreated();
  };

  return (
    <Stack space="space.100">
      <Heading size="small">New Objective</Heading>
      <Textfield
        placeholder="Objective title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textfield
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <LoadingButton
        appearance="primary"
        onClick={handleSubmit}
        isLoading={submitting}
        isDisabled={!title.trim()}
      >
        Create Objective
      </LoadingButton>
    </Stack>
  );
}

// ── Dashboard Tab ────────────────────────────────────────────────────
function DashboardTab({ cycle }: { cycle: string }) {
  const [summary, setSummary] = useState<CycleSummary | null>(null);

  useEffect(() => {
    invoke('getCycleSummary', { cycle }).then((result: any) => {
      setSummary(result.summary);
    });
  }, [cycle]);

  if (!summary) return <Text>Loading summary...</Text>;

  return (
    <Stack space="space.200">
      <Heading size="medium">📊 {cycle} Dashboard</Heading>

      <Inline space="space.200">
        <Box padding="space.200">
          <Stack space="space.050" alignInline="center">
            <Text>{String(summary.total_objectives)}</Text>
            <Text>Objectives</Text>
          </Stack>
        </Box>
        <Box padding="space.200">
          <Stack space="space.050" alignInline="center">
            <Text>{String(summary.total_key_results)}</Text>
            <Text>Key Results</Text>
          </Stack>
        </Box>
        <Box padding="space.200">
          <Stack space="space.050" alignInline="center">
            <Text>{String(Math.round(summary.avg_completion))}%</Text>
            <Text>Avg Completion</Text>
          </Stack>
        </Box>
      </Inline>

      <ProgressBar value={(summary.avg_completion || 0) / 100} />

      <Inline space="space.100">
        <TagGroup>
          <Tag text={`${summary.kr_on_track || 0} on track`} color="green" />
          <Tag text={`${summary.kr_at_risk || 0} at risk`} color="yellow" />
          <Tag text={`${summary.kr_behind || 0} behind`} color="red" />
          <Tag text={`${summary.kr_completed || 0} completed`} color="blue" />
        </TagGroup>
      </Inline>
    </Stack>
  );
}

// ── Objective Detail View ────────────────────────────────────────────
function ObjectiveDetail({
  objectiveId,
  onBack,
}: {
  objectiveId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<any>(null);

  const fetchDetail = useCallback(async () => {
    const result = await invoke('getObjective', { objectiveId });
    setData(result);
  }, [objectiveId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (!data) return <Text>Loading...</Text>;
  if (data.error) {
    return (
      <SectionMessage appearance="error" title="Error">
        <Text>{data.error}</Text>
      </SectionMessage>
    );
  }

  return (
    <Stack space="space.200">
      <Button appearance="link" onClick={onBack}>← Back to list</Button>

      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="center">
          <Heading size="medium">{data.objective.title}</Heading>
          <StatusLozenge status={data.objective.status} />
        </Inline>
        {data.objective.description && (
          <Text>{data.objective.description}</Text>
        )}
      </Stack>

      <Heading size="small">Key Results ({String(data.keyResults.length)})</Heading>
      {data.keyResults.length === 0 ? (
        <Text>No key results yet.</Text>
      ) : (
        <Stack space="space.100">
          {data.keyResults.map((kr: KeyResult) => (
            <KrCard key={kr.id} kr={kr} />
          ))}
        </Stack>
      )}

      {data.children.length > 0 && (
        <>
          <Heading size="small">Child Objectives</Heading>
          <Stack space="space.050">
            {data.children.map((child: any) => (
              <Inline key={child.id} space="space.100" alignBlock="center">
                <Text>{child.title}</Text>
                <StatusLozenge status={child.status} />
              </Inline>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

// ── Main App ─────────────────────────────────────────────────────────
function App() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [cycle, setCycle] = useState(DEFAULT_CYCLE);
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchObjectives = useCallback(async () => {
    try {
      const result = await invoke('listObjectives', { cycle }) as any;
      setObjectives(result.objectives || []);
    } catch (err: any) {
      console.error('Failed to fetch objectives:', err);
    }
  }, [cycle]);

  useEffect(() => {
    fetchObjectives().then(() => setLoading(false));
  }, [fetchObjectives]);

  useEffect(() => {
    const interval = setInterval(fetchObjectives, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchObjectives]);

  if (loading) return <Text>Loading OKR Tracker...</Text>;

  if (selectedObjective) {
    return (
      <ObjectiveDetail
        objectiveId={selectedObjective}
        onBack={() => {
          setSelectedObjective(null);
          fetchObjectives();
        }}
      />
    );
  }

  return (
    <Stack space="space.200">
      <Heading size="large">🎯 OKR Tracker</Heading>

      <Tabs id="okr-tabs">
        <TabList>
          <Tab>📊 Dashboard</Tab>
          <Tab>📋 Objectives</Tab>
          <Tab>➕ New Objective</Tab>
        </TabList>

        <TabPanel>
          <DashboardTab cycle={cycle} />
        </TabPanel>

        <TabPanel>
          <Stack space="space.150">
            {objectives.length === 0 ? (
              <SectionMessage appearance="information" title="No objectives yet">
                <Text>Create your first objective to get started!</Text>
              </SectionMessage>
            ) : (
              objectives.map((obj) => (
                <ObjectiveCard
                  key={obj.id}
                  objective={obj}
                  onSelect={setSelectedObjective}
                />
              ))
            )}
          </Stack>
        </TabPanel>

        <TabPanel>
          <CreateObjectiveForm cycle={cycle} onCreated={fetchObjectives} />
        </TabPanel>
      </Tabs>
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
