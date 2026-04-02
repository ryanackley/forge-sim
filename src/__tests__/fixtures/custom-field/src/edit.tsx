import ForgeReconciler, { Text, Button } from '@forge/react';
import { view } from '@forge/bridge';

const App = () => {
  const handleSave = () => {
    view.submit({ value: 99 });
  };

  const handleCancel = () => {
    view.close();
  };

  const handleRefresh = () => {
    view.refresh({ updated: true });
  };

  return (
    <>
      <Text>Edit mode</Text>
      <Button onClick={handleSave}>Save</Button>
      <Button onClick={handleCancel}>Cancel</Button>
      <Button onClick={handleRefresh}>Refresh</Button>
    </>
  );
};

ForgeReconciler.render(<App />);
