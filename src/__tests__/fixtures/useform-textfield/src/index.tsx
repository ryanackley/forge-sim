import { useState } from 'react';
import ForgeReconciler, {
  Button,
  Form,
  Label,
  Text,
  Textfield,
  useForm,
} from '@forge/react';

// useForm version
const FormApp = () => {
  const { register, handleSubmit, formState } = useForm<{ name: string }>();
  const [submitted, setSubmitted] = useState<string | null>(null);

  const onSubmit = (data: { name: string }) => {
    setSubmitted(JSON.stringify(data));
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Label labelFor="name">Name</Label>
      <Textfield {...register('name', { required: true })} />
      {formState.errors.name && <Text>{`error: ${formState.errors.name.message ?? 'required'}`}</Text>}
      <Button type="submit" appearance="primary">Submit</Button>
      {submitted && <Text>{`submitted: ${submitted}`}</Text>}
    </Form>
  );
};

// Manual controlled — the OTHER common pattern (no useForm)
const ManualApp = () => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <>
      <Textfield
        name="name"
        value={name}
        onChange={(e) => setName((e as unknown as { target: { value: string } }).target.value)}
      />
      <Button onClick={() => setSubmitted(name)} appearance="primary">Save</Button>
      {submitted && <Text>{`saved: ${submitted}`}</Text>}
    </>
  );
};

// Render both, side by side
const App = () => (
  <>
    <FormApp />
    <ManualApp />
  </>
);

ForgeReconciler.render(<App />);
