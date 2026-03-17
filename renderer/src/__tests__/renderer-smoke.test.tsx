/**
 * ForgeDocRenderer smoke tests — verifies every component type in COMPONENT_MAP
 * renders without crashing and produces expected DOM output.
 *
 * These are non-interactive rendering tests only. Interactivity tests will
 * be covered by Playwright.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import AppProvider from '@atlaskit/app-provider';
import { ForgeDocRenderer } from '../ForgeDocRenderer';
import type { ForgeDoc } from '../types';

// Mock the editors — @atlaskit/editor-core requires browser APIs not
// available in jsdom (contentEditable, ProseMirror, etc.)
vi.mock('../editors/ForgeEditors', () => ({
  ForgeChromelessEditor: () => <div data-testid="chromeless-editor" />,
  ForgeCommentEditor: () => <div data-testid="comment-editor" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────────

let keyCounter = 0;

beforeEach(() => {
  keyCounter = 0;
});

function makeDoc(
  type: string,
  props: Record<string, any> = {},
  children: ForgeDoc[] = [],
): ForgeDoc {
  return { type, props, children, key: `${type}-${++keyCounter}` };
}

function renderDoc(doc: ForgeDoc) {
  return render(
    <AppProvider>
      <ForgeDocRenderer
        doc={{ type: 'Root', props: {}, children: [doc], key: 'root' }}
      />
    </AppProvider>,
  );
}

function renderDocs(docs: ForgeDoc[]) {
  return render(
    <AppProvider>
      <ForgeDocRenderer
        doc={{ type: 'Root', props: {}, children: docs, key: 'root' }}
      />
    </AppProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ForgeDocRenderer smoke tests', () => {
  // ── Primitives ───────────────────────────────────────────────────────

  describe('Primitives', () => {
    it('App renders children', () => {
      renderDoc(makeDoc('App', {}, [makeDoc('String', { text: 'Hello App' })]));
      expect(screen.getByText('Hello App')).toBeInTheDocument();
    });

    it('String renders text', () => {
      renderDoc(makeDoc('String', { text: 'plain text' }));
      expect(screen.getByText('plain text')).toBeInTheDocument();
    });

    it('ContentWrapper renders children transparently', () => {
      renderDoc(
        makeDoc('ContentWrapper', {}, [
          makeDoc('String', { text: 'wrapped' }),
        ]),
      );
      expect(screen.getByText('wrapped')).toBeInTheDocument();
    });

    it('Box renders children', () => {
      renderDoc(
        makeDoc('Box', { padding: 'space.200' }, [
          makeDoc('String', { text: 'box content' }),
        ]),
      );
      expect(screen.getByText('box content')).toBeInTheDocument();
    });

    it('Stack renders children', () => {
      renderDoc(
        makeDoc('Stack', { space: 'space.100' }, [
          makeDoc('String', { text: 'stacked' }),
        ]),
      );
      expect(screen.getByText('stacked')).toBeInTheDocument();
    });

    it('Inline renders children', () => {
      renderDoc(
        makeDoc('Inline', { space: 'space.100' }, [
          makeDoc('String', { text: 'inline content' }),
        ]),
      );
      expect(screen.getByText('inline content')).toBeInTheDocument();
    });

    it('Text renders with content prop', () => {
      renderDoc(makeDoc('Text', { content: 'text content' }));
      expect(screen.getByText('text content')).toBeInTheDocument();
    });

    it('Text renders with children', () => {
      renderDoc(
        makeDoc('Text', {}, [makeDoc('String', { text: 'child text' })]),
      );
      expect(screen.getByText('child text')).toBeInTheDocument();
    });

    it('Heading renders', () => {
      renderDoc(
        makeDoc('Heading', { size: 'large' }, [
          makeDoc('String', { text: 'My Heading' }),
        ]),
      );
      expect(screen.getByText('My Heading')).toBeInTheDocument();
    });

    it('Em renders italic text', () => {
      renderDoc(
        makeDoc('Em', {}, [makeDoc('String', { text: 'emphasized' })]),
      );
      expect(screen.getByText('emphasized').closest('em')).toBeInTheDocument();
    });

    it('Strike renders struck text', () => {
      renderDoc(
        makeDoc('Strike', {}, [makeDoc('String', { text: 'deleted' })]),
      );
      expect(screen.getByText('deleted').closest('s')).toBeInTheDocument();
    });

    it('Strong renders bold text', () => {
      renderDoc(
        makeDoc('Strong', {}, [makeDoc('String', { text: 'bold' })]),
      );
      expect(
        screen.getByText('bold').closest('strong'),
      ).toBeInTheDocument();
    });
  });

  // ── Buttons ──────────────────────────────────────────────────────────

  describe('Buttons', () => {
    it('Button renders', () => {
      renderDoc(
        makeDoc('Button', { appearance: 'primary' }, [
          makeDoc('String', { text: 'Click me' }),
        ]),
      );
      expect(
        screen.getByRole('button', { name: 'Click me' }),
      ).toBeInTheDocument();
    });

    it('ButtonGroup renders children', () => {
      renderDoc(
        makeDoc('ButtonGroup', {}, [
          makeDoc('Button', {}, [makeDoc('String', { text: 'A' })]),
          makeDoc('Button', {}, [makeDoc('String', { text: 'B' })]),
        ]),
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('LinkButton renders', () => {
      renderDoc(
        makeDoc('LinkButton', { href: 'https://example.com' }, [
          makeDoc('String', { text: 'Visit' }),
        ]),
      );
      expect(screen.getByRole('link', { name: 'Visit' })).toHaveAttribute(
        'href',
        'https://example.com',
      );
    });

    it('LoadingButton renders', () => {
      renderDoc(
        makeDoc('LoadingButton', { isLoading: true }, [
          makeDoc('String', { text: 'Loading...' }),
        ]),
      );
      // LoadingButton renders a button even when loading
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('Pressable renders children', () => {
      renderDoc(
        makeDoc('Pressable', {}, [
          makeDoc('String', { text: 'press me' }),
        ]),
      );
      expect(screen.getByText('press me')).toBeInTheDocument();
    });
  });

  // ── Form Components ──────────────────────────────────────────────────

  describe('Form Components', () => {
    it('TextField renders', () => {
      renderDoc(makeDoc('TextField', { name: 'email', placeholder: 'Email' }));
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    it('Textfield (alias) renders', () => {
      renderDoc(
        makeDoc('Textfield', { name: 'name', placeholder: 'Your name' }),
      );
      expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    });

    it('TextArea renders', () => {
      renderDoc(makeDoc('TextArea', { name: 'bio', placeholder: 'Bio' }));
      expect(screen.getByPlaceholderText('Bio')).toBeInTheDocument();
    });

    it('Select renders', () => {
      renderDoc(
        makeDoc('Select', {
          name: 'color',
          options: [
            { label: 'Red', value: 'red' },
            { label: 'Blue', value: 'blue' },
          ],
          placeholder: 'Choose color',
        }),
      );
      expect(screen.getByText('Choose color')).toBeInTheDocument();
    });

    it('Checkbox renders', () => {
      renderDoc(makeDoc('Checkbox', { name: 'agree', label: 'I agree' }));
      expect(screen.getByLabelText('I agree')).toBeInTheDocument();
    });

    it('CheckboxGroup renders', () => {
      renderDoc(
        makeDoc('CheckboxGroup', {
          name: 'colors',
          options: [
            { label: 'Red', value: 'red' },
            { label: 'Blue', value: 'blue' },
          ],
        }),
      );
      expect(screen.getByLabelText('Red')).toBeInTheDocument();
      expect(screen.getByLabelText('Blue')).toBeInTheDocument();
    });

    it('RadioGroup renders', () => {
      renderDoc(
        makeDoc('RadioGroup', {
          options: [
            { label: 'Yes', value: 'yes', name: 'confirm' },
            { label: 'No', value: 'no', name: 'confirm' },
          ],
        }),
      );
      expect(screen.getByLabelText('Yes')).toBeInTheDocument();
      expect(screen.getByLabelText('No')).toBeInTheDocument();
    });

    it('Radio renders empty (handled by RadioGroup)', () => {
      const { container } = renderDoc(makeDoc('Radio', {}));
      // Radio alone renders an empty fragment
      expect(container).toBeInTheDocument();
    });

    it('Toggle renders', () => {
      renderDoc(makeDoc('Toggle', { id: 'my-toggle' }));
      // Atlaskit Toggle renders as a checkbox input
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('Range renders', () => {
      renderDoc(
        makeDoc('Range', { name: 'volume', min: 0, max: 100, value: 50 }),
      );
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('DatePicker renders', () => {
      const { container } = renderDoc(
        makeDoc('DatePicker', { name: 'date' }),
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('TimePicker renders', () => {
      const { container } = renderDoc(
        makeDoc('TimePicker', { name: 'time' }),
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('Calendar renders', () => {
      const { container } = renderDoc(makeDoc('Calendar', {}));
      // Calendar renders a month grid
      expect(container.firstChild).toBeTruthy();
    });

    it('Label renders with String child', () => {
      renderDoc(
        makeDoc('Label', { htmlFor: 'name' }, [
          makeDoc('String', { text: 'Full Name' }),
        ]),
      );
      expect(screen.getByText('Full Name')).toBeInTheDocument();
    });

    it('ErrorMessage renders', () => {
      renderDoc(
        makeDoc('ErrorMessage', {}, [
          makeDoc('String', { text: 'Something went wrong' }),
        ]),
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('HelperMessage renders', () => {
      renderDoc(
        makeDoc('HelperMessage', {}, [
          makeDoc('String', { text: 'Hint text' }),
        ]),
      );
      expect(screen.getByText('Hint text')).toBeInTheDocument();
    });

    it('ValidMessage renders', () => {
      renderDoc(
        makeDoc('ValidMessage', {}, [
          makeDoc('String', { text: 'Looks good!' }),
        ]),
      );
      expect(screen.getByText('Looks good!')).toBeInTheDocument();
    });

    it('RequiredAsterisk renders', () => {
      const { container } = renderDoc(makeDoc('RequiredAsterisk', {}));
      expect(container.textContent).toContain('*');
    });

    it('Form renders children', () => {
      renderDoc(
        makeDoc('Form', {}, [
          makeDoc('String', { text: 'Form content' }),
        ]),
      );
      expect(screen.getByText('Form content')).toBeInTheDocument();
    });

    it('FormHeader renders', () => {
      renderDoc(
        makeDoc('Form', {}, [
          makeDoc('FormHeader', { title: 'Settings' }, [
            makeDoc('String', { text: 'Configure your app' }),
          ]),
        ]),
      );
      expect(screen.getByText('Configure your app')).toBeInTheDocument();
    });

    it('FormFooter renders', () => {
      renderDoc(
        makeDoc('Form', {}, [
          makeDoc('FormFooter', {}, [
            makeDoc('Button', {}, [makeDoc('String', { text: 'Submit' })]),
          ]),
        ]),
      );
      expect(
        screen.getByRole('button', { name: 'Submit' }),
      ).toBeInTheDocument();
    });
  });

  // ── FormSection integration ──────────────────────────────────────────

  describe('FormSection integration', () => {
    function renderFormSection(children: ForgeDoc[]) {
      return renderDoc(
        makeDoc('Form', {}, [makeDoc('FormSection', {}, children)]),
      );
    }

    it('Label + TextField + HelperMessage produces Field with label', () => {
      renderFormSection([
        makeDoc('Label', {}, [makeDoc('String', { text: 'Name' })]),
        makeDoc('TextField', { name: 'name', placeholder: 'Enter name' }),
        makeDoc('HelperMessage', {}, [
          makeDoc('String', { text: 'Your full name' }),
        ]),
      ]);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
    });

    it('Label + RequiredAsterisk + TextField produces required Field', () => {
      renderFormSection([
        makeDoc('Label', {}, [makeDoc('String', { text: 'Email' })]),
        makeDoc('RequiredAsterisk', {}),
        makeDoc('TextField', { name: 'email', placeholder: 'Email' }),
      ]);
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    it('Label + CheckboxGroup produces Fieldset', () => {
      renderFormSection([
        makeDoc('Label', {}, [makeDoc('String', { text: 'Products' })]),
        makeDoc('CheckboxGroup', {
          name: 'products',
          options: [
            { label: 'Jira', value: 'jira' },
            { label: 'Confluence', value: 'confluence' },
          ],
        }),
      ]);
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByLabelText('Jira')).toBeInTheDocument();
      expect(screen.getByLabelText('Confluence')).toBeInTheDocument();
    });

    it('Label + Range produces Field with Range', () => {
      renderFormSection([
        makeDoc('Label', {}, [makeDoc('String', { text: 'Brightness' })]),
        makeDoc('Range', { name: 'brightness', value: 50, min: 0, max: 100 }),
      ]);
      expect(screen.getByText('Brightness')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('Ungrouped child passes through', () => {
      renderFormSection([
        makeDoc('Text', { content: 'Just some text' }),
      ]);
      expect(screen.getByText('Just some text')).toBeInTheDocument();
    });
  });

  // ── Tables ───────────────────────────────────────────────────────────

  describe('Tables', () => {
    it('Table with Head, Row, Cell renders HTML table', () => {
      const { container } = renderDoc(
        makeDoc('Table', {}, [
          makeDoc('Head', {}, [
            makeDoc('Cell', {}, [makeDoc('String', { text: 'Name' })]),
            makeDoc('Cell', {}, [makeDoc('String', { text: 'Age' })]),
          ]),
          makeDoc('Row', {}, [
            makeDoc('Cell', {}, [makeDoc('String', { text: 'Alice' })]),
            makeDoc('Cell', {}, [makeDoc('String', { text: '30' })]),
          ]),
        ]),
      );
      expect(container.querySelector('table')).toBeInTheDocument();
      expect(container.querySelector('thead')).toBeInTheDocument();
      expect(container.querySelector('tr')).toBeInTheDocument();
      expect(container.querySelector('td')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('DynamicTable renders from ContentWrapper tree', async () => {
      renderDoc(
        makeDoc('DynamicTable', {}, [
          makeDoc('ContentWrapper', { name: 'head' }, [
            makeDoc('Cell', { cellKey: 'name' }, [
              makeDoc('String', { text: 'Name' }),
            ]),
            makeDoc('Cell', { cellKey: 'age' }, [
              makeDoc('String', { text: 'Age' }),
            ]),
          ]),
          makeDoc('ContentWrapper', { name: 'rows' }, [
            makeDoc('Row', { rowKey: '1' }, [
              makeDoc('Cell', { cellKey: 'name' }, [
                makeDoc('String', { text: 'Alice' }),
              ]),
              makeDoc('Cell', { cellKey: 'age' }, [
                makeDoc('String', { text: '30' }),
              ]),
            ]),
          ]),
        ]),
      );
      // DynamicTable may render async
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      expect(screen.getByText('30')).toBeInTheDocument();
    });
  });

  // ── Tabs ─────────────────────────────────────────────────────────────

  describe('Tabs', () => {
    it('Tabs with TabList and TabPanel renders', () => {
      renderDoc(
        makeDoc('Tabs', { id: 'test-tabs' }, [
          makeDoc('TabList', {}, [
            makeDoc('Tab', {}, [makeDoc('String', { text: 'Tab 1' })]),
            makeDoc('Tab', {}, [makeDoc('String', { text: 'Tab 2' })]),
          ]),
          makeDoc('TabPanel', {}, [
            makeDoc('String', { text: 'Panel 1 content' }),
          ]),
          makeDoc('TabPanel', {}, [
            makeDoc('String', { text: 'Panel 2 content' }),
          ]),
        ]),
      );
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      // First panel should be visible
      expect(screen.getByText('Panel 1 content')).toBeInTheDocument();
    });
  });

  // ── Modal ────────────────────────────────────────────────────────────

  describe('Modal', () => {
    it('Modal with header, body, footer renders', () => {
      renderDoc(
        makeDoc('Modal', {}, [
          makeDoc('ModalHeader', {}, [
            makeDoc('ModalTitle', {}, [
              makeDoc('String', { text: 'Dialog Title' }),
            ]),
          ]),
          makeDoc('ModalBody', {}, [
            makeDoc('String', { text: 'Dialog body text' }),
          ]),
          makeDoc('ModalFooter', {}, [
            makeDoc('Button', {}, [makeDoc('String', { text: 'Close' })]),
          ]),
        ]),
      );
      // Modal renders in portal — screen queries search whole document
      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Dialog body text')).toBeInTheDocument();
    });

    it('ModalTransition renders children', () => {
      renderDoc(
        makeDoc('ModalTransition', {}, [
          makeDoc('String', { text: 'transition content' }),
        ]),
      );
      expect(screen.getByText('transition content')).toBeInTheDocument();
    });
  });

  // ── Status & Display ─────────────────────────────────────────────────

  describe('Status & Display', () => {
    it('Badge renders', () => {
      renderDoc(makeDoc('Badge', { text: 42 }));
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('Lozenge renders', () => {
      renderDoc(
        makeDoc('Lozenge', { appearance: 'success' }, [
          makeDoc('String', { text: 'Done' }),
        ]),
      );
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('Spinner renders', () => {
      const { container } = renderDoc(makeDoc('Spinner', { size: 'medium' }));
      // Atlaskit Spinner renders an SVG
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('ProgressBar renders', () => {
      const { container } = renderDoc(
        makeDoc('ProgressBar', { value: 0.6 }),
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('ProgressTracker renders', () => {
      renderDoc(
        makeDoc('ProgressTracker', {
          items: [
            {
              id: '1',
              label: 'Step 1',
              percentageComplete: 100,
              status: 'visited',
              href: '#',
            },
            {
              id: '2',
              label: 'Step 2',
              percentageComplete: 0,
              status: 'current',
              href: '#',
            },
          ],
        }),
      );
      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });

    it('SectionMessage with SectionMessageAction renders', () => {
      renderDoc(
        makeDoc(
          'SectionMessage',
          { appearance: 'information', title: 'Note' },
          [
            makeDoc('String', { text: 'Important info' }),
            makeDoc('SectionMessageAction', { href: '#' }, [
              makeDoc('String', { text: 'Learn more' }),
            ]),
          ],
        ),
      );
      expect(screen.getByText('Important info')).toBeInTheDocument();
    });

    it('EmptyState renders', () => {
      renderDoc(
        makeDoc('EmptyState', {
          header: 'No results',
          description: 'Try a different query',
        }),
      );
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('Flag renders', () => {
      renderDoc(
        makeDoc('Flag', {
          title: 'Success',
          description: 'Action completed',
          id: 'flag-1',
        }),
      );
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('Icon renders fallback for unknown glyph', () => {
      const { container } = renderDoc(
        makeDoc('Icon', { glyph: 'nonexistent', label: 'Test icon' }),
      );
      expect(container.textContent).toContain('❓');
    });
  });

  // ── Content ──────────────────────────────────────────────────────────

  describe('Content', () => {
    it('Code renders', () => {
      renderDoc(
        makeDoc('Code', {}, [makeDoc('String', { text: 'const x = 1' })]),
      );
      expect(screen.getByText('const x = 1')).toBeInTheDocument();
    });

    it('CodeBlock renders', () => {
      renderDoc(
        makeDoc('CodeBlock', { text: 'console.log("hi")', language: 'js' }),
      );
      expect(screen.getByText('console.log("hi")')).toBeInTheDocument();
    });

    it('Tooltip renders trigger child', () => {
      renderDoc(
        makeDoc('Tooltip', { content: 'Tooltip text' }, [
          makeDoc('Button', {}, [makeDoc('String', { text: 'Hover me' })]),
        ]),
      );
      expect(
        screen.getByRole('button', { name: 'Hover me' }),
      ).toBeInTheDocument();
    });

    it('Tag renders', () => {
      renderDoc(makeDoc('Tag', { text: 'Important' }));
      expect(screen.getByText('Important')).toBeInTheDocument();
    });

    it('TagGroup renders children', () => {
      renderDoc(
        makeDoc('TagGroup', {}, [
          makeDoc('Tag', { text: 'A' }),
          makeDoc('Tag', { text: 'B' }),
        ]),
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('Link renders', () => {
      renderDoc(
        makeDoc('Link', { href: 'https://example.com' }, [
          makeDoc('String', { text: 'Click here' }),
        ]),
      );
      const link = screen.getByText('Click here');
      expect(link.closest('a')).toHaveAttribute(
        'href',
        'https://example.com',
      );
    });

    it('Image renders', () => {
      renderDoc(
        makeDoc('Image', { src: 'https://example.com/img.png', alt: 'photo' }),
      );
      expect(screen.getByAltText('photo')).toBeInTheDocument();
    });

    it('Frame renders iframe', () => {
      const { container } = renderDoc(
        makeDoc('Frame', {
          url: 'https://example.com',
          title: 'Embed',
        }),
      );
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'https://example.com');
    });

    it('List with ListItems renders', () => {
      const { container } = renderDoc(
        makeDoc('List', { type: 'ordered' }, [
          makeDoc('ListItem', {}, [makeDoc('String', { text: 'First' })]),
          makeDoc('ListItem', {}, [makeDoc('String', { text: 'Second' })]),
        ]),
      );
      expect(container.querySelector('ol')).toBeInTheDocument();
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });

    it('InlineDialog renders', () => {
      renderDoc(
        makeDoc('InlineDialog', { content: 'Dialog content', isOpen: true }, [
          makeDoc('Button', {}, [makeDoc('String', { text: 'Trigger' })]),
        ]),
      );
      expect(
        screen.getByRole('button', { name: 'Trigger' }),
      ).toBeInTheDocument();
    });

    it('Popup renders trigger button', () => {
      renderDoc(
        makeDoc('Popup', { triggerText: 'Open menu' }, [
          makeDoc('String', { text: 'Menu content' }),
        ]),
      );
      expect(
        screen.getByRole('button', { name: 'Open menu' }),
      ).toBeInTheDocument();
    });
  });

  // ── InlineEdit ───────────────────────────────────────────────────────

  describe('InlineEdit', () => {
    it('renders readView by default', () => {
      renderDoc(
        makeDoc(
          'InlineEdit',
          { label: 'Name', defaultValue: 'Alice' },
          [
            makeDoc('ContentWrapper', { name: 'editView' }, [
              makeDoc('TextField', { name: 'name' }),
            ]),
            makeDoc('ContentWrapper', { name: 'readView' }, [
              makeDoc('String', { text: 'Alice' }),
            ]),
          ],
        ),
      );
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  // ── User ─────────────────────────────────────────────────────────────

  describe('User', () => {
    it('User renders name', () => {
      renderDoc(makeDoc('User', { name: 'John Doe' }));
      // AvatarItem renders the name in multiple elements (visible + hidden)
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });

    it('UserGroup renders avatar group', () => {
      const { container } = renderDoc(
        makeDoc('UserGroup', {}, [
          makeDoc('User', { name: 'Alice' }),
          makeDoc('User', { name: 'Bob' }),
        ]),
      );
      // AvatarGroup renders the group container
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ── Tiles ────────────────────────────────────────────────────────────

  describe('Tiles', () => {
    it('Tile renders', () => {
      renderDoc(
        makeDoc('Tile', { label: 'My Tile' }, [
          makeDoc('String', { text: 'Tile content' }),
        ]),
      );
      // Tile renders label as an aria attribute; verify children render
      expect(screen.getByText('Tile content')).toBeInTheDocument();
    });

    it('AtlassianTile renders glyph icon', () => {
      const { container } = renderDoc(
        makeDoc('AtlassianTile', {
          glyph: 'bug',
          label: 'Bug',
          size: 'medium',
        }),
      );
      // Renders a div with the first letter
      expect(container.textContent).toContain('B');
    });

    it('AtlassianIcon renders', () => {
      const { container } = renderDoc(
        makeDoc('AtlassianIcon', { glyph: 'task', label: 'Task' }),
      );
      expect(container.textContent).toContain('●');
    });
  });

  // ── File ─────────────────────────────────────────────────────────────

  describe('File', () => {
    it('FileCard renders', () => {
      renderDoc(
        makeDoc('FileCard', { fileName: 'report.pdf', fileSize: 1024 }),
      );
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
      expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
    });

    it('FilePicker renders', () => {
      renderDoc(
        makeDoc('FilePicker', { label: 'Upload files', description: 'Max 10MB' }),
      );
      expect(screen.getByText('Upload files')).toBeInTheDocument();
      expect(screen.getByText('Max 10MB')).toBeInTheDocument();
    });
  });

  // ── Charts ───────────────────────────────────────────────────────────

  describe('Charts', () => {
    const chartData = [
      ['A', 10],
      ['B', 20],
    ];

    const chartWrapper = (doc: ForgeDoc) => {
      // Charts need a container with dimensions for recharts
      const { container } = render(
        <AppProvider>
          <div style={{ width: 400, height: 300 }}>
            <ForgeDocRenderer
              doc={{
                type: 'Root',
                props: {},
                children: [doc],
                key: 'root',
              }}
            />
          </div>
        </AppProvider>,
      );
      return { container };
    };

    it('BarChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('BarChart', { data: chartData, title: 'Bar Chart' }),
      );
      expect(screen.getByText('Bar Chart')).toBeInTheDocument();
    });

    it('StackBarChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('StackBarChart', { data: chartData, title: 'Stack Bar' }),
      );
      expect(screen.getByText('Stack Bar')).toBeInTheDocument();
    });

    it('HorizontalBarChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('HorizontalBarChart', {
          data: chartData,
          title: 'H-Bar',
        }),
      );
      expect(screen.getByText('H-Bar')).toBeInTheDocument();
    });

    it('HorizontalStackBarChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('HorizontalStackBarChart', {
          data: chartData,
          title: 'H-Stack',
        }),
      );
      expect(screen.getByText('H-Stack')).toBeInTheDocument();
    });

    it('LineChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('LineChart', { data: chartData, title: 'Line Chart' }),
      );
      expect(screen.getByText('Line Chart')).toBeInTheDocument();
    });

    it('PieChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('PieChart', { data: chartData, title: 'Pie Chart' }),
      );
      expect(screen.getByText('Pie Chart')).toBeInTheDocument();
    });

    it('DonutChart renders', () => {
      const { container } = chartWrapper(
        makeDoc('DonutChart', { data: chartData, title: 'Donut Chart' }),
      );
      expect(screen.getByText('Donut Chart')).toBeInTheDocument();
    });
  });

  // ── Editors ──────────────────────────────────────────────────────────

  describe('Editors', () => {
    it.todo(
      'ChromelessEditor — requires @atlaskit/editor-core browser APIs, covered by Playwright',
    );
    it.todo(
      'CommentEditor — requires @atlaskit/editor-core browser APIs, covered by Playwright',
    );
  });

  // ── Layout ───────────────────────────────────────────────────────────

  describe('Layout', () => {
    it('Global renders sidebar + main', () => {
      const { container } = renderDoc(makeDoc('Global', {}));
      expect(container.querySelector('nav')).toBeInTheDocument();
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('Comment renders author and time', () => {
      renderDoc(
        makeDoc('Comment', { author: 'Alice', time: '2024-01-15' }),
      );
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    it('AdfRenderer renders simple ADF document', () => {
      renderDoc(
        makeDoc('AdfRenderer', {
          document: {
            version: 1,
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hello ADF' }],
              },
            ],
          },
        }),
      );
      expect(screen.getByText('Hello ADF')).toBeInTheDocument();
    });
  });

  // ── Fallback ─────────────────────────────────────────────────────────

  describe('Fallback', () => {
    it('Unknown type renders FallbackComponent', () => {
      renderDoc(makeDoc('UnknownComponentType', {}));
      expect(screen.getByText(/UnknownComponentType/)).toBeInTheDocument();
    });
  });
});
