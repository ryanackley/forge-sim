import ForgeReconciler, { Text, Stack, Button } from '@forge/react';
import { invoke } from '@forge/bridge';
import { useState, useEffect } from 'react';

const AdminSettings = () => {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    invoke('getSettings', {}).then(setSettings);
  }, []);

  const toggleTheme = async () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    await invoke('updateTheme', { theme: newTheme });
    setSettings({ ...settings, theme: newTheme });
  };

  if (!settings) return <Text>Loading settings...</Text>;

  return (
    <Stack>
      <Text>Admin Settings v{settings.version}</Text>
      <Text>Theme: {settings.theme}</Text>
      <Text>Notifications: {settings.notificationsEnabled ? 'ON' : 'OFF'}</Text>
      <Button text={`Switch to ${settings.theme === 'light' ? 'dark' : 'light'}`} onClick={toggleTheme} />
    </Stack>
  );
};

ForgeReconciler.render(<AdminSettings />);
