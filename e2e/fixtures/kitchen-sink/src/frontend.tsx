import React, { useState } from 'react';
import ForgeReconciler, {
  // Layout
  Box,
  Stack,
  Inline,
  Heading,
  Text,

  // Interactive
  Button,
  ButtonGroup,
  LinkButton,
  LoadingButton,
  Toggle,
  Range,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Select,
  Textfield,
  TextArea,
  DatePicker,
  TimePicker,
  Calendar,

  // Display
  Badge,
  Lozenge,
  Spinner,
  ProgressBar,
  ProgressTracker,
  SectionMessage,
  SectionMessageAction,
  EmptyState,
  Code,
  CodeBlock,
  Tooltip,
  Tag,
  TagGroup,
  Icon,
  Image,
  Link,

  // Structure
  Tabs,
  Tab,
  TabList,
  TabPanel,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalTransition,
  Form,
  FormHeader,
  FormFooter,
  FormSection,
  DynamicTable,
  List,
  ListItem,

  // Charts
  BarChart,
  LineChart,
  PieChart,
  DonutChart,

  // Additional
  Popup,
  InlineEdit,
  Em,
  Strike,
  Strong,
  User,
  UserGroup,
  Tile,

  // Editors & ADF
  ChromelessEditor,
  CommentEditor,
  AdfRenderer,

  // Hooks

  useProductContext,
  Label,
  RequiredAsterisk,
  HelperMessage,
  ErrorMessage,
  ValidMessage,
} from '@forge/react';

import { showFlag } from '@forge/bridge';

// ─── Helpers ────────────────────────────────────────────────────
const xcssCard = {
  backgroundColor: 'elevation.surface.sunken',
  padding: 'space.200',
  borderRadius: 'border.radius.100',
};

const xcssSection = {
  backgroundColor: 'elevation.surface',
  padding: 'space.300',
  borderRadius: 'border.radius.200',
};

const SectionHeader = ({ title }: { title: string }) => (
  <Box xcss={{ paddingBlock: 'space.100' }}>
    <Heading as="h2">{title}</Heading>
  </Box>
);

// ─── Chart Data ─────────────────────────────────────────────────

const revenueData = [
  { key: 'Jan', value: 42000 },
  { key: 'Feb', value: 53000 },
  { key: 'Mar', value: 61000 },
  { key: 'Apr', value: 47000 },
  { key: 'May', value: 72000 },
  { key: 'Jun', value: 68000 },
];

const userGrowthData = [
  { key: 'Jan', value: 1200 },
  { key: 'Feb', value: 1800 },
  { key: 'Mar', value: 2400 },
  { key: 'Apr', value: 3100 },
  { key: 'May', value: 4200 },
  { key: 'Jun', value: 5800 },
];

const marketShareData = [
  { key: 'Product A', value: 35 },
  { key: 'Product B', value: 25 },
  { key: 'Product C', value: 20 },
  { key: 'Product D', value: 12 },
  { key: 'Other', value: 8 },
];

const categoryData = [
  { key: 'Engineering', value: 45 },
  { key: 'Design', value: 20 },
  { key: 'Marketing', value: 15 },
  { key: 'Sales', value: 12 },
  { key: 'Support', value: 8 },
];

// ─── DynamicTable Data ──────────────────────────────────────────

const tableHead = {
  cells: [
    { key: 'name', content: 'Name', isSortable: true },
    { key: 'role', content: 'Role', isSortable: true },
    { key: 'status', content: 'Status' },
    { key: 'score', content: 'Score', isSortable: true },
  ],
};

const tableRows = [
  {
    key: 'row-1',
    cells: [
      { key: 'name', content: 'Alice Chen' },
      { key: 'role', content: 'Engineer' },
      { key: 'status', content: 'Active' },
      { key: 'score', content: '94' },
    ],
  },
  {
    key: 'row-2',
    cells: [
      { key: 'name', content: 'Bob Martinez' },
      { key: 'role', content: 'Designer' },
      { key: 'status', content: 'Active' },
      { key: 'score', content: '87' },
    ],
  },
  {
    key: 'row-3',
    cells: [
      { key: 'name', content: 'Carol Kim' },
      { key: 'role', content: 'PM' },
      { key: 'status', content: 'Away' },
      { key: 'score', content: '91' },
    ],
  },
  {
    key: 'row-4',
    cells: [
      { key: 'name', content: 'Dan Okafor' },
      { key: 'role', content: 'Engineer' },
      { key: 'status', content: 'Active' },
      { key: 'score', content: '78' },
    ],
  },
];
const checkboxOptions = [
  { value: "jira", label: "Jira" },
  { value: "confluence", label: "Confluence" },
];

const radioOptions = [
  { name: 'color', value: 'red', label: 'Red' },
  { name: 'color', value: 'blue', label: 'Blue' },
  { name: 'color', value: 'yellow', label: 'Yellow' },
  { name: 'color', value: 'green', label: 'Green' },
  { name: 'color', value: 'black', label: 'Black' },
];

// ─── ProgressTracker Steps ──────────────────────────────────────

const trackerStages = [
  { id: 'plan', label: 'Planning', status: 'visited', percentageComplete: 100 },
  { id: 'design', label: 'Design', status: 'visited', percentageComplete: 100 },
  { id: 'develop', label: 'Development', status: 'current', percentageComplete: 60 },
  { id: 'test', label: 'Testing', status: 'unvisited', percentageComplete: 0 },
  { id: 'deploy', label: 'Deploy', status: 'unvisited', percentageComplete: 0 },
];

// ─── Main App ───────────────────────────────────────────────────

const App = () => {
  const [toggleOn, setToggleOn] = useState(false);
  const [rangeValue, setRangeValue] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [inlineDialogOpen, setInlineDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [textValue, setTextValue] = useState('');
  const [selectValue, setSelectValue] = useState(null);
  const [checkboxValues, setCheckboxValues] = useState([]);
  const [radioValue, setRadioValue] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [inlineEditValue, setInlineEditValue] = useState('Blargh!');

  const context = useProductContext();

  const handleShowFlag = () => {
    showFlag({
      id: 'demo-flag',
      title: 'Action completed',
      description: 'This is a demo flag notification.',
      type: 'success',
      isAutoDismiss: true,
    });
  };

  const handleLoadingClick = () => {
    setLoadingBtn(true);
    setTimeout(() => setLoadingBtn(false), 2000);
  };

  return (
    <Stack space="space.400">
      {/* ── Header ── */}
      <Box xcss={{ padding: 'space.300', backgroundColor: 'color.background.brand.bold' }}>
        <Stack space="space.100">
          <Heading as="h1">Kitchen Sink</Heading>
          <Text>A comprehensive showcase of every UIKit 2 component</Text>
        </Stack>
      </Box>

      {/* ── 1. Typography ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="1. Typography" />

          <Heading as="h1">Heading Level 1</Heading>
          <Heading as="h2">Heading Level 2</Heading>
          <Heading as="h3">Heading Level 3</Heading>
          <Heading as="h4">Heading Level 4</Heading>
          <Heading as="h5">Heading Level 5</Heading>
          <Heading as="h6">Heading Level 6</Heading>

          <Text>This is regular body text. It supports <Strong>strong emphasis</Strong>, <Em>italic emphasis</Em>, and <Strike>strikethrough text</Strike>.</Text>

          <Text>Here is some <Code>inline code</Code> within a sentence.</Text>

          <CodeBlock language="typescript" text={`function greet(name: string): string {
  return \`Hello, \${name}! Welcome to the Kitchen Sink.\`;
}

const result = greet('World');
console.log(result);`} />
        </Stack>
      </Box>

      {/* ── 2. Buttons ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="2. Buttons" />

          <ButtonGroup>
            <Button appearance="default" onClick={() => {}}>Default</Button>
            <Button appearance="primary" onClick={() => {}}>Primary</Button>
            <Button appearance="subtle" onClick={() => {}}>Subtle</Button>
            <Button appearance="warning" onClick={() => {}}>Warning</Button>
            <Button appearance="danger" onClick={() => {}}>Danger</Button>
          </ButtonGroup>

          <Inline space="space.100">
            <LinkButton href="https://atlassian.design" appearance="link">Link Button</LinkButton>
            <LoadingButton
              appearance="primary"
              isLoading={loadingBtn}
              onClick={handleLoadingClick}
            >
              {loadingBtn ? 'Loading...' : 'Click to Load'}
            </LoadingButton>
          </Inline>
        </Stack>
      </Box>

      {/* ── 3. Form Controls ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="3. Form Controls" />

          <Form onSubmit={() => {}}>
            <FormHeader title="Sample Form" description="Demonstrating all form input components" />

            <FormSection>
              {/* 1. Label → Textfield → HelperMessage (with RequiredAsterisk as child of Label) */}
              <Label labelFor="text-field">Text Field <RequiredAsterisk /></Label>
              <Textfield
                name="text-field"
                placeholder="Enter some text..."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
              />
              <HelperMessage>You can use your username, email or phone number.</HelperMessage>
              <ErrorMessage>This field is required.</ErrorMessage>

              {/* 2. Label → TextArea */}
              <Label labelFor="text-area">Text Area</Label>
              <TextArea
                name="text-area"
                placeholder="Write a longer message here..."
              />

              {/* 3. Label → Select */}
              <Label labelFor="select">Select</Label>
              <Select
                name="select"
                placeholder="Choose an option"
                options={[
                  { label: 'Apple', value: 'apple' },
                  { label: 'Banana', value: 'banana' },
                  { label: 'Cherry', value: 'cherry' },
                  { label: 'Date', value: 'date' },
                  { label: 'Elderberry', value: 'elderberry' },
                ]}
                value={selectValue}
                onChange={(val) => setSelectValue(val)}
              />
              <ValidMessage>Great choice!</ValidMessage>

              {/* 4. Label → CheckboxGroup (with RequiredAsterisk) */}
              <Label labelFor="checkboxes">Checkboxes <RequiredAsterisk /></Label>
              <CheckboxGroup
                name="checkboxes"
                options={checkboxOptions}
                value={checkboxValues}
                onChange={(e)=>setCheckboxValues(e)}
              />

              {/* 5. Label → RadioGroup */}
              <Label labelFor="radios">Radio</Label>
              <RadioGroup
                name="radios"
                options={radioOptions}
                value={radioValue}
                onChange={(e) => setRadioValue(e.target.value)}
              />
               

              {/* 6. Label → Range → HelperMessage */}
              <Label labelFor="range">Range</Label>
              <Range
                name="range"
                min={0}
                max={100}
                step={1}
                value={rangeValue}
                onChange={(val) => setRangeValue(val)}
              />
              <HelperMessage>Adjust the slider value (0–100).</HelperMessage>

              {/* 7. Label → DatePicker */}
              <Label labelFor="date-picker">Date Picker</Label>
              <DatePicker
                name="date-picker"
                value={dateValue}
                onChange={(val) => setDateValue(val)}
              />

              {/* 8. Label → TimePicker */}
              <Label labelFor="time-picker">Time Picker</Label>
              <TimePicker
                name="time-picker"
                value={timeValue}
                onChange={(val) => setTimeValue(val)}
              />

              {/* 9. Toggle in Inline — passthrough, no Label→Field grouping */}
              <Inline space="space.200" alignBlock="center">
                <Text>Toggle:</Text>
                <Toggle
                  label="Enable feature"
                  isChecked={toggleOn}
                  onChange={() => setToggleOn(!toggleOn)}
                />
                <Text>{toggleOn ? 'ON' : 'OFF'}</Text>
              </Inline>

              {/* 10. Calendar standalone */}
              <Calendar />
            </FormSection>

            <FormFooter>
              <ButtonGroup>
                <Button appearance="subtle" onClick={() => {}}>Cancel</Button>
                <Button appearance="primary" type="submit">Submit</Button>
              </ButtonGroup>
            </FormFooter>
          </Form>
        </Stack>
      </Box>

      {/* ── 4. Display ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="4. Display" />

          <Stack space="space.100">
            <Text>Badges:</Text>
            <Inline space="space.100">
              <Badge appearance="default">12</Badge>
              <Badge appearance="primary">5</Badge>
              <Badge appearance="important">3</Badge>
              <Badge appearance="added">+8</Badge>
              <Badge appearance="removed">-2</Badge>
            </Inline>
          </Stack>

          <Stack space="space.100">
            <Text>Lozenges:</Text>
            <Inline space="space.100">
              <Lozenge appearance="default">Default</Lozenge>
              <Lozenge appearance="success">Success</Lozenge>
              <Lozenge appearance="removed">Error</Lozenge>
              <Lozenge appearance="inprogress">In Progress</Lozenge>
              <Lozenge appearance="new">New</Lozenge>
              <Lozenge appearance="moved">Moved</Lozenge>
              <Lozenge appearance="success" isBold>Bold Success</Lozenge>
            </Inline>
          </Stack>

          <Stack space="space.100">
            <Text>Spinner:</Text>
            <Inline space="space.200" alignBlock="center">
              <Spinner size="small" />
              <Spinner size="medium" />
              <Spinner size="large" />
            </Inline>
          </Stack>

          <Stack space="space.100">
            <Text>Progress Bars:</Text>
            <ProgressBar value={0} />
            <ProgressBar value={0.25} />
            <ProgressBar value={0.5} />
            <ProgressBar value={0.75} />
            <ProgressBar value={1} appearance="success" />
          </Stack>

          <Stack space="space.100">
            <Text>Tags:</Text>
            <TagGroup>
              <Tag text="Frontend" color="blue" />
              <Tag text="Backend" color="green" />
              <Tag text="DevOps" color="purple" />
              <Tag text="Design" color="teal" />
              <Tag text="Urgent" color="red" />
              <Tag text="Documentation" color="yellow" />
            </TagGroup>
          </Stack>

          <Stack space="space.100">
            <Text>Icons:</Text>
            <Inline space="space.100">
              <Icon glyph="check-circle" label="Success" color="color.icon.success" />
              <Icon glyph="cross-circle" label="Error" color="color.icon.danger" />
              <Icon glyph="warning" label="Warning" color="color.icon.warning" />
              <Icon glyph="information" label="Info" color="color.icon.information" />
              <Icon glyph="star-starred" label="Star" color="color.icon.warning" />
              <Icon glyph="add" label="Add" />
              <Icon glyph="close" label="Close" />
            </Inline>
          </Stack>

          <Image src="https://picsum.photos/600/200" alt="Sample landscape image" />

          <Tooltip content="This is a tooltip! Hover or focus to see it.">
            <Button appearance="subtle">Hover me for tooltip</Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* ── 5. Feedback ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="5. Feedback" />

          <SectionMessage appearance="info" title="Information">
            <Text>This is an informational message about the current state of affairs.</Text>
            <SectionMessageAction href="#">Learn more</SectionMessageAction>
          </SectionMessage>

          <SectionMessage appearance="warning" title="Warning">
            <Text>Something needs your attention before proceeding.</Text>
          </SectionMessage>

          <SectionMessage appearance="error" title="Error">
            <Text>An error occurred while processing your request.</Text>
          </SectionMessage>

          <SectionMessage appearance="success" title="Success">
            <Text>Your changes have been saved successfully.</Text>
          </SectionMessage>

          <SectionMessage appearance="discovery" title="Discovery">
            <Text>Did you know? You can customize this panel in settings.</Text>
          </SectionMessage>

          <EmptyState
            header="No results found"
            description="Try adjusting your search or filter criteria."
            primaryAction={<Button appearance="primary" onClick={() => {}}>Create new</Button>}
          />

          <Button appearance="primary" onClick={handleShowFlag}>
            Show Flag Notification
          </Button>
        </Stack>
      </Box>

      {/* ── 6. Layout ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="6. Layout" />

          <Text>Box with xcss styling:</Text>
          <Box xcss={xcssCard}>
            <Text>This box has sunken background, padding, and rounded corners.</Text>
          </Box>

          <Text>Stack (vertical):</Text>
          <Stack space="space.100">
            <Box xcss={{ padding: 'space.100', backgroundColor: 'color.background.accent.blue.subtler' }}>
              <Text>Stack item 1</Text>
            </Box>
            <Box xcss={{ padding: 'space.100', backgroundColor: 'color.background.accent.purple.subtler' }}>
              <Text>Stack item 2</Text>
            </Box>
            <Box xcss={{ padding: 'space.100', backgroundColor: 'color.background.accent.teal.subtler' }}>
              <Text>Stack item 3</Text>
            </Box>
          </Stack>

          <Text>Inline (horizontal):</Text>
          <Inline space="space.100">
            <Box xcss={{ padding: 'space.100', backgroundColor: 'color.background.accent.orange.subtler' }}>
              <Text>Inline A</Text>
            </Box>
            <Box xcss={{ padding: 'space.100', backgroundColor: 'color.background.accent.green.subtler' }}>
              <Text>Inline B</Text>
            </Box>
            <Box xcss={{ padding: 'space.100', backgroundColor: 'color.background.accent.red.subtler' }}>
              <Text>Inline C</Text>
            </Box>
          </Inline>

          <Text>Popup (replaces InlineDialog in UIKit 2):</Text>
          <Popup
            isOpen={inlineDialogOpen}
            onClose={() => setInlineDialogOpen(false)}
            content={() => <Box padding="space.200"><Text>Hello from the Popup!</Text></Box>}
            trigger={(triggerProps: any) => (
              <Button {...triggerProps} onClick={() => setInlineDialogOpen(!inlineDialogOpen)}>
                Toggle Popup
              </Button>
            )}
          />
        </Stack>
      </Box>

      {/* ── 7. Data ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="7. Data" />

          <Text>Dynamic Table (sortable):</Text>
          <DynamicTable
            head={tableHead}
            rows={tableRows}
            defaultSortKey="name"
            defaultSortOrder="ASC"
            rowsPerPage={5}
          />

          <Text>List:</Text>
          <List type="ordered">
            <ListItem>Set up your development environment</ListItem>
            <ListItem>Clone the repository</ListItem>
            <ListItem>Install dependencies with npm install</ListItem>
            <ListItem>Run the development server</ListItem>
            <ListItem>Open your browser to localhost:3000</ListItem>
          </List>

          <List type="unordered">
            <ListItem>React for UI components</ListItem>
            <ListItem>TypeScript for type safety</ListItem>
            <ListItem>Atlaskit for design system</ListItem>
          </List>
        </Stack>
      </Box>

      {/* ── 8. Navigation ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="8. Navigation" />

          <Tabs id="demo-tabs" selected={selectedTab} onChange={setSelectedTab}>
            <TabList>
              <Tab>Overview</Tab>
              <Tab>Details</Tab>
              <Tab>Activity</Tab>
            </TabList>
            <TabPanel>
              <Box xcss={{ padding: 'space.200' }}>
                <Text>This is the Overview tab content. It shows a high-level summary of the project.</Text>
              </Box>
            </TabPanel>
            <TabPanel>
              <Box xcss={{ padding: 'space.200' }}>
                <Stack space="space.100">
                  <Text>Detailed information goes here.</Text>
                  <Text>Project ID: KS-2024-001</Text>
                  <Text>Created: January 15, 2024</Text>
                </Stack>
              </Box>
            </TabPanel>
            <TabPanel>
              <Box xcss={{ padding: 'space.200' }}>
                <Text>Recent activity: No new updates.</Text>
              </Box>
            </TabPanel>
          </Tabs>

          <Link href="https://developer.atlassian.com/platform/forge/" openNewTab>
            Forge Documentation (opens in new tab)
          </Link>

          <Text>Progress Tracker:</Text>
          <ProgressTracker items={trackerStages} />
        </Stack>
      </Box>

      {/* ── 9. Overlays ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="9. Overlays" />

          <Button appearance="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>

          <ModalTransition>
            {modalOpen && (
              <Modal onClose={() => setModalOpen(false)}>
                <ModalHeader>
                  <ModalTitle>Sample Modal</ModalTitle>
                </ModalHeader>
                <ModalBody>
                  <Stack space="space.200">
                    <Text>This is a modal dialog demonstrating the Modal component family.</Text>
                    <Text>It includes ModalHeader, ModalTitle, ModalBody, and ModalFooter.</Text>
                    <Textfield label="Modal Input" name="modal-input" placeholder="Type something..." />
                  </Stack>
                </ModalBody>
                <ModalFooter>
                  <ButtonGroup>
                    <Button appearance="subtle" onClick={() => setModalOpen(false)}>Cancel</Button>
                    <Button appearance="primary" onClick={() => setModalOpen(false)}>Confirm</Button>
                  </ButtonGroup>
                </ModalFooter>
              </Modal>
            )}
          </ModalTransition>

          <Text>Inline Edit:</Text>
          <InlineEdit
            defaultValue={inlineEditValue}
            editView={(fieldProps) => <Textfield {...fieldProps} />}
            readView={() => <Text>{inlineEditValue}</Text>}
            onConfirm={(value) => setInlineEditValue(value)}
          />
        </Stack>
      </Box>

      {/* ── 10. Charts ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.300">
          <SectionHeader title="10. Charts" />

          <Stack space="space.100">
            <Heading as="h4">Monthly Revenue (Bar Chart)</Heading>
            <BarChart data={revenueData} xAccessor="key" yAccessor="value" height={250} />
          </Stack>

          <Stack space="space.100">
            <Heading as="h4">User Growth (Line Chart)</Heading>
            <LineChart data={userGrowthData} xAccessor="key" yAccessor="value" height={250} />
          </Stack>

          <Inline space="space.300">
            <Stack space="space.100">
              <Heading as="h4">Market Share (Pie Chart)</Heading>
              <PieChart data={marketShareData} colorAccessor="key" valueAccessor="value" labelAccessor="key" height={250} />
            </Stack>
            <Stack space="space.100">
              <Heading as="h4">Team Allocation (Donut Chart)</Heading>
              <DonutChart data={categoryData} colorAccessor="key" valueAccessor="value" labelAccessor="key" height={250} />
            </Stack>
          </Inline>
        </Stack>
      </Box>

      {/* ── 11. Users ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="11. Users" />

          <Text>Individual User:</Text>
          <User accountId="user-abc-123" />

          <Text>User Group:</Text>
          <UserGroup>
            <User accountId="user-abc-123" />
            <User accountId="user-def-456" />
            <User accountId="user-ghi-789" />
          </UserGroup>

          <Text>Tile:</Text>
          <Tile
            label="Project Dashboard"
            backgroundColor="color.background.accent.blue.subtle"
            size="xlarge"
            hasBorder
          >
            📊
          </Tile>
        </Stack>
      </Box>

      {/* ── 12. Editors ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="12. Editors" />

          <Text>ChromelessEditor (no toolbar, markdown shortcuts):</Text>
          <ChromelessEditor
            defaultValue={{
              version: 1,
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Try typing here... use ' },
                    { type: 'text', text: '**bold**', marks: [{ type: 'strong' }] },
                    { type: 'text', text: ' or ' },
                    { type: 'text', text: '/slash', marks: [{ type: 'em' }] },
                    { type: 'text', text: ' commands.' },
                  ],
                },
              ],
            }}
            onChange={(val) => console.log('chromeless onChange:', val)}
          />

          <Text>CommentEditor (toolbar + Save/Cancel):</Text>
          <CommentEditor
            defaultValue={{
              version: 1,
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Write your comment here...' },
                  ],
                },
              ],
            }}
            onChange={(val) => console.log('comment onChange:', val)}
            onSave={(val) => console.log('comment onSave:', val)}
            onCancel={() => console.log('comment onCancel')}
          />
        </Stack>
      </Box>

      {/* ── 13. ADF Renderer ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="13. ADF Renderer" />

          <AdfRenderer
            document={{
              version: 1,
              type: 'doc',
              content: [
                {
                  type: 'heading',
                  attrs: { level: 3 },
                  content: [{ type: 'text', text: 'Rendered ADF Content' }],
                },
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'This paragraph has ' },
                    { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
                    { type: 'text', text: ', ' },
                    { type: 'text', text: 'italic', marks: [{ type: 'em' }] },
                    { type: 'text', text: ', and ' },
                    { type: 'text', text: 'code', marks: [{ type: 'code' }] },
                    { type: 'text', text: ' formatting.' },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First bullet' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second bullet' }] }] },
                  ],
                },
                {
                  type: 'codeBlock',
                  attrs: { language: 'typescript' },
                  content: [{ type: 'text', text: 'const greeting = "Hello from ADF!";\nconsole.log(greeting);' }],
                },
                {
                  type: 'panel',
                  attrs: { panelType: 'info' },
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'This info panel is rendered by @atlaskit/renderer.' }] },
                  ],
                },
              ],
            }}
          />
        </Stack>
      </Box>

      {/* ── 14. Context ── */}
      <Box xcss={xcssSection}>
        <Stack space="space.200">
          <SectionHeader title="14. Product Context" />

          <CodeBlock
            language="json"
            text={JSON.stringify(context || { message: 'Loading context...' }, null, 2)}
          />
        </Stack>
      </Box>

      {/* ── Footer ── */}
      <Box xcss={{ padding: 'space.200', backgroundColor: 'elevation.surface.sunken' }}>
        <Text>Kitchen Sink Visual Test — All UIKit 2 components rendered above.</Text>
      </Box>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
