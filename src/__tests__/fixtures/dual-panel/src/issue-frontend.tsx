import ForgeReconciler, { Text, Stack, Button, Badge } from '@forge/react';
import { invoke } from '@forge/bridge';
import { useState, useEffect } from 'react';

const IssueSummary = () => {
  const [data, setData] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    invoke('getIssueSummary', {}).then(setData);
  }, []);

  const loadComments = async () => {
    const result = await invoke('getIssueComments', {}) as any;
    setComments(result.comments);
    setShowComments(true);
  };

  if (!data) return <Text>Loading issue...</Text>;

  return (
    <Stack>
      <Text>{data.summary}</Text>
      <Badge text={`${data.viewCount} views`} />
      <Button text="Show Comments" onClick={loadComments} />
      {showComments && comments.map((c: any, i: number) => (
        <Text key={`comment-${i}`}>{c.author}: {c.text}</Text>
      ))}
    </Stack>
  );
};

ForgeReconciler.render(<IssueSummary />);
