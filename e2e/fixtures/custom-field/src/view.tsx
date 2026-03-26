import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Badge, Stack } from '@forge/react';
import { view } from '@forge/bridge';

const View = () => {
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    view.getContext().then(setContext);
  }, []);

  const fieldValue = context?.extension?.fieldValue ?? 'loading...';

  return (
    <Stack>
      <Text testId="view-label">Score:</Text>
      <Badge appearance="primary">{String(fieldValue)}</Badge>
      <Text testId="view-value">current-value:{String(fieldValue)}</Text>
    </Stack>
  );
};

ForgeReconciler.render(<View />);
