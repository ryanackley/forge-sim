/**
 * @forge/react shim — re-exports the real @forge/react package
 * with correct ESM default export handling.
 */

// @ts-nocheck
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
export const TextField = realModule.TextField;
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
export const xcss = realModule.xcss;
