/**
 * Component Map — maps ForgeDoc type strings to Atlaskit React components.
 *
 * This is the heart of the renderer. Each ForgeDoc node type gets mapped
 * to a real Atlaskit component so we render genuine Atlassian UI.
 *
 * Phase 1: Core layout + common components (~20 components)
 * Phase 2+: Charts, pickers, editors, etc.
 */

import React from 'react';

// Layout primitives
import { Box, Stack, Inline, Text, xcss } from '@atlaskit/primitives';
import Heading from '@atlaskit/heading';

// Interactive
import Button, { LinkButton } from '@atlaskit/button/new';
import Toggle from '@atlaskit/toggle';
import Range from '@atlaskit/range';
import { Checkbox } from '@atlaskit/checkbox';
import { RadioGroup } from '@atlaskit/radio';
import Textfield from '@atlaskit/textfield';
import TextArea from '@atlaskit/textarea';
import Select from '@atlaskit/select';
import { DatePicker } from '@atlaskit/datetime-picker';

// Display
import Badge from '@atlaskit/badge';
import Lozenge from '@atlaskit/lozenge';
import Spinner from '@atlaskit/spinner';
import ProgressBar from '@atlaskit/progress-bar';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import EmptyState from '@atlaskit/empty-state';
import { Code, CodeBlock } from '@atlaskit/code';
import Tooltip from '@atlaskit/tooltip';
import Tag from '@atlaskit/tag';
import TagGroup from '@atlaskit/tag-group';
import Link from '@atlaskit/link';
import InlineDialog from '@atlaskit/inline-dialog';
import Flag from '@atlaskit/flag';
import DynamicTable from '@atlaskit/dynamic-table';

// Form
import Form, { FormHeader, FormFooter, FormSection, ErrorMessage, HelperMessage } from '@atlaskit/form';

// Tabs
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';

// Modal
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from '@atlaskit/modal-dialog';

// Icons
import Icon from '@atlaskit/icon';

import type { ForgeDoc } from './types';

// ── Types ───────────────────────────────────────────────────────────────

type ComponentRenderer = (
  props: Record<string, any>,
  children: React.ReactNode[],
  doc: ForgeDoc
) => React.ReactElement;

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Extract event handler props — ForgeDoc stores handler function IDs,
 * but in our renderer we wire them back to the event bridge.
 */
function extractEventProps(
  props: Record<string, any>,
  onEvent?: (handlerId: string, eventName: string, ...args: any[]) => void
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      result[key] = (...args: any[]) => {
        if (onEvent) {
          onEvent(value.__id__ ?? 'unknown', key, ...args);
        }
        return value(...args);
      };
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Filter out internal/non-DOM props that shouldn't be passed to Atlaskit.
 */
function cleanProps(props: Record<string, any>): Record<string, any> {
  const { text, ...rest } = props;
  return rest;
}

// ── Component Map ───────────────────────────────────────────────────────

export const COMPONENT_MAP: Record<string, ComponentRenderer> = {
  // Root container
  App: (_props, children) => <>{children}</>,

  // Layout
  Box: (props, children) => <Box {...cleanProps(props)}>{children}</Box>,
  Stack: (props, children) => <Stack {...cleanProps(props)}>{children}</Stack>,
  Inline: (props, children) => <Inline {...cleanProps(props)}>{children}</Inline>,

  // Typography
  Text: (props, children) => {
    if (children.length > 0) {
      return <Text {...cleanProps(props)}>{children}</Text>;
    }
    return <Text {...cleanProps(props)}>{props.content ?? ''}</Text>;
  },
  Heading: (props, children) => (
    <Heading size={props.size ?? 'medium'} {...cleanProps(props)}>
      {children}
    </Heading>
  ),
  String: (props) => <>{props.text ?? ''}</>,

  // Buttons
  Button: (props, children) => (
    <Button
      appearance={props.appearance ?? 'default'}
      onClick={props.onClick}
      isDisabled={props.isDisabled}
      iconBefore={props.icon ? () => <Icon glyph={() => <span>{props.icon}</span>} label="" /> : undefined}
    >
      {children}
    </Button>
  ),
  ButtonGroup: (_props, children) => (
    <Inline space="space.100">{children}</Inline>
  ),
  LinkButton: (props, children) => (
    <LinkButton href={props.href ?? '#'} appearance={props.appearance ?? 'default'}>
      {children}
    </LinkButton>
  ),

  // Form components
  Form: (props, children) => (
    <Form onSubmit={props.onSubmit ?? (() => {})}>
      {({ formProps }: any) => <form {...formProps}>{children}</form>}
    </Form>
  ),
  FormHeader: (props, children) => <FormHeader {...cleanProps(props)}>{children}</FormHeader>,
  FormFooter: (props, children) => <FormFooter {...cleanProps(props)}>{children}</FormFooter>,
  FormSection: (props, children) => <FormSection {...cleanProps(props)}>{children}</FormSection>,
  TextField: (props) => (
    <Textfield
      name={props.name}
      placeholder={props.placeholder}
      value={props.value}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  Textfield: (props) => (
    <Textfield
      name={props.name}
      placeholder={props.placeholder}
      value={props.value}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  TextArea: (props) => (
    <TextArea
      name={props.name}
      placeholder={props.placeholder}
      value={props.value}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  Select: (props) => (
    <Select
      options={props.options ?? []}
      placeholder={props.placeholder}
      value={props.value}
      onChange={props.onChange}
      isMulti={props.isMulti}
    />
  ),
  Checkbox: (props, children) => (
    <Checkbox
      name={props.name}
      label={props.label}
      isChecked={props.isChecked}
      onChange={props.onChange}
    />
  ),
  CheckboxGroup: (_props, children) => <>{children}</>,
  RadioGroup: (props) => (
    <RadioGroup
      options={props.options ?? []}
      value={props.value}
      onChange={props.onChange}
    />
  ),
  Radio: (_props) => <></>,
  Toggle: (props) => (
    <Toggle
      id={props.id}
      isChecked={props.isChecked}
      onChange={props.onChange}
    />
  ),
  Range: (props) => (
    <Range
      min={props.min ?? 0}
      max={props.max ?? 100}
      step={props.step ?? 1}
      value={props.value ?? 50}
      onChange={props.onChange}
    />
  ),
  DatePicker: (props) => (
    <DatePicker
      value={props.value}
      onChange={props.onChange}
      isDisabled={props.isDisabled}
    />
  ),
  ErrorMessage: (props, children) => <ErrorMessage>{children}</ErrorMessage>,
  HelperMessage: (props, children) => <HelperMessage>{children}</HelperMessage>,
  Label: (props, children) => (
    <label htmlFor={props.htmlFor}>{children}</label>
  ),

  // Display
  Badge: (props) => <Badge appearance={props.appearance}>{props.children ?? props.text ?? 0}</Badge>,
  Lozenge: (props, children) => (
    <Lozenge appearance={props.appearance ?? 'default'} isBold={props.isBold}>
      {children}
    </Lozenge>
  ),
  Spinner: (props) => <Spinner size={props.size ?? 'medium'} />,
  ProgressBar: (props) => <ProgressBar value={props.value ?? 0} />,
  SectionMessage: (props, children) => (
    <SectionMessage appearance={props.appearance ?? 'information'} title={props.title}>
      {children}
    </SectionMessage>
  ),
  SectionMessageAction: (props, children) => (
    <SectionMessageAction href={props.href} onClick={props.onClick}>
      {children}
    </SectionMessageAction>
  ),
  EmptyState: (props) => (
    <EmptyState
      header={props.header ?? ''}
      description={props.description}
      primaryAction={props.primaryAction}
    />
  ),
  Code: (props, children) => <Code>{children.length > 0 ? children : props.text ?? ''}</Code>,
  CodeBlock: (props) => <CodeBlock text={props.text ?? ''} language={props.language} />,
  Tooltip: (props, children) => (
    <Tooltip content={props.content ?? ''}>
      {children[0] ?? <span />}
    </Tooltip>
  ),
  Tag: (props) => (
    <Tag text={props.text ?? ''} color={props.color} />
  ),
  TagGroup: (_props, children) => <TagGroup>{children}</TagGroup>,
  Link: (props, children) => (
    <Link href={props.href ?? '#'} openNewTab={props.openNewTab}>
      {children}
    </Link>
  ),
  Image: (props) => (
    <img src={props.src} alt={props.alt ?? ''} style={{ maxWidth: '100%' }} />
  ),
  Icon: (props) => <Icon glyph={() => <span>{props.name ?? '?'}</span>} label={props.label ?? ''} />,
  Flag: (props, children) => (
    <Flag
      title={props.title ?? ''}
      description={props.description}
      appearance={props.appearance}
      icon={<span />}
    />
  ),
  InlineDialog: (props, children) => (
    <InlineDialog content={props.content ?? ''} isOpen={props.isOpen}>
      {children[0] ?? <span />}
    </InlineDialog>
  ),

  // Table
  Table: (_props, children) => <>{children}</>,
  Head: (_props, children) => <>{children}</>,
  Row: (_props, children) => <>{children}</>,
  Cell: (_props, children) => <>{children}</>,
  DynamicTable: (props) => (
    <DynamicTable
      head={props.head}
      rows={props.rows}
      isLoading={props.isLoading}
      rowsPerPage={props.rowsPerPage}
    />
  ),

  // Tabs
  Tabs: (props, children) => <Tabs id={props.id ?? 'tabs'}>{children}</Tabs>,
  TabList: (_props, children) => <TabList>{children}</TabList>,
  Tab: (_props, children) => <Tab>{children}</Tab>,
  TabPanel: (_props, children) => <TabPanel>{children}</TabPanel>,

  // Modal
  Modal: (props, children) => (
    <ModalTransition>
      <Modal onClose={props.onClose}>
        {children}
      </Modal>
    </ModalTransition>
  ),
  ModalHeader: (_props, children) => <ModalHeader>{children}</ModalHeader>,
  ModalTitle: (props, children) => <ModalTitle>{children}</ModalTitle>,
  ModalBody: (_props, children) => <ModalBody>{children}</ModalBody>,
  ModalFooter: (_props, children) => <ModalFooter>{children}</ModalFooter>,
  ModalTransition: (_props, children) => <ModalTransition>{children}</ModalTransition>,

  // List
  List: (props, children) => {
    const Tag = props.type === 'ordered' ? 'ol' : 'ul';
    return <Tag>{children}</Tag>;
  },
  ListItem: (_props, children) => <li>{children}</li>,
};

// ── Fallback ────────────────────────────────────────────────────────────

export const FallbackComponent: ComponentRenderer = (props, children, doc) => (
  <div
    style={{
      border: '1px dashed #ccc',
      padding: '4px 8px',
      margin: '2px 0',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#888',
    }}
  >
    <span style={{ fontWeight: 600 }}>⚠ {doc.type}</span>
    {children.length > 0 && <div>{children}</div>}
  </div>
);
