import React, { useState } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  Stack,
  Box,
  Heading,
  Form,
  FormSection,
  FormFooter,
  Label,
  RequiredAsterisk,
  Textfield,
  CheckboxGroup,
  RadioGroup,
  Select,
  Toggle,
  DynamicTable,
  InlineEdit,
  useForm,
  ErrorMessage,
} from '@forge/react';

// ── Section 1: Button onClick ──────────────────────────────────────────

const ButtonTest = () => {
  const [count, setCount] = useState(0);
  return (
    <Stack>
      <Heading as="h3">button-test</Heading>
      <Button onClick={() => setCount((c) => c + 1)}>Increment</Button>
      <Text testId="button-result">button-count:{count}</Text>
    </Stack>
  );
};

// ── Section 2: Form + Textfield → onSubmit ─────────────────────────────

const FormTextfieldTest = () => {
  const [submitted, setSubmitted] = useState('none');
  const { handleSubmit, register, getFieldId } = useForm();

  const onSubmit = (data: any) => {
    setSubmitted(JSON.stringify(data));
  };

  return (
    <Stack>
      <Heading as="h3">form-textfield-test</Heading>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormSection>
          <Label labelFor={getFieldId('username')}>Username</Label>
          <Textfield {...register('username')} />
        </FormSection>
        <FormFooter>
          <Button type="submit">Submit Form</Button>
        </FormFooter>
      </Form>
      <Text testId="form-textfield-result">form-submitted:{submitted}</Text>
    </Stack>
  );
};

// ── Section 3: Form + CheckboxGroup → onSubmit ─────────────────────────

const checkboxOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

const FormCheckboxTest = () => {
  const [submitted, setSubmitted] = useState('none');
  const { handleSubmit, register, getFieldId } = useForm();

  const onSubmit = (data: any) => {
    setSubmitted(JSON.stringify(data));
  };

  return (
    <Stack>
      <Heading as="h3">form-checkbox-test</Heading>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormSection>
          <Label labelFor={getFieldId('fruits')}>
            Pick fruits
            <RequiredAsterisk />
          </Label>
          <CheckboxGroup
            {...register('fruits', { required: true })}
            name="fruits"
            options={checkboxOptions}
          />
        </FormSection>
        <FormFooter>
          <Button type="submit">Submit Checkboxes</Button>
        </FormFooter>
      </Form>
      <Text testId="form-checkbox-result">checkbox-submitted:{submitted}</Text>
    </Stack>
  );
};

// ── Section 4: TextField onChange (live) ────────────────────────────────

const TextfieldLiveTest = () => {
  const [value, setValue] = useState('');
  return (
    <Stack>
      <Heading as="h3">textfield-live-test</Heading>
      <Textfield
        name="live-text"
        onChange={(e: any) => setValue(typeof e === 'string' ? e : e?.target?.value ?? '')}
      />
      <Text testId="textfield-live-result">typed:{value}</Text>
    </Stack>
  );
};

// ── Section 5: Select onChange ──────────────────────────────────────────

const selectOptions = [
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Blue', value: 'blue' },
];

const SelectTest = () => {
  const [selected, setSelected] = useState('none');
  return (
    <Stack>
      <Heading as="h3">select-test</Heading>
      <Select
        name="color"
        options={selectOptions}
        onChange={(opt: any) => setSelected(opt?.value ?? 'none')}
      />
      <Text testId="select-result">selected:{selected}</Text>
    </Stack>
  );
};

// ── Section 6: Toggle onChange ──────────────────────────────────────────

const ToggleTest = () => {
  const [isOn, setIsOn] = useState(false);
  return (
    <Stack>
      <Heading as="h3">toggle-test</Heading>
      <Toggle
        name="my-toggle"
        onChange={(e: any) => {
          // UIKit Toggle onChange sends the event — extract checked
          const checked = typeof e === 'object' ? (e?.target?.checked ?? !isOn) : !isOn;
          setIsOn(checked);
        }}
      />
      <Text testId="toggle-result">toggled:{isOn ? 'true' : 'false'}</Text>
    </Stack>
  );
};

// ── Section 7: DynamicTable with Button in cell ────────────────────────

const TableButtonTest = () => {
  const [clicked, setClicked] = useState('none');

  const head = {
    cells: [
      { key: 'name', content: 'Name' },
      { key: 'action', content: 'Action' },
    ],
  };

  const rows = [
    {
      key: 'row-1',
      cells: [
        { key: 'name-1', content: 'Item Alpha' },
        {
          key: 'action-1',
          content: (
            <Button onClick={() => setClicked('alpha')}>Click Alpha</Button>
          ),
        },
      ],
    },
    {
      key: 'row-2',
      cells: [
        { key: 'name-2', content: 'Item Beta' },
        {
          key: 'action-2',
          content: (
            <Button onClick={() => setClicked('beta')}>Click Beta</Button>
          ),
        },
      ],
    },
  ];

  return (
    <Stack>
      <Heading as="h3">table-button-test</Heading>
      <DynamicTable head={head} rows={rows} />
      <Text testId="table-button-result">table-clicked:{clicked}</Text>
    </Stack>
  );
};

// ── Section 8: RadioGroup onChange ──────────────────────────────────────

const radioOptions = [
  { value: 'small', label: 'Small', name: 'size' },
  { value: 'medium', label: 'Medium', name: 'size' },
  { value: 'large', label: 'Large', name: 'size' },
];

const RadioTest = () => {
  const [picked, setPicked] = useState('none');
  return (
    <Stack>
      <Heading as="h3">radio-test</Heading>
      <RadioGroup
        name="size"
        options={radioOptions}
        onChange={(e: any) => {
          const val = typeof e === 'string' ? e : e?.target?.value ?? 'unknown';
          setPicked(val);
        }}
      />
      <Text testId="radio-result">radio-picked:{picked}</Text>
    </Stack>
  );
};

// ── Section 9: InlineEdit onConfirm ────────────────────────────────────

const InlineEditTest = () => {
  const [value, setValue] = useState('Click to edit');
  return (
    <Stack>
      <Heading as="h3">inline-edit-test</Heading>
      <InlineEdit
        defaultValue={value}
        editView={({ errorMessage, ...fieldProps }: any) => (
          <Textfield {...fieldProps} autoFocus />
        )}
        readView={() => <Text>{value || 'Click to edit'}</Text>}
        onConfirm={(newValue: string) => setValue(newValue)}
      />
      <Text testId="inline-edit-result">edited:{value}</Text>
    </Stack>
  );
};

// ── Main App ───────────────────────────────────────────────────────────

const App = () => {
  return (
    <Stack space="space.200">
      <Heading as="h2">UIKit Events E2E</Heading>
      <ButtonTest />
      <FormTextfieldTest />
      <FormCheckboxTest />
      <TextfieldLiveTest />
      <SelectTest />
      <ToggleTest />
      <TableButtonTest />
      <RadioTest />
      <InlineEditTest />
    </Stack>
  );
};

ForgeReconciler.render(<App />);
