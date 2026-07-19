/**
 * Component Map — maps ForgeDoc type strings to Atlaskit React components.
 *
 * This is the heart of the renderer. Each ForgeDoc node type gets mapped
 * to a real Atlaskit component so we render genuine Atlassian UI.
 *
 * Coverage: 78 UIKit 2 component types (all of @forge/react 12)
 * - Layout: Box, Stack, Inline, Bleed, Pressable, Text, Heading
 * - Navigation: Breadcrumbs, BreadcrumbsItem, Pagination
 * - Interactive: Button, ButtonGroup, LinkButton, LoadingButton, Toggle, Range,
 *   Checkbox, CheckboxGroup, Radio, RadioGroup, Select, TextField, TextArea,
 *   DatePicker, TimePicker, Calendar
 * - Display: Badge, Lozenge, Spinner, ProgressBar, ProgressTracker,
 *   SectionMessage, SectionMessageAction, EmptyState, Code, CodeBlock,
 *   Tooltip, Tag, TagGroup, Link, Image, Icon, Flag, InlineDialog
 * - Structure: Tabs, Tab, TabList, TabPanel, Modal, ModalHeader, ModalTitle,
 *   ModalBody, ModalFooter, ModalTransition, Form, FormHeader, FormFooter,
 *   FormSection, Table, Head, Row, Cell, DynamicTable, List, ListItem
 * - Form helpers: Label, ErrorMessage, HelperMessage, ValidMessage, RequiredAsterisk
 * - Charts: BarChart, LineChart, PieChart, DonutChart, HorizontalBarChart,
 *   StackBarChart, HorizontalStackBarChart (rendered via recharts)
 * - Tiles: Tile, AtlassianTile, AtlassianIcon
 * - File: FileCard, FilePicker
 * - Editors: ChromelessEditor, CommentEditor (@atlaskit/editor-core)
 */

import React from 'react';

// Layout primitives
import { Box, Stack, Inline, Pressable, Text, Bleed, xcss } from '@atlaskit/primitives';
import Heading from '@atlaskit/heading';

// Interactive
import Button, { LinkButton } from '@atlaskit/button/new';
import { LoadingButton } from '@atlaskit/button';
import Toggle from '@atlaskit/toggle';
import Range from '@atlaskit/range';
import { Checkbox } from '@atlaskit/checkbox';
import { RadioGroup } from '@atlaskit/radio';
import Textfield from '@atlaskit/textfield';
import TextArea from '@atlaskit/textarea';
import Select from '@atlaskit/select';
import { DatePicker, TimePicker } from '@atlaskit/datetime-picker';
import Calendar from '@atlaskit/calendar';

// Display
import Badge from '@atlaskit/badge';
import Lozenge from '@atlaskit/lozenge';
import Spinner from '@atlaskit/spinner';
import ProgressBar from '@atlaskit/progress-bar';
import { ProgressTracker } from '@atlaskit/progress-tracker';
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
import Tile from '@atlaskit/tile';
import Avatar, { AvatarItem } from '@atlaskit/avatar';
import AvatarGroup from '@atlaskit/avatar-group';
import InlineEdit from '@atlaskit/inline-edit';
import Popup from '@atlaskit/popup';
import Breadcrumbs, { BreadcrumbsItem } from '@atlaskit/breadcrumbs';
import Pagination from '@atlaskit/pagination';
import AkUserPicker, { type OptionData, type Value as UserPickerSelectValue } from '@atlaskit/user-picker';
// @atlaskit/user-picker requires react-intl context (real Forge's host page
// provides it); wrap locally so the sim works standalone.
import { IntlProvider } from 'react-intl';
import { requestJira } from './bridge/forge-bridge-shim';

// Editors
import { ForgeChromelessEditor, ForgeCommentEditor } from './editors/ForgeEditors';

// ADF Renderer
import { ReactRenderer as AtlaskitRenderer } from '@atlaskit/renderer';

// Form
import Form, {
  Field,
  Fieldset,
  FormHeader,
  FormFooter,
  FormSection,
  ErrorMessage,
  HelperMessage,
  ValidMessage,
  RequiredAsterisk as AtlaskitRequiredAsterisk,
} from '@atlaskit/form';

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

// Icons — resolved via static registry of @atlaskit/icon/core components
import { iconRegistry } from './icon-registry';

// Charts (using recharts since Atlassian's viz-platform-charts is internal)
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell as RechartsCell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import type { ForgeDoc } from './types';
import { groupFormSectionChildren, type CheckboxGroupItem, type RangeFieldItem } from './form-field-grouping';

// ── Types ───────────────────────────────────────────────────────────────

export type ComponentRenderer = (
  props: Record<string, any>,
  children: React.ReactNode[],
  doc: ForgeDoc,
  renderChild: (doc: ForgeDoc) => React.ReactNode
) => React.ReactElement;

// ── Helpers ─────────────────────────────────────────────────────────────

/** Filter out internal/non-DOM props that shouldn't be passed to Atlaskit. */
function cleanProps(props: Record<string, any>): Record<string, any> {
  const { text, ...rest } = props;
  return rest;
}



/** Default chart colors matching Atlaskit's palette */
const CHART_COLORS = [
  '#0052CC', '#00B8D9', '#36B37E', '#FF5630', '#6554C0',
  '#FFAB00', '#FF991F', '#00875A', '#0065FF', '#8777D9',
];

/** Helper to transform ForgeDoc chart data into recharts format */
function transformChartData(
  data: unknown[],
  xAccessor: number | string,
  yAccessor: number | string,
  colorAccessor?: number | string
): any[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  return data.map((item: any) => {
    if (Array.isArray(item)) {
      return {
        x: item[xAccessor as number] ?? '',
        y: item[yAccessor as number] ?? 0,
        color: colorAccessor != null ? item[colorAccessor as number] : undefined,
      };
    }
    return {
      x: item[xAccessor] ?? '',
      y: item[yAccessor] ?? 0,
      color: colorAccessor != null ? item[colorAccessor] : undefined,
    };
  });
}

/** Helper for pie/donut chart data */
function transformPieData(
  data: unknown[],
  colorAccessor: number | string,
  valueAccessor: number | string,
  labelAccessor: number | string
): any[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  return data.map((item: any) => {
    if (Array.isArray(item)) {
      return {
        name: item[labelAccessor as number] ?? '',
        value: item[valueAccessor as number] ?? 0,
        color: item[colorAccessor as number] ?? '',
      };
    }
    return {
      name: item[labelAccessor] ?? '',
      value: item[valueAccessor] ?? 0,
      color: item[colorAccessor] ?? '',
    };
  });
}

/** Format file size for FileCard */
function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── FilePicker (real file selection + drag-and-drop) ────────────────────

/**
 * SerializedFile — the exact shape @forge/react's FilePicker onChange emits
 * (canonical: @atlaskit/forge-react-types FilePickerProps.codegen.d.ts).
 * `data` is plain base64 WITHOUT a data: URL prefix — @forge/bridge's
 * objectStore.upload feeds it straight into atob().
 */
interface SerializedFile {
  data: string;
  name: string;
  size: number;
  type: string;
}

function fileToSerialized(file: File): Promise<SerializedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // readAsDataURL yields "data:<mime>;base64,<data>" — strip the prefix
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ data: base64, name: file.name, size: file.size, type: file.type });
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read file "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

function ForgeFilePicker({ label, description, testId, onChange }: {
  label?: string;
  description?: string;
  testId?: string;
  onChange?: (files: SerializedFile[]) => void | Promise<void>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const emitFiles = async (fileList: FileList | null) => {
    if (!onChange || !fileList || fileList.length === 0) return;
    const files = await Promise.all(Array.from(fileList).map(fileToSerialized));
    await onChange(files);
  };

  return (
    <div
      data-testid={testId}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // The hidden input's own click bubbles back up here — ignore it,
        // or we'd re-trigger the file dialog in a loop.
        if (e.target === inputRef.current) return;
        inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void emitFiles(e.dataTransfer?.files ?? null);
      }}
      style={{
        border: `2px dashed ${dragOver ? '#0052cc' : '#dfe1e6'}`,
        background: dragOver ? '#e9f2ff' : 'transparent',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📎</div>
      <div style={{ fontSize: '14px', fontWeight: 500, color: '#172b4d' }}>
        {label ?? 'Choose files'}
      </div>
      {description && (
        <div style={{ fontSize: '12px', color: '#6b778c', marginTop: '4px' }}>{description}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        data-testid={testId ? `${testId}--input` : undefined}
        onChange={(e) => {
          void emitFiles(e.target.files);
          // Allow re-selecting the same file
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ── Chart wrapper for consistent Atlaskit-like styling ──────────────────

function ChartWrapper({ title, subtitle, width, height, showBorder, children }: {
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  showBorder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      width: width ?? '100%',
      border: showBorder !== false ? '1px solid #dfe1e6' : undefined,
      borderRadius: '8px',
      padding: '16px',
    }}>
      {title && <div style={{ fontSize: '16px', fontWeight: 600, color: '#172b4d', marginBottom: subtitle ? '4px' : '12px' }}>{title}</div>}
      {subtitle && <div style={{ fontSize: '12px', color: '#6b778c', marginBottom: '12px' }}>{subtitle}</div>}
      <ResponsiveContainer width="100%" height={height ?? 400}>
        {children as any}
      </ResponsiveContainer>
    </div>
  );
}

// Hand-rolled ADF renderer removed — now using @atlaskit/renderer (ReactRenderer)

// ── Stateful wrapper components (hooks require real React components) ────

function PopupWrapper({ placement, triggerText, children }: {
  placement?: string;
  triggerText?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popup
      isOpen={open}
      onClose={() => setOpen(false)}
      placement={placement ?? 'bottom-start'}
      content={() => (
        <div style={{ padding: '16px' }}>
          {children}
        </div>
      )}
      trigger={(triggerProps: any) => (
        <Button {...triggerProps} onClick={() => setOpen(!open)}>
          {triggerText ?? 'Toggle Popup'}
        </Button>
      )}
    />
  );
}

// ── Stateful CheckboxGroup wrapper ──────────────────────────────────────

/**
 * UIKit CheckboxGroup onChange expects (values: string[]) — the full array of
 * currently checked values. Atlaskit Checkbox onChange fires a React ChangeEvent
 * per individual checkbox. This wrapper bridges the gap: tracks selected values
 * and funnels individual changes into the UIKit array format.
 */
function CheckboxGroupWrapper({ name, options, value, defaultValue, isDisabled, onChange }: {
  name: string;
  options: Array<{ value: string; label: string; isDisabled?: boolean }>;
  value?: string[];
  defaultValue?: string[];
  isDisabled?: boolean;
  onChange?: (values: string[]) => void;
}) {
  // Controlled (value prop) vs uncontrolled (defaultValue)
  const isControlled = Array.isArray(value);
  const [internalValues, setInternalValues] = React.useState<string[]>(
    Array.isArray(defaultValue) ? defaultValue : []
  );

  const selectedValues = isControlled ? value : internalValues;

  const handleChange = (optValue: string) => (_e: React.ChangeEvent<HTMLInputElement>) => {
    const isCurrentlyChecked = selectedValues.includes(optValue);
    const newValues = isCurrentlyChecked
      ? selectedValues.filter((v) => v !== optValue)
      : [...selectedValues, optValue];

    if (!isControlled) {
      setInternalValues(newValues);
    }
    onChange?.(newValues);
  };

  return (
    <>
      {options.map((opt) => (
        <Checkbox
          key={opt.value}
          name={name}
          label={opt.label}
          value={opt.value}
          isChecked={selectedValues.includes(opt.value)}
          isDisabled={opt.isDisabled || isDisabled}
          onChange={handleChange(opt.value)}
        />
      ))}
    </>
  );
}

// ── UserPicker (Forge) ──────────────────────────────────────────────────

/**
 * Real Forge renders UserPicker against Atlassian's internal user directory
 * service. The sim's closest analog is the product API user search endpoint —
 * mock-first (`forge_mock_routes` on `GET /rest/api/3/user/search`) with
 * real-API fallback when credentials are connected. An unmocked, offline sim
 * behaves like an empty user directory rather than erroring.
 *
 * Forge onChange payload shape (UserPickerValue):
 *   { id, type, avatarUrl, name, email }
 */
function ForgeUserPicker({ name, label, description, placeholder, isRequired, isMulti, defaultValue, onChange }: {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  isRequired?: boolean;
  isMulti?: boolean;
  defaultValue?: string | string[];
  onChange?: (user: any) => void;
}) {
  const fieldId = `user-picker-${name}`;
  const [defaultOptions, setDefaultOptions] = React.useState<OptionData[] | undefined>(undefined);

  const toOption = (u: any): OptionData & { email?: string } => ({
    id: u.accountId ?? u.id ?? '',
    name: u.displayName ?? u.name ?? u.accountId ?? 'Unknown user',
    type: 'user',
    avatarUrl: u.avatarUrls?.['48x48'] ?? u.avatarUrl,
    email: u.emailAddress ?? u.email,
  });

  const loadOptions = React.useCallback(async (query?: string): Promise<OptionData[]> => {
    try {
      const res = await requestJira(`/rest/api/3/user/search?query=${encodeURIComponent(query ?? '')}`);
      const users = await res.json();
      return Array.isArray(users) ? users.map(toOption) : [];
    } catch {
      // No mock route and no real API — behave like an empty directory
      return [];
    }
  }, []);

  // defaultValue is account ID(s); hydrate to option objects via user lookup
  React.useEffect(() => {
    if (defaultValue == null) return;
    const ids = Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    let cancelled = false;
    (async () => {
      const opts: OptionData[] = [];
      for (const id of ids) {
        try {
          const res = await requestJira(`/rest/api/3/user?accountId=${encodeURIComponent(id)}`);
          const user = await res.json();
          if (user && (user.accountId || user.id)) opts.push(toOption(user));
        } catch {
          // Unresolvable ID — show it raw rather than dropping it silently
          opts.push({ id, name: id, type: 'user' });
        }
      }
      if (!cancelled && opts.length > 0) setDefaultOptions(opts);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toForgeValue = (v: any) =>
    v == null ? v : {
      id: v.id ?? '',
      type: v.type ?? 'user',
      avatarUrl: v.avatarUrl ?? '',
      name: v.name ?? '',
      email: v.email ?? '',
    };

  const handleChange = (value: UserPickerSelectValue) => {
    if (Array.isArray(value)) onChange?.(value.map(toForgeValue));
    else onChange?.(toForgeValue(value));
  };

  return (
    <div data-forge-user-picker={name}>
      {label && (
        <label htmlFor={fieldId} style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d' }}>
          {label}
          {isRequired && <span style={{ color: '#de350b', paddingLeft: '2px' }} aria-hidden="true">*</span>}
        </label>
      )}
      <IntlProvider locale="en">
        <AkUserPicker
          // defaultValue is only read on mount — remount once ID hydration lands
          key={defaultOptions ? `${fieldId}-hydrated` : fieldId}
          fieldId={fieldId}
          loadOptions={loadOptions}
          defaultValue={isMulti ? defaultOptions : defaultOptions?.[0]}
          onChange={handleChange}
          isMulti={isMulti}
          placeholder={placeholder}
        />
      </IntlProvider>
      {description && (
        <div style={{ fontSize: '12px', color: '#6b778c', marginTop: '4px' }}>{description}</div>
      )}
    </div>
  );
}

// ── CustomFieldEdit (Jira-specific wrapper for inline edit) ─────────────

/**
 * Wrapper that provides inline edit behavior for custom fields:
 * - Submit when focus leaves the wrapper entirely (unless disableSubmitOnBlur)
 * - Submit on Enter key (unless disableSubmitOnEnter)
 * - Cancel on Escape
 * - Optional confirm ✓ / cancel ✕ buttons
 *
 * Uses React's onBlur (which is actually focusout and bubbles) with
 * relatedTarget check — only submits when focus leaves the wrapper,
 * not when moving between fields inside it.
 */
function CustomFieldEditComponent({
  onSubmit,
  hideActionButtons,
  disableSubmitOnBlur,
  disableSubmitOnEnter,
  children,
}: {
  onSubmit?: () => void;
  hideActionButtons: boolean;
  disableSubmitOnBlur: boolean;
  disableSubmitOnEnter: boolean;
  children: React.ReactNode;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const handleBlur = (e: React.FocusEvent) => {
    if (disableSubmitOnBlur || !onSubmit) return;
    // relatedTarget = element receiving focus next
    // If it's still inside the wrapper, don't submit (user is tabbing between fields)
    if (e.relatedTarget && wrapperRef.current?.contains(e.relatedTarget as Node)) return;
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disableSubmitOnEnter && e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      // Cancel — blur without submitting
      const wrapper = wrapperRef.current;
      if (wrapper) {
        // Temporarily disable blur submit, then blur
        wrapper.dataset.escaping = '1';
        (e.target as HTMLElement)?.blur?.();
        delete wrapper.dataset.escaping;
      }
    }
  };

  const handleBlurGuarded = (e: React.FocusEvent) => {
    // Skip submit if we're escaping (Escape key was pressed)
    if (wrapperRef.current?.dataset.escaping) return;
    handleBlur(e);
  };

  const handleCancel = () => {
    // Blur the active element without triggering submit
    if (wrapperRef.current) wrapperRef.current.dataset.escaping = '1';
    (document.activeElement as HTMLElement)?.blur?.();
    if (wrapperRef.current) delete wrapperRef.current.dataset.escaping;
  };

  return (
    <div
      ref={wrapperRef}
      onBlur={handleBlurGuarded}
      onKeyDown={handleKeyDown}
      style={{ position: 'relative' }}
    >
      {children}
      {!hideActionButtons && onSubmit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
          <button
            onClick={onSubmit}
            style={{
              background: '#0052CC', color: '#fff', border: 'none', borderRadius: '3px',
              padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
            }}
            title="Confirm"
          >✓</button>
          <button
            onClick={handleCancel}
            style={{
              background: '#F4F5F7', color: '#505F79', border: '1px solid #DFE1E6', borderRadius: '3px',
              padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
            }}
            title="Cancel"
          >✕</button>
        </div>
      )}
    </div>
  );
}

// ── Component Map ───────────────────────────────────────────────────────

export const COMPONENT_MAP: Record<string, ComponentRenderer> = {

  // ── Root ─────────────────────────────────────────────────────────────
  App: (_props, children) => <>{children}</>,
  String: (props) => <>{props.text ?? ''}</>,

  // ContentWrapper is Forge's internal component for passing reconciled
  // ReactNode props across the bridge. Transparent in most contexts —
  // complex components like DynamicTable handle it explicitly.
  ContentWrapper: (_props, children) => <>{children}</>,

  // ── Layout ──────────────────────────────────────────────────────────
  Box: (props, children) => {
    const { xcss: rawXcss, ...rest } = cleanProps(props);
    const compiledXcss = rawXcss && typeof rawXcss === 'object' ? xcss(rawXcss) : rawXcss;
    return <Box {...rest} xcss={compiledXcss}>{children}</Box>;
  },
  Stack: (props, children) => {
    const { xcss: rawXcss, ...rest } = cleanProps(props);
    const compiledXcss = rawXcss && typeof rawXcss === 'object' ? xcss(rawXcss) : rawXcss;
    return <Stack {...rest} xcss={compiledXcss}>{children}</Stack>;
  },
  Inline: (props, children) => {
    const { xcss: rawXcss, ...rest } = cleanProps(props);
    const compiledXcss = rawXcss && typeof rawXcss === 'object' ? xcss(rawXcss) : rawXcss;
    return <Inline {...rest} xcss={compiledXcss}>{children}</Inline>;
  },
  Pressable: (props, children) => {
    const { xcss: rawXcss, ...rest } = props;
    const compiledXcss = rawXcss && typeof rawXcss === 'object' ? xcss(rawXcss) : rawXcss;
    return <Pressable onClick={rest.onClick} xcss={compiledXcss}>{children}</Pressable>;
  },
  Bleed: (props, children) => (
    <Bleed all={props.all} inline={props.inline} block={props.block} testId={props.testId}>
      {children}
    </Bleed>
  ),

  // ── Typography ──────────────────────────────────────────────────────
  Text: (props, children) => {
    if (children.length > 0) {
      return <Text {...cleanProps(props)}>{children}</Text>;
    }
    return <Text {...cleanProps(props)}>{props.content ?? ''}</Text>;
  },
  Heading: (props, children) => (
    <Heading size={props.size ?? 'medium'}>{children}</Heading>
  ),

  // ── Buttons ─────────────────────────────────────────────────────────
  Button: (props, children) => (
    <Button
      appearance={props.appearance ?? 'default'}
      onClick={props.onClick}
      isDisabled={props.isDisabled}
      type={props.type}
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
  LoadingButton: (props, children) => (
    <LoadingButton
      appearance={props.appearance ?? 'default'}
      isLoading={props.isLoading}
      isDisabled={props.isDisabled}
      onClick={props.onClick}
      type={props.type}
    >
      {children}
    </LoadingButton>
  ),

  // ── Form components ─────────────────────────────────────────────────
  Form: (props, children) => (
    <Form onSubmit={props.onSubmit ?? (() => {})}>
      {({ formProps }: any) => <form {...formProps}>{children}</form>}
    </Form>
  ),
  FormHeader: (props, children) => <FormHeader {...cleanProps(props)}>{children}</FormHeader>,
  FormFooter: (props, children) => <FormFooter {...cleanProps(props)}>{children}</FormFooter>,
  FormSection: (props, _children, doc, renderChild) => {
    const groups = groupFormSectionChildren(doc.children ?? []);
    return (
      <FormSection {...cleanProps(props)}>
        {groups.map((item, idx) => {
          if (item.kind === 'checkbox-group') {
            const cg = item as CheckboxGroupItem;
            const legendContent = cg.isRequired
              ? <>{cg.labelText} <AtlaskitRequiredAsterisk /></>
              : cg.labelText;
            return (
              <Fieldset key={cg.checkboxGroupDoc.key || `cg-${idx}`} legend={legendContent}>
                {renderChild(cg.checkboxGroupDoc)}
                {cg.messages.map((m) => renderChild(m))}
              </Fieldset>
            );
          }
          if (item.kind === 'range-field') {
            const rf = item as RangeFieldItem;
            return (
              <Field
                key={rf.rangeDoc.key || `range-${idx}`}
                name={rf.name}
                label={rf.labelText}
              >
                {({ fieldProps }) => (
                  <>
                    {renderChild(rf.rangeDoc)}
                    {rf.messages.map((m) => renderChild(m))}
                  </>
                )}
              </Field>
            );
          }
          if (item.kind === 'field') {
            return (
              <Field
                key={item.fieldDoc.key || `field-group-${idx}`}
                name={item.name}
                label={item.labelText}
                isRequired={item.isRequired}
              >
                {({ fieldProps }) => (
                  <>
                    {renderChild(item.fieldDoc)}
                    {item.messages.map((m) => renderChild(m))}
                  </>
                )}
              </Field>
            );
          }
          return (
            <React.Fragment key={item.doc.key || `ps-${idx}`}>
              {renderChild(item.doc)}
            </React.Fragment>
          );
        })}
      </FormSection>
    );
  },
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
      // defaultValue makes the underlying <input> initialize with the
      // declared value — required so inline macro config Save's FormData
      // harvest actually picks it up.
      defaultValue={props.defaultValue}
      value={props.value}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  TextArea: (props) => (
    <TextArea
      name={props.name}
      placeholder={props.placeholder}
      defaultValue={props.defaultValue}
      value={props.value}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  Select: (props) => (
    <Select
      // Pass declared name so the tree-walk fallback in inline-config Save
      // can still find this field even though Atlaskit Select doesn't
      // expose [name] on a real input element for FormData.
      name={props.name}
      options={props.options ?? []}
      placeholder={props.placeholder}
      defaultValue={
        props.defaultValue !== undefined && Array.isArray(props.options)
          ? (props.options as Array<{ value: unknown }>)
              .find((o) => o.value === props.defaultValue) ?? props.defaultValue
          : undefined
      }
      value={props.value}
      onChange={props.onChange}
      isMulti={props.isMulti}
    />
  ),
  Checkbox: (props) => (
    <Checkbox
      name={props.name}
      label={props.label}
      isChecked={props.isChecked}
      onChange={props.onChange}
    />
  ),
  CheckboxGroup: (props) => (
    <CheckboxGroupWrapper
      name={props.name}
      options={props.options ?? []}
      value={props.value}
      defaultValue={props.defaultValue}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  RadioGroup: (props) => (
    <RadioGroup
      options={props.options ?? []}
      value={props.value}
      onChange={props.onChange}
    />
  ),
  Radio: () => <></>,
  Toggle: (props) => (
    <Toggle
      id={props.id}
      isChecked={props.isChecked}
      onChange={props.onChange}
    />
  ),
  Range: (props) => (
    <Range
      id={props.id}
      name={props.name}
      min={props.min ?? 0}
      max={props.max ?? 100}
      step={props.step ?? 1}
      // eval-10 F2: only controlled when the app passes `value` — the old
      // `props.value ?? 50` forced controlled mode at 50 for apps that never
      // set value (e.g. useForm register()), so dragging snapped straight
      // back. Uncontrolled + defaultValue lets the slider actually move.
      value={props.value}
      defaultValue={props.defaultValue}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
      testId={props.testId}
    />
  ),
  DatePicker: (props) => (
    <DatePicker
      value={props.value}
      onChange={props.onChange}
      isDisabled={props.isDisabled}
    />
  ),
  TimePicker: (props) => (
    <TimePicker
      value={props.value}
      onChange={props.onChange}
      isDisabled={props.isDisabled}
    />
  ),
  Calendar: (props) => (
    <Calendar
      day={props.day}
      month={props.month}
      year={props.year}
      selected={props.selected}
      disabled={props.disabled}
      onSelect={props.onSelect}
      onChange={props.onChange}
    />
  ),
  UserPicker: (props) => (
    <ForgeUserPicker
      name={props.name}
      label={props.label}
      description={props.description}
      placeholder={props.placeholder}
      isRequired={props.isRequired}
      isMulti={props.isMulti}
      defaultValue={props.defaultValue}
      onChange={props.onChange}
    />
  ),

  // ── Form helpers ────────────────────────────────────────────────────
  Label: (props, children) => (
    <label htmlFor={props.htmlFor} style={{ fontSize: '14px', fontWeight: 600, color: '#172b4d' }}>
      {children}
    </label>
  ),
  ErrorMessage: (_props, children) => <ErrorMessage>{children}</ErrorMessage>,
  HelperMessage: (_props, children) => <HelperMessage>{children}</HelperMessage>,
  ValidMessage: (_props, children) => <ValidMessage>{children}</ValidMessage>,
  RequiredAsterisk: () => (
    <span style={{ color: '#de350b', paddingLeft: '2px' }} aria-hidden="true">*</span>
  ),

  // ── Display ─────────────────────────────────────────────────────────
  Badge: (props, children) => (
    <Badge appearance={props.appearance}>{children.length > 0 ? children : props.text ?? 0}</Badge>
  ),
  Lozenge: (props, children) => (
    <Lozenge appearance={props.appearance ?? 'default'} isBold={props.isBold}>
      {children}
    </Lozenge>
  ),
  Spinner: (props) => <Spinner size={props.size ?? 'medium'} />,
  ProgressBar: (props) => <ProgressBar value={props.value ?? 0} />,
  ProgressTracker: (props) => (
    <ProgressTracker
      items={props.items ?? []}
      label={props.label}
      animated={props.animated}
      spacing={props.spacing}
    />
  ),
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
  Code: (_props, children) => <Code>{children}</Code>,
  CodeBlock: (props) => <CodeBlock text={props.text ?? ''} language={props.language} />,
  Tooltip: (props, children) => (
    <Tooltip content={props.content ?? ''}>
      {children[0] ?? <span />}
    </Tooltip>
  ),
  Tag: (props) => <Tag text={props.text ?? ''} color={props.color} />,
  TagGroup: (_props, children) => <TagGroup>{children}</TagGroup>,
  Link: (props, children) => (
    <Link href={props.href ?? '#'} openNewTab={props.openNewTab}>
      {children}
    </Link>
  ),
  Image: (props) => (
    <img src={props.src} alt={props.alt ?? ''} style={{ maxWidth: '100%' }} />
  ),
  Icon: (props) => {
    const glyphName = props.glyph ?? props.name ?? '';
    const label = props.label ?? '';
    const color = props.color ?? props.primaryColor ?? 'currentColor';
    const IconComponent = iconRegistry[glyphName];
    if (!IconComponent) return <span title={`${label} (${glyphName})`} style={{ fontSize: '20px' }}>❓</span>;
    return <IconComponent label={label} color={color} />;
  },
  Flag: (props) => (
    <Flag
      title={props.title ?? ''}
      description={props.description}
      appearance={props.appearance}
      icon={<span />}
      id={props.id ?? 'flag'}
    />
  ),

  // ── Navigation ──────────────────────────────────────────────────────
  Breadcrumbs: (props, children) => (
    <Breadcrumbs
      defaultExpanded={props.defaultExpanded}
      isExpanded={props.isExpanded}
      maxItems={props.maxItems}
      itemsBeforeCollapse={props.itemsBeforeCollapse}
      itemsAfterCollapse={props.itemsAfterCollapse}
      // Forge signature is () => void; drop Atlaskit's (event, analyticsEvent)
      // args so nothing unserializable crosses the function-prop bridge.
      onExpand={props.onExpand ? () => props.onExpand() : undefined}
      label={props.label}
      ellipsisLabel={props.ellipsisLabel}
      testId={props.testId}
    >
      {children}
    </Breadcrumbs>
  ),
  BreadcrumbsItem: (props) => {
    // iconBefore/iconAfter are ADS glyph name strings in Forge; resolve via
    // the same registry the Icon component uses.
    const resolveIcon = (glyph?: string): React.ReactElement | undefined => {
      if (!glyph) return undefined;
      const IconComponent = iconRegistry[glyph];
      return IconComponent ? <IconComponent label="" /> : undefined;
    };
    return (
      <BreadcrumbsItem
        text={props.text ?? ''}
        href={props.href}
        iconBefore={resolveIcon(props.iconBefore)}
        iconAfter={resolveIcon(props.iconAfter)}
        testId={props.testId}
      />
    );
  },
  Pagination: (props) => (
    <Pagination
      pages={props.pages ?? []}
      defaultSelectedIndex={props.defaultSelectedIndex}
      selectedIndex={props.selectedIndex}
      max={props.max}
      label={props.label}
      nextLabel={props.nextLabel}
      previousLabel={props.previousLabel}
      pageLabel={props.pageLabel}
      testId={props.testId}
      // Forge signature is (page: number) => void; Atlaskit's is
      // (event, page, analyticsEvent). Forward only the serializable page.
      onChange={props.onChange ? (_e: unknown, page: unknown) => props.onChange(page) : undefined}
    />
  ),
  InlineDialog: (props, children) => (
    <InlineDialog content={props.content ?? ''} isOpen={props.isOpen}>
      {children[0] ?? <span />}
    </InlineDialog>
  ),

  // ── Table ───────────────────────────────────────────────────────────
  // Simple table — ForgeDoc Table/Head/Row/Cell maps to HTML table elements
  // styled to look like Atlaskit's table appearance
  Table: (_props, children) => (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px',
      color: '#172b4d',
    }}>
      {children}
    </table>
  ),
  Head: (_props, children) => (
    <thead style={{ borderBottom: '2px solid #dfe1e6' }}>
      <tr>{children}</tr>
    </thead>
  ),
  Row: (_props, children) => (
    <tr style={{ borderBottom: '1px solid #dfe1e6' }}>{children}</tr>
  ),
  Cell: (_props, children) => (
    <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{children}</td>
  ),
  DynamicTable: (_props, _children, doc, renderChild) => {
    // Forge's @forge/react DynamicTable decomposes head/rows into a ForgeDoc
    // child tree using ContentWrapper/Row/Cell nodes. We reconstruct the
    // Atlaskit DynamicTable prop format from this tree, using renderChild
    // to get fully-wired React nodes (with event handlers and all).
    let head: any = undefined;
    let rows: any = undefined;

    for (const child of doc.children ?? []) {
      if (child.type === 'ContentWrapper' && child.props?.name === 'head') {
        head = {
          cells: (child.children ?? []).map((cell) => {
            const { cellKey, ...cellProps } = cell.props ?? {};
            return {
              key: cellKey,
              content: (cell.children ?? []).length === 1
                ? renderChild(cell.children[0])
                : (cell.children ?? []).map((c, i) => (
                    <React.Fragment key={c.key || `hc${i}`}>
                      {renderChild(c)}
                    </React.Fragment>
                  )),
              ...cellProps,
            };
          }),
        };
      } else if (child.type === 'ContentWrapper' && child.props?.name === 'rows') {
        rows = (child.children ?? []).map((row) => {
          const { rowKey, ...rowProps } = row.props ?? {};
          return {
            key: rowKey,
            cells: (row.children ?? []).map((cell) => {
              const { cellKey, ...cellProps } = cell.props ?? {};
              return {
                key: cellKey,
                content: (cell.children ?? []).length === 1
                  ? renderChild(cell.children[0])
                  : (cell.children ?? []).map((c, i) => (
                      <React.Fragment key={c.key || `rc${i}`}>
                        {renderChild(c)}
                      </React.Fragment>
                    )),
                ...cellProps,
              };
            }),
            ...rowProps,
          };
        });
      }
    }

    // Pass through remaining props (isLoading, rowsPerPage, etc.)
    const { head: _h, rows: _r, ...tableProps } = doc.props ?? {};
    return (
      <DynamicTable
        head={head}
        rows={rows}
        isLoading={tableProps.isLoading}
        rowsPerPage={tableProps.rowsPerPage}
        {...tableProps}
      />
    );
  },

  // ── Tabs ────────────────────────────────────────────────────────────
  Tabs: (props, children) => <Tabs id={props.id ?? 'tabs'}>{children}</Tabs>,
  TabList: (_props, children) => <TabList>{children}</TabList>,
  Tab: (_props, children) => <Tab>{children}</Tab>,
  TabPanel: (_props, children) => <TabPanel>{children}</TabPanel>,

  // ── Modal ───────────────────────────────────────────────────────────
  // Real Forge: when `title` is supplied, the platform automatically renders
  // a ModalHeader containing a ModalTitle (per @atlaskit/forge-react-types
  // ModalProps.codegen). Per Forge docs: "If supplied, we will render a
  // ModalHeader with a ModalTitle for them." We mirror that here so headless
  // tests + the dev server both surface the title text.
  Modal: (props, children) => (
    <Modal
      onClose={props.onClose}
      width={props.width}
      height={props.height}
      shouldScrollInViewport={props.shouldScrollInViewport}
      autoFocus={props.autoFocus}
      label={props.label}
      testId={props.testId}
    >
      {props.title && (
        <ModalHeader>
          <ModalTitle>{props.title}</ModalTitle>
        </ModalHeader>
      )}
      {children}
    </Modal>
  ),
  ModalHeader: (_props, children) => <ModalHeader>{children}</ModalHeader>,
  ModalTitle: (props, children) => (
    <ModalTitle appearance={props.appearance} isMultiline={props.isMultiline} testId={props.testId}>
      {children}
    </ModalTitle>
  ),
  ModalBody: (_props, children) => <ModalBody>{children}</ModalBody>,
  ModalFooter: (_props, children) => <ModalFooter>{children}</ModalFooter>,
  ModalTransition: (_props, children) => <ModalTransition>{children}</ModalTransition>,

  // ── List ────────────────────────────────────────────────────────────
  List: (props, children) => {
    const Tag = props.type === 'ordered' ? 'ol' : 'ul';
    return <Tag style={{ paddingLeft: '24px', margin: '8px 0' }}>{children}</Tag>;
  },
  ListItem: (_props, children) => <li style={{ marginBottom: '4px' }}>{children}</li>,

  // ── Tile ────────────────────────────────────────────────────────────
  Tile: (props, children) => (
    <Tile
      label={props.label ?? ''}
      backgroundColor={props.backgroundColor}
      size={props.size}
      hasBorder={props.hasBorder}
      isInset={props.isInset}
    >
      {children}
    </Tile>
  ),
  // AtlassianTile and AtlassianIcon reference @atlaskit/object which is
  // a heavier dependency — render a styled placeholder that looks right
  AtlassianTile: (props) => {
    const glyphColors: Record<string, string> = {
      bug: '#FF5630', task: '#0052CC', story: '#36B37E', epic: '#6554C0',
      idea: '#FFAB00', incident: '#FF5630', improvement: '#36B37E',
      'new-feature': '#36B37E', subtask: '#0052CC', question: '#00B8D9',
      page: '#0052CC', 'page-live-doc': '#00B8D9', blog: '#6554C0',
      branch: '#6554C0', code: '#6554C0', commit: '#6554C0',
      'pull-request': '#36B37E', calendar: '#FF991F', changes: '#00B8D9',
      database: '#6554C0', whiteboard: '#00B8D9', 'work-item': '#0052CC',
      problem: '#FF5630',
    };
    const color = glyphColors[props.glyph] ?? '#0052CC';
    const sizeMap: Record<string, number> = { xsmall: 20, small: 24, medium: 32, large: 40, xlarge: 48 };
    const size = sizeMap[props.size ?? 'medium'] ?? 32;
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '6px',
        background: props.isBold ? color : `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        color: props.isBold ? '#fff' : color,
      }}
        title={props.label ?? props.glyph}
      >
        {(props.glyph ?? '?')[0].toUpperCase()}
      </div>
    );
  },
  AtlassianIcon: (props) => {
    const glyphColors: Record<string, string> = {
      bug: '#FF5630', task: '#0052CC', story: '#36B37E', epic: '#6554C0',
      idea: '#FFAB00', incident: '#FF5630', page: '#0052CC',
    };
    const color = glyphColors[props.glyph] ?? '#0052CC';
    const size = props.size === 'small' ? 12 : 16;
    return (
      <span style={{ color, fontSize: size, lineHeight: 1 }} title={props.label ?? props.glyph}>
        ●
      </span>
    );
  },

  // ── File components ─────────────────────────────────────────────────
  FileCard: (props) => (
    <div
      data-testid={props.testId}
      style={{
        border: '1px solid #dfe1e6',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: props.error ? '#ffebe6' : '#fff',
      }}
    >
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '4px',
        background: '#f4f5f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
      }}>
        📄
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#172b4d' }}>
          {props.fileName ?? 'Unknown file'}
        </div>
        <div style={{ fontSize: '12px', color: '#6b778c' }}>
          {[props.fileType, formatFileSize(props.fileSize)].filter(Boolean).join(' · ')}
        </div>
        {props.isUploading && props.uploadProgress != null && (
          <div
            data-testid={props.testId ? `${props.testId}--progress` : undefined}
            role="progressbar"
            aria-valuenow={Math.round(Math.min(Math.max(props.uploadProgress, 0), 1) * 100)}
            style={{
              marginTop: '6px',
              height: '4px',
              borderRadius: '2px',
              background: '#dfe1e6',
              overflow: 'hidden',
            }}
          >
            <div style={{
              height: '100%',
              width: `${Math.min(Math.max(props.uploadProgress, 0), 1) * 100}%`,
              background: '#0052cc',
              transition: 'width 0.2s',
            }} />
          </div>
        )}
        {props.error && (
          <div style={{ fontSize: '12px', color: '#de350b', marginTop: '4px' }}>{props.error}</div>
        )}
      </div>
      {props.isUploading && <Spinner size="small" />}
      {props.onDownload && (
        <button onClick={props.onDownload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0052cc', fontSize: '13px' }}>
          Download
        </button>
      )}
      {props.onDelete && (
        <button onClick={props.onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#de350b', fontSize: '13px' }}>
          Delete
        </button>
      )}
    </div>
  ),
  FilePicker: (props) => (
    <ForgeFilePicker
      label={props.label}
      description={props.description}
      testId={props.testId}
      onChange={props.onChange}
    />
  ),

  // ── Editors (@atlaskit/editor-core) ─────────────────────────────────
  ChromelessEditor: (props) => (
    <ForgeChromelessEditor
      defaultValue={props.defaultValue}
      features={props.features}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
    />
  ),
  CommentEditor: (props) => (
    <ForgeCommentEditor
      defaultValue={props.defaultValue}
      features={props.features}
      isDisabled={props.isDisabled}
      onChange={props.onChange}
      onSave={props.onSave}
      onCancel={props.onCancel}
    />
  ),

  // ── Additional Components ──────────────────────────────────────────

  InlineEdit: (props, _children, doc, renderChild) => {
    // Forge's InlineEdit evaluates readView/editView on the reconciler side
    // and sends results as ContentWrapper children:
    //   ContentWrapper(name="editView") → rendered edit UI
    //   ContentWrapper(name="readView") → rendered read UI
    let editViewContent: React.ReactNode = null;
    let readViewContent: React.ReactNode = null;

    for (const child of doc.children ?? []) {
      if (child.type === 'ContentWrapper' && child.props?.name === 'editView') {
        editViewContent = (child.children ?? []).map((c) => renderChild(c));
      } else if (child.type === 'ContentWrapper' && child.props?.name === 'readView') {
        readViewContent = (child.children ?? []).map((c) => renderChild(c));
      }
    }

    return (
      <InlineEdit
        label={props.label}
        isRequired={props.isRequired}
        defaultValue={props.defaultValue ?? ''}
        onConfirm={(value: any) => props.onConfirm?.(value)}
        editView={() => <>{editViewContent}</>}
        readView={() => <>{readViewContent || props.defaultValue || 'Click to edit'}</>}
      />
    );
  },

  Popup: (_props, children) => (
    <PopupWrapper placement={_props.placement} triggerText={_props.triggerText}>
      {children}
    </PopupWrapper>
  ),

  // Comment per @atlaskit/forge-react-types CommentProps.codegen:
  //   - author?: string | { text: string, onClick? }
  //   - time?:   string | { text: string, onClick? }
  //   - edited?: string  (italic next to time/author per Atlaskit's Comment)
  //   - actions?, errorActions?: Array<{ text: string, onClick? }>
  //   - type?:   string  (renders as a Lozenge before the content)
  //   - restrictedTo?: string  (label before the main content)
  //   - savingText?: string + isSaving?: boolean (optimistic-saving indicator)
  // Per docs author/time are documented as object form; our renderer also
  // accepts plain string for ergonomic backward-compat.
  Comment: (props, children, _doc, renderChild) => {
    const extractText = (v: unknown): string | undefined => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string') {
        return (v as { text: string }).text;
      }
      return undefined;
    };
    const extractClick = (v: unknown): (() => void) | undefined => {
      if (v && typeof v === 'object' && typeof (v as { onClick?: unknown }).onClick === 'function') {
        return (v as { onClick: () => void }).onClick;
      }
      return undefined;
    };

    const authorText = extractText(props.author);
    const authorOnClick = extractClick(props.author);
    const timeText = extractText(props.time);
    const timeOnClick = extractClick(props.time);
    const editedText: string | undefined = typeof props.edited === 'string' ? props.edited : undefined;

    const actions = Array.isArray(props.actions) ? props.actions : [];
    const errorActions = Array.isArray(props.errorActions) ? props.errorActions : [];
    const visibleActions = props.isError ? errorActions : actions;

    return (
      <div style={{
        border: '1px solid #DFE1E6', borderRadius: '3px', padding: '12px 16px', margin: '4px 0',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          {props.type && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
              background: '#EAE6FF', color: '#403294', textTransform: 'uppercase',
            }}>
              {props.type}
            </span>
          )}
          {props.restrictedTo && (
            <span style={{ fontSize: '12px', color: '#6B778C' }}>
              {props.restrictedTo}
            </span>
          )}
          {authorText && (
            authorOnClick ? (
              <button
                onClick={authorOnClick}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontWeight: 600, fontSize: '14px', color: '#0052CC',
                }}
              >
                {authorText}
              </button>
            ) : (
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#172B4D' }}>
                {authorText}
              </span>
            )
          )}
          {timeText && (
            timeOnClick ? (
              <button
                onClick={timeOnClick}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '12px', color: '#6B778C',
                }}
              >
                {timeText}
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#6B778C' }}>
                {timeText}
              </span>
            )
          )}
          {editedText && (
            <span style={{ fontSize: '12px', color: '#6B778C', fontStyle: 'italic' }}>
              {editedText}
            </span>
          )}
        </div>
        <div style={{ fontSize: '14px', color: '#172B4D' }}>
          {children.map((child, i) => renderChild(child, i))}
        </div>
        {props.isSaving && props.savingText && (
          <div style={{ fontSize: '12px', color: '#6B778C', marginTop: '4px', fontStyle: 'italic' }}>
            {props.savingText}
          </div>
        )}
        {visibleActions.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {visibleActions.map((action: { text: string; onClick?: () => void }, i: number) => (
              <button
                key={i}
                onClick={action.onClick}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '13px', color: props.isError ? '#DE350B' : '#0052CC',
                }}
              >
                {action.text}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },

  AdfRenderer: (props) => {
    const doc = typeof props.document === 'string' ? JSON.parse(props.document) : props.document;
    if (!doc || !doc.content) return null;
    return <AtlaskitRenderer document={doc} />;
  },

  Global: (_props, children, _doc, renderChild) => (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{
        width: '240px', background: '#f4f5f7', borderRight: '1px solid #DFE1E6',
        padding: '16px',
      }}>
        {/* Sidebar placeholder */}
      </nav>
      <main style={{ flex: 1, padding: '24px' }}>
        {children.map((child, i) => renderChild(child, i))}
      </main>
    </div>
  ),

  User: (props) => {
    const name = props.name ?? props.accountId ?? 'User';
    return (
      <AvatarItem
        avatar={<Avatar name={name} size="small" />}
        primaryText={name}
      />
    );
  },

  UserGroup: (_props, _children, doc) => {
    // Extract avatar data from raw ForgeDoc children (User nodes)
    const data = (doc?.children ?? []).map((child, i) => ({
      key: child.key ?? `user-${i}`,
      name: child.props?.name ?? child.props?.accountId ?? 'User',
    }));
    return <AvatarGroup appearance="stack" data={data} />;
  },

  Em: (_props, children) => (
    <em>{children}</em>
  ),

  Strike: (_props, children) => (
    <s>{children}</s>
  ),

  Strong: (_props, children) => (
    <strong>{children}</strong>
  ),

  Frame: (props) => (
    <iframe
      src={props.url ?? ''}
      title={props.title ?? 'Embedded content'}
      style={{
        width: '100%', height: props.height ?? '400px',
        border: '1px solid #DFE1E6', borderRadius: '4px',
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  ),

  // ── Charts (using recharts) ─────────────────────────────────────────

  BarChart: (props) => {
    const data = transformChartData(props.data ?? [], props.xAccessor ?? 0, props.yAccessor ?? 1, props.colorAccessor);
    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe1e6" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="y" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ChartWrapper>
    );
  },
  StackBarChart: (props) => {
    const data = transformChartData(props.data ?? [], props.xAccessor ?? 0, props.yAccessor ?? 1, props.colorAccessor);
    // Group data by x value for stacking
    const grouped = new Map<string, any>();
    for (const d of data) {
      const key = String(d.x);
      if (!grouped.has(key)) grouped.set(key, { x: d.x });
      const colorKey = d.color ?? 'value';
      grouped.get(key)[colorKey] = (grouped.get(key)[colorKey] ?? 0) + d.y;
    }
    const stackData = [...grouped.values()];
    const colorKeys = [...new Set(data.map((d: any) => d.color ?? 'value'))];

    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsBarChart data={stackData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe1e6" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip />
          <Legend />
          {colorKeys.map((key, i) => (
            <Bar key={String(key)} dataKey={String(key)} stackId="stack" fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </RechartsBarChart>
      </ChartWrapper>
    );
  },
  HorizontalBarChart: (props) => {
    const data = transformChartData(props.data ?? [], props.xAccessor ?? 0, props.yAccessor ?? 1);
    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsBarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe1e6" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="x" tick={{ fontSize: 12 }} width={100} />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="y" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
        </RechartsBarChart>
      </ChartWrapper>
    );
  },
  HorizontalStackBarChart: (props) => {
    const data = transformChartData(props.data ?? [], props.xAccessor ?? 0, props.yAccessor ?? 1, props.colorAccessor);
    const grouped = new Map<string, any>();
    for (const d of data) {
      const key = String(d.x);
      if (!grouped.has(key)) grouped.set(key, { x: d.x });
      const colorKey = d.color ?? 'value';
      grouped.get(key)[colorKey] = (grouped.get(key)[colorKey] ?? 0) + d.y;
    }
    const stackData = [...grouped.values()];
    const colorKeys = [...new Set(data.map((d: any) => d.color ?? 'value'))];

    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsBarChart data={stackData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe1e6" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="x" tick={{ fontSize: 12 }} width={100} />
          <RechartsTooltip />
          <Legend />
          {colorKeys.map((key, i) => (
            <Bar key={String(key)} dataKey={String(key)} stackId="stack" fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </RechartsBarChart>
      </ChartWrapper>
    );
  },
  LineChart: (props) => {
    const data = transformChartData(props.data ?? [], props.xAccessor ?? 0, props.yAccessor ?? 1);
    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe1e6" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip />
          <Legend />
          <Line type="monotone" dataKey="y" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
        </RechartsLineChart>
      </ChartWrapper>
    );
  },
  PieChart: (props) => {
    const data = transformPieData(
      props.data ?? [],
      props.colorAccessor ?? 0,
      props.valueAccessor ?? 1,
      props.labelAccessor ?? 0
    );
    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            label={props.showMarkLabels ? ({ name }: any) => name : undefined}
          >
            {data.map((_: any, i: number) => (
              <RechartsCell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip />
          <Legend />
        </RechartsPieChart>
      </ChartWrapper>
    );
  },
  DonutChart: (props) => {
    const data = transformPieData(
      props.data ?? [],
      props.colorAccessor ?? 0,
      props.valueAccessor ?? 1,
      props.labelAccessor ?? 0
    );
    return (
      <ChartWrapper title={props.title} subtitle={props.subtitle} width={props.width} height={props.height} showBorder={props.showBorder}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={props.innerRadius ?? '50%'}
            outerRadius={props.outerRadius ?? '80%'}
            label={props.showMarkLabels ? ({ name }: any) => name : undefined}
          >
            {data.map((_: any, i: number) => (
              <RechartsCell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip />
          <Legend />
        </RechartsPieChart>
      </ChartWrapper>
    );
  },

  // ── Jira-Specific Components ──────────────────────────────────────────

  CustomFieldEdit: (props, children) => (
    <CustomFieldEditComponent
      onSubmit={props.onSubmit as (() => void) | undefined}
      hideActionButtons={props.hideActionButtons === true}
      disableSubmitOnBlur={props.disableSubmitOnBlur === true}
      disableSubmitOnEnter={props.disableSubmitOnEnter === true}
    >{children}</CustomFieldEditComponent>
  ),
};

// ── Fallback ────────────────────────────────────────────────────────────

export const FallbackComponent: ComponentRenderer = (_props, children, doc, _renderChild) => (
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
