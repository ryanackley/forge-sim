import { describe, it, expect } from 'vitest';
import {
  groupFormSectionChildren,
  extractLabelText,
  type FieldGroup,
  type CheckboxGroupItem,
  type RangeFieldItem,
} from '../form-field-grouping';
import type { ForgeDoc } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────

let keyCounter = 0;

function makeDoc(
  type: string,
  props: Record<string, any> = {},
  children: ForgeDoc[] = [],
): ForgeDoc {
  return { type, props, children, key: `${type}-${++keyCounter}` };
}

function makeLabel(text: string, htmlFor?: string): ForgeDoc {
  return makeDoc('Label', htmlFor ? { htmlFor } : {}, [
    makeDoc('String', { text }),
  ]);
}

function makeField(type: string, name: string): ForgeDoc {
  return makeDoc(type, { name });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('extractLabelText', () => {
  it('extracts text from a String child', () => {
    const label = makeLabel('Email Address');
    expect(extractLabelText(label)).toBe('Email Address');
  });

  it('returns empty string when no String child exists', () => {
    const label = makeDoc('Label', {}, [makeDoc('Box')]);
    expect(extractLabelText(label)).toBe('');
  });
});

describe('groupFormSectionChildren', () => {
  it('groups Label + TextField into a Field group', () => {
    const children = [
      makeLabel('Name', 'name'),
      makeField('TextField', 'name'),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('field');

    const g = groups[0] as FieldGroup;
    expect(g.labelText).toBe('Name');
    expect(g.name).toBe('name');
    expect(g.isRequired).toBe(false);
    expect(g.messages).toHaveLength(0);
    expect(g.fieldDoc.type).toBe('TextField');
  });

  it('groups Label + TextField + HelperMessage', () => {
    const children = [
      makeLabel('Email', 'email'),
      makeField('TextField', 'email'),
      makeDoc('HelperMessage', {}, [makeDoc('String', { text: 'Enter your email' })]),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const g = groups[0] as FieldGroup;
    expect(g.labelText).toBe('Email');
    expect(g.messages).toHaveLength(1);
    expect(g.messages[0].type).toBe('HelperMessage');
  });

  it('collects multiple trailing messages', () => {
    const children = [
      makeLabel('Password', 'password'),
      makeField('TextField', 'password'),
      makeDoc('HelperMessage', {}, [makeDoc('String', { text: 'Min 8 chars' })]),
      makeDoc('ErrorMessage', {}, [makeDoc('String', { text: 'Too short' })]),
      makeDoc('ValidMessage', {}, [makeDoc('String', { text: 'Looks good' })]),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const g = groups[0] as FieldGroup;
    expect(g.messages).toHaveLength(3);
    expect(g.messages.map((m) => m.type)).toEqual([
      'HelperMessage',
      'ErrorMessage',
      'ValidMessage',
    ]);
  });

  it('Label + RequiredAsterisk + TextField creates isRequired Field', () => {
    const children = [
      makeLabel('Username', 'username'),
      makeDoc('RequiredAsterisk'),
      makeField('TextField', 'username'),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const g = groups[0] as FieldGroup;
    expect(g.isRequired).toBe(true);
    expect(g.name).toBe('username');
    expect(g.labelText).toBe('Username');
  });

  it('passes through non-field children unchanged', () => {
    const children = [
      makeDoc('Button', { appearance: 'primary' }),
      makeDoc('Heading', { size: 'medium' }),
      makeDoc('Text', { content: 'hello' }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.kind === 'passthrough')).toBe(true);
  });

  it('passes through a Label not followed by a field component', () => {
    const children = [
      makeLabel('Standalone Label'),
      makeDoc('Button', { appearance: 'primary' }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(2);
    expect(groups[0].kind).toBe('passthrough');
    expect(groups[1].kind).toBe('passthrough');
  });

  it('handles multiple field groups in one FormSection', () => {
    const children = [
      makeLabel('First Name', 'first-name'),
      makeField('TextField', 'first-name'),
      makeLabel('Last Name', 'last-name'),
      makeDoc('RequiredAsterisk'),
      makeField('TextField', 'last-name'),
      makeDoc('HelperMessage', {}, [makeDoc('String', { text: 'Required' })]),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(2);

    const g0 = groups[0] as FieldGroup;
    expect(g0.kind).toBe('field');
    expect(g0.name).toBe('first-name');
    expect(g0.isRequired).toBe(false);
    expect(g0.messages).toHaveLength(0);

    const g1 = groups[1] as FieldGroup;
    expect(g1.kind).toBe('field');
    expect(g1.name).toBe('last-name');
    expect(g1.isRequired).toBe(true);
    expect(g1.messages).toHaveLength(1);
  });

  it('mixes field groups and passthrough children', () => {
    const children = [
      makeDoc('Heading', { size: 'large' }),
      makeLabel('Description', 'desc'),
      makeField('TextArea', 'desc'),
      makeDoc('Button', { appearance: 'primary' }),
      makeLabel('Priority', 'priority'),
      makeField('Select', 'priority'),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(4);
    expect(groups[0].kind).toBe('passthrough'); // Heading
    expect(groups[1].kind).toBe('field');       // TextArea group
    expect(groups[2].kind).toBe('passthrough'); // Button
    expect(groups[3].kind).toBe('field');       // Select group

    expect((groups[1] as FieldGroup).fieldDoc.type).toBe('TextArea');
    expect((groups[3] as FieldGroup).fieldDoc.type).toBe('Select');
  });

  it('recognizes all field component types', () => {
    const fieldTypes = [
      'TextField', 'Textfield', 'TextArea', 'Select', 'DatePicker',
      'TimePicker', 'Checkbox', 'RadioGroup', 'Toggle',
    ];

    for (const type of fieldTypes) {
      const children = [
        makeLabel(`${type} Label`, type.toLowerCase()),
        makeField(type, type.toLowerCase()),
      ];
      const groups = groupFormSectionChildren(children);
      expect(groups).toHaveLength(1);
      expect(groups[0].kind).toBe('field');
      expect((groups[0] as FieldGroup).fieldDoc.type).toBe(type);
    }
  });

  it('derives name from field props when Label has no htmlFor', () => {
    const children = [
      makeLabel('No htmlFor'),
      makeField('TextField', 'from-field-props'),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const g = groups[0] as FieldGroup;
    expect(g.name).toBe('from-field-props');
  });

  it('handles empty children list', () => {
    const groups = groupFormSectionChildren([]);
    expect(groups).toHaveLength(0);
  });

  // ── CheckboxGroup tests ──────────────────────────────────────────────

  it('groups Label + CheckboxGroup into a checkbox-group item', () => {
    const options = [
      { value: 'jira', label: 'Jira' },
      { value: 'confluence', label: 'Confluence' },
    ];
    const children = [
      makeLabel('Products'),
      makeDoc('CheckboxGroup', { name: 'products', options }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('checkbox-group');

    const cg = groups[0] as CheckboxGroupItem;
    expect(cg.labelText).toBe('Products');
    expect(cg.name).toBe('products');
    expect(cg.isRequired).toBe(false);
    expect(cg.options).toEqual(options);
    expect(cg.checkboxGroupDoc.type).toBe('CheckboxGroup');
    expect(cg.messages).toHaveLength(0);
  });

  it('Label + RequiredAsterisk + CheckboxGroup sets isRequired', () => {
    const options = [{ value: 'a', label: 'A' }];
    const children = [
      makeLabel('Required Choices'),
      makeDoc('RequiredAsterisk'),
      makeDoc('CheckboxGroup', { name: 'choices', options }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const cg = groups[0] as CheckboxGroupItem;
    expect(cg.kind).toBe('checkbox-group');
    expect(cg.isRequired).toBe(true);
    expect(cg.name).toBe('choices');
  });

  it('Label + CheckboxGroup + ErrorMessage collects messages', () => {
    const options = [{ value: 'x', label: 'X' }];
    const children = [
      makeLabel('Pick'),
      makeDoc('CheckboxGroup', { name: 'pick', options }),
      makeDoc('ErrorMessage', {}, [makeDoc('String', { text: 'Required' })]),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const cg = groups[0] as CheckboxGroupItem;
    expect(cg.messages).toHaveLength(1);
    expect(cg.messages[0].type).toBe('ErrorMessage');
  });

  it('CheckboxGroup NOT preceded by Label passes through', () => {
    const options = [{ value: 'solo', label: 'Solo' }];
    const children = [
      makeDoc('CheckboxGroup', { name: 'solo', options }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('passthrough');
  });

  it('mixes regular Field groups and CheckboxGroup groups', () => {
    const options = [
      { value: 'opt1', label: 'Option 1' },
      { value: 'opt2', label: 'Option 2' },
    ];
    const children = [
      makeLabel('Name', 'name'),
      makeField('TextField', 'name'),
      makeLabel('Preferences'),
      makeDoc('RequiredAsterisk'),
      makeDoc('CheckboxGroup', { name: 'prefs', options }),
      makeDoc('HelperMessage', {}, [makeDoc('String', { text: 'Select all that apply' })]),
      makeLabel('Priority', 'priority'),
      makeField('Select', 'priority'),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(3);

    expect(groups[0].kind).toBe('field');
    expect((groups[0] as FieldGroup).name).toBe('name');

    expect(groups[1].kind).toBe('checkbox-group');
    const cg = groups[1] as CheckboxGroupItem;
    expect(cg.name).toBe('prefs');
    expect(cg.isRequired).toBe(true);
    expect(cg.options).toEqual(options);
    expect(cg.messages).toHaveLength(1);

    expect(groups[2].kind).toBe('field');
    expect((groups[2] as FieldGroup).name).toBe('priority');
  });

  // ── RangeField tests ──────────────────────────────────────────────────

  it('groups Label + Range into a range-field item', () => {
    const children = [
      makeLabel('Brightness'),
      makeDoc('Range', { name: 'brightness', value: 50, min: 0, max: 100, step: 1 }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('range-field');

    const rf = groups[0] as RangeFieldItem;
    expect(rf.labelText).toBe('Brightness');
    expect(rf.name).toBe('brightness');
    expect(rf.rangeDoc.type).toBe('Range');
    expect(rf.rangeDoc.props?.min).toBe(0);
    expect(rf.rangeDoc.props?.max).toBe(100);
    expect(rf.messages).toHaveLength(0);
  });

  it('Label + Range + HelperMessage collects messages', () => {
    const children = [
      makeLabel('Volume'),
      makeDoc('Range', { name: 'volume', value: 75 }),
      makeDoc('HelperMessage', {}, [makeDoc('String', { text: 'Move the slider' })]),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    const rf = groups[0] as RangeFieldItem;
    expect(rf.kind).toBe('range-field');
    expect(rf.messages).toHaveLength(1);
    expect(rf.messages[0].type).toBe('HelperMessage');
  });

  it('Range NOT preceded by Label passes through', () => {
    const children = [
      makeDoc('Range', { name: 'standalone', value: 50 }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('passthrough');
  });

  it('mixes regular Field groups, RangeField, and CheckboxGroup', () => {
    const options = [{ value: 'a', label: 'A' }];
    const children = [
      makeLabel('Name', 'name'),
      makeField('TextField', 'name'),
      makeLabel('Brightness'),
      makeDoc('Range', { name: 'brightness', value: 50 }),
      makeDoc('HelperMessage', {}, [makeDoc('String', { text: 'Adjust' })]),
      makeLabel('Options'),
      makeDoc('CheckboxGroup', { name: 'opts', options }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(3);
    expect(groups[0].kind).toBe('field');
    expect((groups[0] as FieldGroup).name).toBe('name');

    expect(groups[1].kind).toBe('range-field');
    const rf = groups[1] as RangeFieldItem;
    expect(rf.name).toBe('brightness');
    expect(rf.messages).toHaveLength(1);

    expect(groups[2].kind).toBe('checkbox-group');
    expect((groups[2] as CheckboxGroupItem).name).toBe('opts');
  });

  it('Label + RequiredAsterisk + Range still produces range-field (asterisk consumed)', () => {
    const children = [
      makeLabel('Contrast'),
      makeDoc('RequiredAsterisk'),
      makeDoc('Range', { name: 'contrast', value: 60 }),
    ];
    const groups = groupFormSectionChildren(children);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('range-field');

    const rf = groups[0] as RangeFieldItem;
    expect(rf.labelText).toBe('Contrast');
    expect(rf.name).toBe('contrast');
    // RangeField doesn't support isRequired — no such property on the item
    expect(rf.rangeDoc.type).toBe('Range');
  });
});
