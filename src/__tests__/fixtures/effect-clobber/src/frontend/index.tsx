/**
 * Replicates the sprint-pulse "effect clobber" shape (eval bug B3):
 *
 *   1. App fetches settings via useEffect → invoke('getSettings').
 *   2. When the fetch lands, `threshold` (a prop of SettingsForm) changes.
 *   3. SettingsForm has `useEffect(() => setValue(String(threshold)), [threshold])`
 *      — a controlled-input sync effect. It is SCHEDULED at the commit where
 *      the prop changed but flushes later (passive effect).
 *
 * A headless fillField fired at that commit — before the effect flushes —
 * gets silently clobbered back to String(threshold). In a real browser the
 * effect flushes before a human could possibly type, so this sequence is
 * physically impossible in production; waitForContent must settle before
 * resolving to preserve parity.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Textfield,
  Button,
  Label,
  Stack,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const DEFAULT_THRESHOLD = 20;

const SettingsForm = ({
  threshold,
  onSaved,
}: {
  threshold: number;
  onSaved: (v: number) => void;
}) => {
  const [value, setValue] = useState(String(threshold));

  // THE CLOBBER — sync the local field whenever the prop changes.
  useEffect(() => {
    setValue(String(threshold));
  }, [threshold]);

  const save = async () => {
    await invoke('saveSettings', { threshold: Number(value) });
    onSaved(Number(value));
  };

  return (
    <Stack space="space.100">
      <Label labelFor="threshold-field">Alert threshold</Label>
      <Textfield
        id="threshold-field"
        name="threshold"
        value={value}
        onChange={(e: any) => setValue(e.target.value)}
      />
      <Button onClick={save}>Save</Button>
    </Stack>
  );
};

const App = () => {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [loaded, setLoaded] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    invoke('getSettings').then((s: any) => {
      setThreshold(s.threshold);
      setLoaded(true);
    });
  }, []);

  return (
    <Stack space="space.200">
      <Text>
        {loaded ? `Current threshold: ${threshold}` : 'Loading settings...'}
      </Text>
      <SettingsForm threshold={threshold} onSaved={(v) => setSavedMessage(`Saved ${v}`)} />
      {savedMessage && <Text>{savedMessage}</Text>}
    </Stack>
  );
};

ForgeReconciler.render(<App />);
