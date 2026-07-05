import ForgeReconciler, {
  Text,
  Textfield,
  Select,
  useConfig,
} from '@forge/react';

const App = () => {
  const config = useConfig() as { name?: string; tier?: string } | undefined;
  const name = config?.name ?? '(unnamed)';
  const tier = config?.tier ?? 'standard';
  return <Text>{`Pet: ${name} — Tier: ${tier}`}</Text>;
};

const Config = () => {
  return (
    <>
      <Textfield name="name" defaultValue="Whiskers" />
      <Select
        name="tier"
        defaultValue="gold"
        options={[
          { label: 'Standard', value: 'standard' },
          { label: 'Gold', value: 'gold' },
          { label: 'Platinum', value: 'platinum' },
        ]}
      />
    </>
  );
};

ForgeReconciler.render(<App />);
ForgeReconciler.addConfig(<Config />);
