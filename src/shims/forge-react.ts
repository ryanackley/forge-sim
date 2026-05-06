/**
 * @forge/react shim — re-exports the real @forge/react package
 * with correct ESM default export handling.
 */

// @ts-nocheck
import React from 'react';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Some @forge/react internals expect React on globalThis
(globalThis as any).React = React;

// Resolve the real @forge/react from forge-sim's node_modules by absolute path
const __dirname = dirname(fileURLToPath(import.meta.url));
const realPath = resolve(__dirname, '..', '..', 'node_modules', '@forge', 'react');
const require = createRequire(import.meta.url);
const realModule = require(realPath);

// CJS: module.exports.default = ForgeReconciler (which has .render())
const ForgeReconciler = realModule.default ?? realModule;
export default ForgeReconciler;

// Re-export all named components
export const Text = realModule.Text;
export const Button = realModule.Button;
export const Stack = realModule.Stack;
export const Box = realModule.Box;
export const Badge = realModule.Badge;
export const Code = realModule.Code;
export const CodeBlock = realModule.CodeBlock;
export const Heading = realModule.Heading;
export const Image = realModule.Image;
export const Link = realModule.Link;
export const Tag = realModule.Tag;
export const TagGroup = realModule.TagGroup;
export const Tooltip = realModule.Tooltip;
export const Table = realModule.Table;
export const Head = realModule.Head;
export const Row = realModule.Row;
export const Cell = realModule.Cell;
export const SectionMessage = realModule.SectionMessage;
export const Form = realModule.Form;
// Real @forge/react only exports the lowercase-f spelling (`Textfield`).
// We accept both casings — many devs import as `TextField` because the type
// name is `TextFieldProps`. Both alias to the real string-typed component.
export const Textfield = realModule.Textfield;
export const TextField = realModule.Textfield;
export const TextArea = realModule.TextArea;
export const Select = realModule.Select;
export const Checkbox = realModule.Checkbox;
export const CheckboxGroup = realModule.CheckboxGroup;
export const RadioGroup = realModule.RadioGroup;
export const Radio = realModule.Radio;
export const DatePicker = realModule.DatePicker;
export const Range = realModule.Range;
export const Toggle = realModule.Toggle;
export const UserPicker = realModule.UserPicker;
export const Tabs = realModule.Tabs;
export const Tab = realModule.Tab;
export const TabList = realModule.TabList;
export const TabPanel = realModule.TabPanel;
export const Modal = realModule.Modal;
export const ModalBody = realModule.ModalBody;
export const ModalFooter = realModule.ModalFooter;
export const ModalHeader = realModule.ModalHeader;
export const ModalTitle = realModule.ModalTitle;
export const ModalTransition = realModule.ModalTransition;
export const DynamicTable = realModule.DynamicTable;
export const EmptyState = realModule.EmptyState;
export const ProgressBar = realModule.ProgressBar;
export const Spinner = realModule.Spinner;
export const Lozenge = realModule.Lozenge;
export const InlineDialog = realModule.InlineDialog;
export const Flag = realModule.Flag;
export const ButtonGroup = realModule.ButtonGroup;
export const Icon = realModule.Icon;
export const Inline = realModule.Inline;
export const useProductContext = realModule.useProductContext;
export const useConfig = realModule.useConfig;
export const useTheme = realModule.useTheme;
export const usePermissions = realModule.usePermissions;

// Property hooks — these use @forge/bridge internally (requestJira/requestConfluence + view.getContext)
// They work because our bridge shim properly routes these calls through the simulator.
export const useIssueProperty = realModule.useIssueProperty;
export const useContentProperty = realModule.useContentProperty;
export const useSpaceProperty = realModule.useSpaceProperty;

// Form hook — wraps react-hook-form, re-exported from real package
export const useForm = realModule.useForm;
export const xcss = realModule.xcss;

// i18n — useTranslation reads from I18nContext (set by I18nProvider),
// which calls bridge.i18n.createTranslationFunction → our I18nStore
export const useTranslation = realModule.useTranslation;
export const I18nProvider = realModule.I18nProvider;

// Additional components from @forge/react/components
// These produce ForgeDoc nodes that the renderer maps to Atlaskit equivalents
export const InlineEdit = realModule.InlineEdit;
export const Popup = realModule.Popup;
export const Comment = realModule.Comment;
export const AdfRenderer = realModule.AdfRenderer;
export const Global = realModule.Global;
export const User = realModule.User;
export const UserGroup = realModule.UserGroup;
export const Em = realModule.Em;
export const Strike = realModule.Strike;
export const Strong = realModule.Strong;
export const Frame = realModule.Frame;
