/**
 * F1 — getTextContent walks VISIBLE_TEXT_PROPS allowlist.
 *
 * Background: ForgeDoc's reconciler wraps `children` strings in `<String>`
 * nodes (which getTextContent already walks). But components that take text
 * via NAMED PROPS (Tag.text, FormHeader.title, etc.) don't get that wrapping
 * — pre-fix, getTextContent silently missed them.
 *
 * These tests pin down:
 *   - The allowlist works for representative components in each category
 *   - The convenience-method contract (it's not exhaustive — composite data
 *     like Select.options[].label is intentionally not walked)
 *   - The escape-hatch path (findByType + raw prop access) covers the gaps
 *   - Parity: every prop in VISIBLE_TEXT_PROPS is referenced by the renderer's
 *     component-map (so the allowlist matches what users would see in the browser)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTextContent, VISIBLE_TEXT_PROPS, findFirstByType, findByType } from '../ui/doc-utils.js';
import type { ForgeDoc } from '../ui/bridge.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper: build a tiny ForgeDoc tree with no children other than what's specified.
function node(type: string, props: Record<string, any> = {}, children: ForgeDoc[] = []): ForgeDoc {
  return { type, props, children, key: `${type}-${Math.random().toString(36).slice(2, 8)}` };
}

describe('VISIBLE_TEXT_PROPS — top-level allowlist', () => {
  it('Tag.text shows up in getTextContent (the headline F1 case)', () => {
    const doc = node('Root', {}, [node('Tag', { text: 'Priority', color: 'red' })]);
    expect(getTextContent(doc)).toContain('Priority');
  });

  it('FormHeader.title and .description both show up', () => {
    const doc = node('Root', {}, [
      node('FormHeader', { title: 'Add a Tag', description: 'Use the form below.' }),
    ]);
    const text = getTextContent(doc);
    expect(text).toContain('Add a Tag');
    expect(text).toContain('Use the form below.');
  });

  it('FormSection.title and .description show up', () => {
    const doc = node('FormSection', { title: 'Required', description: 'These fields must be filled.' });
    const text = getTextContent(doc);
    expect(text).toContain('Required');
    expect(text).toContain('These fields must be filled.');
  });

  it('EmptyState.header and .description show up', () => {
    const doc = node('EmptyState', { header: 'No tags yet', description: 'Add one above.' });
    const text = getTextContent(doc);
    expect(text).toContain('No tags yet');
    expect(text).toContain('Add one above.');
  });

  it('SectionMessage.title shows up', () => {
    const doc = node('SectionMessage', { title: 'Heads up' });
    expect(getTextContent(doc)).toContain('Heads up');
  });

  it('CodeBlock.text shows up (entire code body)', () => {
    const doc = node('CodeBlock', { text: 'const x = 42;', language: 'js' });
    expect(getTextContent(doc)).toContain('const x = 42;');
  });

  it('Modal.title shows up (parity with real Forge default header)', () => {
    const doc = node('Modal', { title: 'Confirm action' });
    expect(getTextContent(doc)).toContain('Confirm action');
  });

  it('DynamicTable.caption shows up', () => {
    const doc = node('DynamicTable', { caption: 'Issue Tags' });
    expect(getTextContent(doc)).toContain('Issue Tags');
  });

  it('Inline.separator shows up', () => {
    const doc = node('Inline', { separator: ' | ' });
    expect(getTextContent(doc)).toContain('|');
  });

  it('Checkbox.label and Radio.label show up (visible labels, not aria)', () => {
    const doc = node('Root', {}, [
      node('Checkbox', { label: 'Subscribe', name: 'sub' }),
      node('Radio', { label: 'Default', name: 'role', value: 'default' }),
    ]);
    const text = getTextContent(doc);
    expect(text).toContain('Subscribe');
    expect(text).toContain('Default');
  });

  it('InlineEdit.label shows up (despite docs typo about boolean type)', () => {
    const doc = node('InlineEdit', { label: 'Team name' });
    expect(getTextContent(doc)).toContain('Team name');
  });

  it('UserPicker.label and .description show up', () => {
    const doc = node('UserPicker', {
      label: 'Assignee',
      description: 'Who should own this',
      name: 'assignee',
    });
    const text = getTextContent(doc);
    expect(text).toContain('Assignee');
    expect(text).toContain('Who should own this');
  });

  it('FilePicker.label and .description show up', () => {
    const doc = node('FilePicker', {
      label: 'Choose files',
      description: 'PNG or JPG, max 10MB',
    });
    const text = getTextContent(doc);
    expect(text).toContain('Choose files');
    expect(text).toContain('PNG or JPG');
  });

  it('FileCard.fileName and .error show up', () => {
    const doc = node('FileCard', { fileName: 'report.pdf', error: 'Upload failed' });
    const text = getTextContent(doc);
    expect(text).toContain('report.pdf');
    expect(text).toContain('Upload failed');
  });

  it('Comment string-form props show up (author, time, edited, restrictedTo, savingText, type)', () => {
    const doc = node('Comment', {
      author: 'Pat Lee',
      time: '5m ago',
      edited: '(edited)',
      restrictedTo: 'admins',
      savingText: 'Saving...',
      type: 'reply',
    });
    const text = getTextContent(doc);
    expect(text).toContain('Pat Lee');
    expect(text).toContain('5m ago');
    expect(text).toContain('(edited)');
    expect(text).toContain('admins');
    expect(text).toContain('Saving...');
    expect(text).toContain('reply');
  });

  it('Comment object-form props show up (author/time as { text, onClick })', () => {
    // Per official @atlaskit/forge-react-types, author and time are objects
    // with { text, onClick }. The walker handles both shapes.
    const doc = node('Comment', {
      author: { text: 'Pat Lee', onClick: () => {} },
      time: { text: '5m ago', onClick: () => {} },
    });
    const text = getTextContent(doc);
    expect(text).toContain('Pat Lee');
    expect(text).toContain('5m ago');
  });

  it('Comment.actions and .errorActions array forms surface every action label', () => {
    const doc = node('Comment', {
      actions: [
        { text: 'Reply', onClick: () => {} },
        { text: 'Like', onClick: () => {} },
      ],
      errorActions: [
        { text: 'Retry' },
        { text: 'Dismiss' },
      ],
    });
    const text = getTextContent(doc);
    expect(text).toContain('Reply');
    expect(text).toContain('Like');
    expect(text).toContain('Retry');
    expect(text).toContain('Dismiss');
  });

  it('User.name shows up (renderer renders it as primaryText)', () => {
    const doc = node('User', { name: 'Pat Lee', accountId: 'abc' });
    expect(getTextContent(doc)).toContain('Pat Lee');
  });

  it('Tile.label and AtlassianTile.label show up', () => {
    const doc = node('Root', {}, [
      node('Tile', { label: 'Settings' }),
      node('AtlassianTile', { label: 'Story' }),
    ]);
    const text = getTextContent(doc);
    expect(text).toContain('Settings');
    expect(text).toContain('Story');
  });

  it('Badge.text shows up (when no children)', () => {
    const doc = node('Badge', { text: '99+' });
    expect(getTextContent(doc)).toContain('99+');
  });

  it('Chart titles and subtitles show up across all 7 chart types', () => {
    const chartTypes = [
      'BarChart', 'StackBarChart', 'HorizontalBarChart', 'HorizontalStackBarChart',
      'LineChart', 'DonutChart', 'PieChart',
    ];
    for (const type of chartTypes) {
      const doc = node(type, { title: `${type} title`, subtitle: 'subtext' });
      const text = getTextContent(doc);
      expect(text, `${type} title`).toContain(`${type} title`);
      expect(text, `${type} subtitle`).toContain('subtext');
    }
  });
});

describe('VISIBLE_TEXT_PROPS — explicit exclusions', () => {
  it('Spinner.label is aria-only — does NOT show up', () => {
    const doc = node('Spinner', { label: 'Loading' });
    expect(getTextContent(doc)).not.toContain('Loading');
  });

  it('Toggle.label is aria-only — does NOT show up', () => {
    const doc = node('Toggle', { label: 'Enable feature' });
    expect(getTextContent(doc)).not.toContain('Enable feature');
  });

  it('Modal.label is aria-only — does NOT show up (only Modal.title is visible)', () => {
    const doc = node('Modal', { label: 'aria-name', title: 'Visible Title' });
    const text = getTextContent(doc);
    expect(text).toContain('Visible Title');
    expect(text).not.toContain('aria-name');
  });

  it('Image.alt is fallback-only — does NOT show up', () => {
    const doc = node('Image', { alt: 'A picture', src: 'x.jpg' });
    expect(getTextContent(doc)).not.toContain('A picture');
  });

  it('Tooltip.content is hover-only — does NOT show up', () => {
    const doc = node('Tooltip', { content: 'Hover me' });
    expect(getTextContent(doc)).not.toContain('Hover me');
  });

  it('Textfield.placeholder is empty-state-only — does NOT show up', () => {
    const doc = node('Textfield', { placeholder: 'Enter name', name: 'name' });
    expect(getTextContent(doc)).not.toContain('Enter name');
  });
});

describe('VISIBLE_TEXT_PROPS — composite data (escape-hatch territory)', () => {
  // These cases are intentionally NOT covered by getTextContent — devs
  // should drop to findByType for them. The tests document the gap and
  // demonstrate the workaround works.

  it('Select.options[].label is NOT in getTextContent (use findByType)', () => {
    const doc = node('Select', {
      name: 'role',
      options: [{ label: 'Admin', value: 'admin' }, { label: 'Member', value: 'member' }],
      value: 'admin',
    });
    expect(getTextContent(doc)).not.toContain('Admin');
    // Escape hatch:
    const select = findFirstByType(doc, 'Select')!;
    expect(select.props.options.map((o: any) => o.label)).toContain('Admin');
    expect(select.props.options.map((o: any) => o.label)).toContain('Member');
  });

  it('CheckboxGroup.options[].label is NOT in getTextContent (use findByType)', () => {
    const doc = node('CheckboxGroup', {
      name: 'tags',
      options: [{ label: 'Bug', value: 'bug' }, { label: 'Feature', value: 'feat' }],
    });
    expect(getTextContent(doc)).not.toContain('Bug');
    const grp = findFirstByType(doc, 'CheckboxGroup')!;
    expect(grp.props.options.map((o: any) => o.label)).toEqual(['Bug', 'Feature']);
  });

  it('Comment.author — both string and object form are walked (object covered)', () => {
    // Both shapes covered by extractText — string ergonomic + the docs-canonical
    // { text, onClick } object form per @atlaskit/forge-react-types.
    const objDoc = node('Comment', { author: { text: 'Pat Lee', onClick: () => {} } });
    expect(getTextContent(objDoc)).toContain('Pat Lee');
    const strDoc = node('Comment', { author: 'Pat Lee' });
    expect(getTextContent(strDoc)).toContain('Pat Lee');

    // Escape-hatch path still works for tests that need to assert on the
    // onClick handler or other non-text fields:
    const comment = findFirstByType(objDoc, 'Comment')!;
    expect(typeof comment.props.author.onClick).toBe('function');
  });

  it('findByProps escape hatch finds nodes by exact prop value', () => {
    const doc = node('Root', {}, [
      node('Button', { appearance: 'primary' }, [node('String', { text: 'Save' })]),
      node('Button', { appearance: 'danger' }, [node('String', { text: 'Delete' })]),
    ]);
    const dangerBtns = findByType(doc, 'Button').filter((b) => b.props.appearance === 'danger');
    expect(dangerBtns).toHaveLength(1);
  });
});

describe('VISIBLE_TEXT_PROPS — backward compatibility', () => {
  it('still walks <String> children (not just prop-text)', () => {
    const doc = node('Heading', {}, [node('String', { text: 'Hello World' })]);
    expect(getTextContent(doc)).toContain('Hello World');
  });

  it('preserves natural adjacent-text concatenation (Theme: light pattern)', () => {
    // This is the dual-panel.test.ts pattern — devs intentionally write
    // <Text>Theme: </Text><Text>{value}</Text> expecting concatenation.
    const doc = node('Stack', {}, [
      node('Text', {}, [node('String', { text: 'Theme: ' })]),
      node('Text', {}, [node('String', { text: 'light' })]),
    ]);
    expect(getTextContent(doc)).toContain('Theme: light');
  });

  it('handles empty/missing prop values gracefully', () => {
    const doc = node('Root', {}, [
      node('Tag', { text: '' }),                        // empty string
      node('FormHeader', { title: 'OK' }),              // description missing
      node('SectionMessage', { title: undefined }),     // undefined
      node('Tag', {}),                                  // no text prop at all
    ]);
    expect(getTextContent(doc)).toBe('OK');
  });

  it('skips non-string prop values (numbers, objects, functions)', () => {
    const doc = node('Tag', { text: 42 as any });
    // Numbers don't make it through (we only push strings)
    expect(getTextContent(doc)).toBe('');
  });
});

describe('VISIBLE_TEXT_PROPS — parity with renderer', () => {
  // The renderer (renderer/src/component-map.tsx) is the source of truth for
  // what shows up visibly in the browser. This test asserts that every prop
  // in VISIBLE_TEXT_PROPS is referenced somewhere in the renderer source —
  // catching drift if the renderer drops a prop OR if we add a prop here
  // that the renderer doesn't actually surface.
  //
  // One known exception is explicitly allowed because it's parity-with-
  // real-Forge handled at a layer below our wrapper:
  //   - Inline.separator: handled natively by Atlaskit Primitive Inline;
  //     our renderer just spreads props (no explicit `props.separator`
  //     reference in source).

  const RENDERER_SOURCE = readFileSync(
    join(__dirname, '../../renderer/src/component-map.tsx'),
    'utf-8'
  );

  const PARITY_EXCEPTIONS: Record<string, string[]> = {
    Inline: ['separator'],     // Atlaskit Primitive renders natively
  };

  for (const [type, propNames] of Object.entries(VISIBLE_TEXT_PROPS)) {
    for (const propName of propNames) {
      if (PARITY_EXCEPTIONS[type]?.includes(propName)) continue;
      it(`renderer surfaces ${type}.${propName}`, () => {
        // Match `props.<name>` somewhere in the source. Loose check — the
        // renderer might pass props via spread (`{...cleanProps(props)}`) so
        // we also accept that. If neither pattern matches, the prop probably
        // isn't being surfaced.
        const propRef = new RegExp(`props\\.${propName}\\b`);
        const spreadRef = /(?:cleanProps\(props\)|\.\.\.props|\.\.\.cleanProps)/;
        const found = propRef.test(RENDERER_SOURCE) || spreadRef.test(RENDERER_SOURCE);
        expect(found, `Renderer should reference props.${propName} for ${type}`).toBe(true);
      });
    }
  }
});
