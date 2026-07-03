/**
 * Object Store panel — exercises @forge/react's useObjectStore hook,
 * which drives @forge/bridge's createUploadPromises/objectStore.* under
 * the hood. FilePicker feeds SerializedFile[] ({data: base64, name, size,
 * type}) into uploadObjects as Base64Objects.
 */
import React, { useState } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Stack,
  FilePicker,
  FileCard,
  useObjectStore,
} from '@forge/react';

const App = () => {
  const { objectStates, uploadObjects, deleteObjects } = useObjectStore();
  const [lastAction, setLastAction] = useState('none');

  const handleFiles = async (files) => {
    await uploadObjects({
      functionKey: 'generateUploadUrls',
      objects: files.map((f) => ({ data: f.data, mimeType: f.type })),
    });
    setLastAction(`uploaded ${files.length}`);
  };

  return (
    <Stack space="space.200">
      <Text>Object Store Panel</Text>
      <Text>{`Last action: ${lastAction}`}</Text>
      <FilePicker label="Attach files" description="Pick files to upload" onChange={handleFiles} />
      {objectStates.map((obj) => (
        <FileCard
          key={obj.key}
          fileName={obj.key}
          isUploading={obj.isUploading}
          error={obj.error}
        />
      ))}
      <Button
        onClick={async () => {
          const keys = objectStates.map((o) => o.key);
          if (keys.length > 0) {
            await deleteObjects({ functionKey: 'deleteObject', keys });
            setLastAction(`deleted ${keys.length}`);
          }
        }}
      >
        Delete all
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
