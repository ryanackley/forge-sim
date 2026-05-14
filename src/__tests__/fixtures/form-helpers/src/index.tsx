import { useState } from 'react';
import ForgeReconciler, {
  Button,
  Checkbox,
  Form,
  FormSection,
  Label,
  Select,
  Text,
  TextArea,
  Textfield,
  Toggle,
  useForm,
} from '@forge/react';

type FormShape = {
  name: string;
  email: string;
  bio: string;
  role: string;
  newsletter: boolean;
  premium: boolean;
};

const App = () => {
  const { register, handleSubmit, formState } = useForm<FormShape>({
    defaultValues: {
      role: 'member',
      newsletter: false,
      premium: false,
    },
  });
  const [submitted, setSubmitted] = useState<string | null>(null);

  const onSubmit = (data: FormShape) => {
    setSubmitted(JSON.stringify(data));
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormSection>
        <Label labelFor="name">Name</Label>
        <Textfield {...register('name', { required: 'name required' })} />
        {formState.errors.name && <Text>{`error-name: ${formState.errors.name.message}`}</Text>}

        <Label labelFor="email">Email</Label>
        <Textfield {...register('email')} />

        <Label labelFor="bio">Bio</Label>
        <TextArea {...register('bio')} />

        <Label labelFor="role">Role</Label>
        <Select
          {...register('role')}
          options={[
            { label: 'Member', value: 'member' },
            { label: 'Admin', value: 'admin' },
          ]}
        />

        <Checkbox {...register('newsletter')} label="Subscribe" />
        <Toggle {...register('premium')} label="Premium" />
      </FormSection>
      <Button type="submit" appearance="primary">Submit</Button>
      {submitted && <Text>{`submitted: ${submitted}`}</Text>}
    </Form>
  );
};

ForgeReconciler.render(<App />);
