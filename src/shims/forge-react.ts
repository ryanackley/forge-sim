/**
 * @forge/react shim — re-exports the real @forge/react package
 * with correct ESM default export handling.
 */

// @ts-nocheck
import React from 'react';
import { createRequire } from 'node:module';
import { captureRenderElement, captureAddConfigElement, markUseConfigUsed } from '../ui/bridge.js';

// Some @forge/react internals expect React on globalThis
(globalThis as any).React = React;

// Resolve the real @forge/react via Node's standard module resolution.
// This walks up node_modules dirs from the shim's own location — finding
// forge-sim's nested copy if one exists, otherwise the hoisted copy at
// the consumer app's root. Either way it matches what real Forge would
// see at deploy time (parity with the user's installed version).
//
// A hardcoded relative path (`../../node_modules/@forge/react`) used to
// live here. It assumed forge-sim always had a nested copy — which is
// only true when developing forge-sim itself. Once forge-sim is installed
// from npm, package managers usually hoist `@forge/react` to the consumer
// root and the nested path doesn't exist.
const require = createRequire(import.meta.url);
const realModule = require('@forge/react');

// CJS: module.exports.default = ForgeReconciler (which has .render())
//
// We wrap render() and addConfig() so simulator-ui can capture the elements
// the bundle calls them with. This unblocks the "vitest cached the bundle so
// the second render() never re-evaluates the top-level ForgeReconciler.render
// call" case (N9) — simulator-ui replays the captured element against a
// fresh container when the dynamic import returns a cached module.
const realForgeReconciler = realModule.default ?? realModule;
const ForgeReconciler = {
  ...realForgeReconciler,
  render(element: any) {
    captureRenderElement(element);
    return realForgeReconciler.render(element);
  },
  addConfig(element: any) {
    captureAddConfigElement(element);
    return realForgeReconciler.addConfig(element);
  },
};
export default ForgeReconciler;

// Re-export all named components
export const Text = realModule.Text;
export const Button = realModule.Button;
export const LinkButton = realModule.LinkButton;
export const LoadingButton = realModule.LoadingButton;
export const Pressable = realModule.Pressable;
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
export const Tile = realModule.Tile;
export const AtlassianTile = realModule.AtlassianTile;
export const AtlassianIcon = realModule.AtlassianIcon;
// Note: Table/Head/Row/Cell are UIKit 1 components that were removed in real
// @forge/react. Don't re-add them — devs should use DynamicTable instead. The
// drift test in src/__tests__/forge-react-shim.test.ts blocks reintroduction.
export const SectionMessage = realModule.SectionMessage;
export const SectionMessageAction = realModule.SectionMessageAction;
export const Form = realModule.Form;
export const FormHeader = realModule.FormHeader;
export const FormFooter = realModule.FormFooter;
export const FormSection = realModule.FormSection;
export const Label = realModule.Label;
export const ErrorMessage = realModule.ErrorMessage;
export const HelperMessage = realModule.HelperMessage;
export const ValidMessage = realModule.ValidMessage;
export const RequiredAsterisk = realModule.RequiredAsterisk;
// Real @forge/react only exports the lowercase-f spelling (`Textfield`).
// `TextField` (capital F) is the most common Forge import gotcha — devs
// reach for it because it's the casing every other React library uses, and
// `<TextField />` happens to be the ForgeDoc node type emitted at runtime.
// Aliasing `TextField` to `Textfield` here would silently let bad imports
// pass forge-sim tests and then explode on deploy. We deliberately don't.
export const Textfield = realModule.Textfield;
export const TextArea = realModule.TextArea;
export const Select = realModule.Select;
export const Checkbox = realModule.Checkbox;
export const CheckboxGroup = realModule.CheckboxGroup;
export const RadioGroup = realModule.RadioGroup;
export const Radio = realModule.Radio;
export const DatePicker = realModule.DatePicker;
export const TimePicker = realModule.TimePicker;
export const Calendar = realModule.Calendar;
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
export const List = realModule.List;
export const ListItem = realModule.ListItem;
export const EmptyState = realModule.EmptyState;
export const ProgressBar = realModule.ProgressBar;
export const ProgressTracker = realModule.ProgressTracker;
export const Spinner = realModule.Spinner;
export const Lozenge = realModule.Lozenge;
export const FileCard = realModule.FileCard;
export const FilePicker = realModule.FilePicker;
// Charts
export const BarChart = realModule.BarChart;
export const StackBarChart = realModule.StackBarChart;
export const HorizontalBarChart = realModule.HorizontalBarChart;
export const HorizontalStackBarChart = realModule.HorizontalStackBarChart;
export const LineChart = realModule.LineChart;
export const DonutChart = realModule.DonutChart;
export const PieChart = realModule.PieChart;
// Note: InlineDialog and Flag are UIKit 1 components that were removed in
// real @forge/react. Use Popup as the InlineDialog replacement. There's no
// direct Flag replacement — use SectionMessage for prominent notifications.
export const ButtonGroup = realModule.ButtonGroup;
export const Icon = realModule.Icon;
export const Inline = realModule.Inline;
export const useProductContext = realModule.useProductContext;
// Wrapped: tracks whether this module's bundle actually calls useConfig().
// Drives N10 — the "Did you forget setMacroConfig?" timeout hint only fires
// when the bundle actually depends on inline config, not on every macro.
const realUseConfig = realModule.useConfig;
export const useConfig = (...args: any[]) => {
  markUseConfigUsed();
  return realUseConfig(...args);
};
export const useTheme = realModule.useTheme;
export const usePermissions = realModule.usePermissions;

// Property hooks — these use @forge/bridge internally (requestJira/requestConfluence + view.getContext)
// They work because our bridge shim properly routes these calls through the simulator.
export const useIssueProperty = realModule.useIssueProperty;
export const useContentProperty = realModule.useContentProperty;
export const useSpaceProperty = realModule.useSpaceProperty;
export const useObjectStore = realModule.useObjectStore;

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
export const CommentEditor = realModule.CommentEditor;
export const ChromelessEditor = realModule.ChromelessEditor;
export const AdfRenderer = realModule.AdfRenderer;
export const Global = realModule.Global;
export const User = realModule.User;
export const UserGroup = realModule.UserGroup;
export const Em = realModule.Em;
export const Strike = realModule.Strike;
export const Strong = realModule.Strong;
export const Frame = realModule.Frame;
