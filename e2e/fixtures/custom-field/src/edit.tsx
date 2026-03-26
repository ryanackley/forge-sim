import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Textfield, Button, Stack } from '@forge/react';
import { view } from '@forge/bridge';

const Edit = () => {
  const [context, setContext] = useState<any>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    view.getContext().then((ctx: any) => {
      setContext(ctx);
      const initial = ctx?.extension?.fieldValue;
      if (initial !== undefined && initial !== null) {
        setValue(String(initial));
      }
    });
  }, []);

  return (
    <Stack>
      <Text testId="edit-label">Edit Score:</Text>
      <Textfield
        name="score"
        defaultValue={value}
        onChange={(e: any) => {
          const v = typeof e === 'string' ? e : e?.target?.value ?? '';
          setValue(v);
        }}
      />
      <Text testId="edit-value">editing:{value}</Text>
      <Button onClick={() => {
        const numVal = Number(value);
        view.submit(isNaN(numVal) ? value : numVal);
      }}>
        Save
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(<Edit />);
