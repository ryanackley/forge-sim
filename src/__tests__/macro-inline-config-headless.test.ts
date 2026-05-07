/**
 * Headless test API for macro inline config.
 *
 * Inline macro config (`config: true` + `ForgeReconciler.addConfig(<Config />)`)
 * is platform-managed in real Forge — the user does NOT call view.submit().
 * The platform harvests named form fields when the user clicks its rendered
 * Save, then exposes the values back to the macro view via `useConfig()`.
 *
 * sim.ui.renderInlineConfig() / setMacroConfig() / save() mirror that contract
 * so tests can exercise the full edit→view cycle without a browser.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';
import {
  validateInlineConfigTree,
  extractInlineConfigFields,
} from '../ui/inline-config.js';

const APP_DIR = join(import.meta.dirname, 'fixtures/macro-inline-config');
const MODULE_KEY = 'pet-card';

describe('inline macro config — headless', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  // ── renderInlineConfig ───────────────────────────────────────────────

  it('renders the addConfig tree as a separate doc from the view', async () => {
    const cfg = await sim.ui.renderInlineConfig(MODULE_KEY);

    // Both trees are reachable
    const view = sim.ui.getForgeDoc(MODULE_KEY);
    expect(view).not.toBeNull();
    expect(view!.type).toBe('Root');

    expect(cfg.doc.type).toBe('MacroConfig');
    expect(sim.ui.getMacroConfigDoc(MODULE_KEY)).toBe(cfg.doc);
  });

  it('extracts named form fields from the config tree', async () => {
    const cfg = await sim.ui.renderInlineConfig(MODULE_KEY);
    const fields = cfg.getFields();

    expect(fields).toHaveLength(2);
    const byName = Object.fromEntries(fields.map(f => [f.name, f]));
    expect(byName.name.type).toBe('Textfield');
    expect(byName.name.defaultValue).toBe('Whiskers');
    expect(byName.tier.type).toBe('Select');
    expect(byName.tier.defaultValue).toBe('gold');
    expect(byName.tier.props.options).toHaveLength(3);
  });

  it('validate() reports no violations for an allowed-only tree', async () => {
    const cfg = await sim.ui.renderInlineConfig(MODULE_KEY);
    const result = cfg.validate();
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ── save() ───────────────────────────────────────────────────────────

  it('save() persists values that the next render() exposes via useConfig', async () => {
    const cfg = await sim.ui.renderInlineConfig(MODULE_KEY);
    await cfg.save({ name: 'Buddy', tier: 'platinum' });

    expect(sim.ui.getMacroConfig(MODULE_KEY)).toEqual({
      name: 'Buddy',
      tier: 'platinum',
    });

    // Re-render the view — useConfig should pick up the saved values.
    sim.ui.reset = sim.ui.reset; // (no-op — keep saved config; reset() would clear it)
    await sim.ui.refresh(MODULE_KEY);
    const doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Buddy — Tier: platinum');
    expect(sim.ui.getTextContent(doc)).toContain('Buddy');
    expect(sim.ui.getTextContent(doc)).toContain('platinum');
  });

  it('save() with no args persists declared defaults (matches platform Save-without-edits)', async () => {
    const cfg = await sim.ui.renderInlineConfig(MODULE_KEY);
    await cfg.save();

    expect(sim.ui.getMacroConfig(MODULE_KEY)).toEqual({
      name: 'Whiskers', // TextField defaultValue
      tier: 'gold',     // Select defaultValue
    });
  });

  it('save() warns and drops keys that have no matching named field', async () => {
    const cfg = await sim.ui.renderInlineConfig(MODULE_KEY);
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...args: any[]) => { warnings.push(args.join(' ')); };
    try {
      await cfg.save({ name: 'Mittens', bogus: 'nope' });
    } finally {
      console.warn = orig;
    }
    expect(sim.ui.getMacroConfig(MODULE_KEY)).toEqual({
      name: 'Mittens',
      tier: 'gold', // default preserved
    });
    expect(warnings.some(w => w.includes('"bogus"'))).toBe(true);
  });

  // ── setMacroConfig fast-path ─────────────────────────────────────────

  it('setMacroConfig() seeds the config without rendering the form', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Felix', tier: 'standard' });
    expect(sim.ui.getMacroConfig(MODULE_KEY)).toEqual({
      name: 'Felix',
      tier: 'standard',
    });

    // Render the view directly — useConfig() should resolve to the seeded values.
    await sim.ui.render(MODULE_KEY);
    const doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Felix — Tier: standard');
    expect(sim.ui.getTextContent(doc)).toContain('Felix');
  });

  // ── view defaults when no config saved ────────────────────────────────

  it('view shows fallback text when no config has been saved', async () => {
    await sim.ui.render(MODULE_KEY);
    const doc = await sim.ui.waitForContent(MODULE_KEY, '(unnamed)');
    // useConfig() resolves to {} → both fields fall back to the view's defaults
    expect(sim.ui.getTextContent(doc)).toContain('(unnamed)');
    expect(sim.ui.getTextContent(doc)).toContain('standard');
  });

  // ── validation surface ────────────────────────────────────────────────

  it('validateInlineConfigTree() catches disallowed components', () => {
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        { type: 'TextField', props: { name: 'ok' }, key: '1', children: [] },
        { type: 'Button',    props: { text: 'no'  }, key: '2', children: [] },
      ],
    };
    const result = validateInlineConfigTree(fakeTree);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('Button');
    expect(result.violations[0].kind).toBe('disallowed-component');
  });

  it('validateInlineConfigTree() does NOT flag text-content children of <Label>', () => {
    // Regression: the Forge docs canonical pattern is <Label>Pet age</Label>,
    // which the reconciler emits with an inner { type: 'String' } text node.
    // Walking blindly into that and checking against the allowed-component
    // set falsely flagged String as disallowed. The validator now skips
    // reconciler primitives.
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        {
          type: 'Label',
          props: {},
          key: 'l',
          children: [{ type: 'String', props: { text: 'Pet age' }, key: 's', children: [] }],
        },
        { type: 'Textfield', props: { name: 'age' }, key: 't', children: [] },
      ],
    };
    const result = validateInlineConfigTree(fakeTree);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('validateInlineConfigTree() suggests CheckboxGroup when <Checkbox> is used', () => {
    // Real Forge inline config only supports CheckboxGroup, not the singular
    // Checkbox. This is the most common Forge inline-config gotcha — devs
    // (and LLM agents) reach for <Checkbox name="flag" /> assuming it works
    // for boolean fields. The validator points them at the right component.
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        { type: 'Checkbox', props: { name: 'isActive' }, key: '1', children: [] },
      ],
    };
    const result = validateInlineConfigTree(fakeTree);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].kind).toBe('disallowed-component');
    expect(result.violations[0].type).toBe('Checkbox');
    expect(result.violations[0].message).toContain('Did you mean <CheckboxGroup>?');
  });

  it('validateInlineConfigTree() suggests RadioGroup when <Radio> is used', () => {
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        { type: 'Radio', props: { name: 'pick', value: 'a' }, key: '1', children: [] },
      ],
    };
    const result = validateInlineConfigTree(fakeTree);
    expect(result.violations[0].message).toContain('Did you mean <RadioGroup>?');
  });

  it('validateInlineConfigTree() omits hint for genuinely unrelated components', () => {
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        { type: 'Button', props: { text: 'no' }, key: '1', children: [] },
      ],
    };
    const result = validateInlineConfigTree(fakeTree);
    expect(result.violations[0].message).not.toContain('Did you mean');
  });

  it('validateInlineConfigTree() catches form fields missing a name prop', () => {
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        { type: 'TextField', props: {}, key: '1', children: [] },
      ],
    };
    const result = validateInlineConfigTree(fakeTree);
    expect(result.valid).toBe(false);
    expect(result.violations[0].kind).toBe('missing-name');
  });

  it('extractInlineConfigFields() ignores layout-only nodes', () => {
    const fakeTree = {
      type: 'MacroConfig',
      props: {},
      key: 'r',
      children: [
        { type: 'Label', props: { children: 'Pet age' }, key: 'l', children: [] },
        { type: 'TextField', props: { name: 'age', defaultValue: 5 }, key: 't', children: [] },
        { type: 'Fragment', props: {}, key: 'f', children: [
          { type: 'Select', props: { name: 'color', defaultValue: 'red' }, key: 's', children: [] },
        ] },
      ],
    };
    const fields = extractInlineConfigFields(fakeTree);
    expect(fields.map(f => f.name)).toEqual(['age', 'color']);
  });

  // ── error paths ───────────────────────────────────────────────────────

  it('renderInlineConfig() throws for non-macro modules', async () => {
    // Reuse a custom-field fixture for this case
    const cfSim = new ForgeSimulator();
    await cfSim.deploy(join(import.meta.dirname, 'fixtures/custom-field'));
    await expect(
      cfSim.ui.renderInlineConfig('priority-score--edit')
    ).rejects.toThrow(/macro module/);
    cfSim.ui.resetAll();
  });

  it('renderInlineConfig() throws for unknown module keys', async () => {
    await expect(
      sim.ui.renderInlineConfig('not-a-real-key')
    ).rejects.toThrow(/No UI module/);
  });
});
