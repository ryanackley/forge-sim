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
  role: string | { label: string; value: string };
  tags: Array<{ label: string; value: string }>;
  newsletter: boolean;
  premium: boolean;
};

const App = () => {
  const { register, handleSubmit, formState } = useForm<FormShape>({
    defaultValues: {
      role: 'member',
      tags: [],
      newsletter: false,
      premium: false,
    },
  });
  const [submitted, setSubmitted] = useState<string | null>(null);
  // Manual-onChange Select uses local state — mirrors a common production
  // pattern where the dev unwraps the option in onChange. fillField should
  // still fire the option-object shape; the handler does the unwrap.
  const [team, setTeam] = useState<string>('platform');

  const onSubmit = (data: FormShape) => {
    setSubmitted(JSON.stringify({ ...data, team }));
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

        <Label labelFor="team">Team</Label>
        <Select
          name="team"
          options={[
            { label: 'Platform', value: 'platform' },
            { label: 'Growth', value: 'growth' },
          ]}
          onChange={(opt: { value: string } | null) => {
            // Manual onChange — unwrap option.value so local state holds a raw string.
            setTeam(opt ? opt.value : '');
          }}
        />
        <Text>{`team-watch: ${team}`}</Text>

        <Label labelFor="tags">Tags</Label>
        <Select
          {...register('tags')}
          isMulti
          options={[
            { label: 'Red', value: 'red' },
            { label: 'Green', value: 'green' },
            { label: 'Blue', value: 'blue' },
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
