/**
 * P2 investigation — does `simulateEvent(textfield, 'onChange', {target: {value}})`
 * reach react-hook-form's register-returned onChange, and does it update
 * useForm state so handleSubmit can pass validation?
 *
 * These tests are exploratory — they pin down what currently works vs. doesn't
 * before we design the fix.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/useform-textfield');

describe('P2 — useForm + Textfield headless interaction', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE);
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('Textfield in the tree carries a register-bound onChange function', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;
    const tf = sim.ui.findByType(doc, 'Textfield')[0];
    expect(tf).toBeDefined();
    expect(typeof tf.props.onChange).toBe('function');
    expect(tf.props.name).toBe('name');
  });

  it('what does register return for onChange — call it different ways', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;
    const tf = sim.ui.findByType(doc, 'Textfield')[0];

    // Inspect what we got — try different invocation patterns
    console.log('--- Textfield props keys ---', Object.keys(tf.props));
    console.log('--- onChange.length (arity) ---', tf.props.onChange?.length);
    console.log('--- has ref ---', typeof tf.props.ref);

    // Pattern A: pass a synthetic event with target.value (what the agent did)
    let resultA;
    try {
      resultA = tf.props.onChange({ target: { value: 'A', name: 'name' } });
    } catch (e) { resultA = `THREW: ${(e as Error).message}`; }
    console.log('--- Pattern A (synthetic event) returned:', resultA);

    // Pattern B: pass the raw value (some RHF setups support this)
    let resultB;
    try {
      resultB = tf.props.onChange('B');
    } catch (e) { resultB = `THREW: ${(e as Error).message}`; }
    console.log('--- Pattern B (raw value) returned:', resultB);

    // Pattern C: pass a fully-shaped React-like event
    let resultC;
    try {
      resultC = tf.props.onChange({
        target: { value: 'C', name: 'name' },
        currentTarget: { value: 'C', name: 'name' },
        preventDefault: () => {},
        stopPropagation: () => {},
        type: 'change',
      });
    } catch (e) { resultC = `THREW: ${(e as Error).message}`; }
    console.log('--- Pattern C (full event) returned:', resultC);
  });

  it('useForm: event with target.type triggers RHF native-input path', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;
    const tfs = sim.ui.findByType(doc, 'Textfield');
    // FormApp's Textfield is the one WITHOUT value prop
    const useFormTf = tfs.find(t => t.props.value === undefined);
    expect(useFormTf).toBeDefined();

    // Add target.type — what a real native <input> would have
    sim.ui.interact(useFormTf!, 'onChange', { target: { value: 'TYPED', name: 'name', type: 'text' } });
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const form = sim.ui.findByType(sim.ui.getForgeDoc('form-page')!, 'Form')[0];
    await form.props.onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const finalText = sim.ui.getTextContent(sim.ui.getForgeDoc('form-page')!);
    console.log('=== useForm w/ target.type=text: ===', finalText);
  });

  it('MANUAL controlled component: passes browser-style synthetic event', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;
    const tfs = sim.ui.findByType(doc, 'Textfield');
    // ManualApp's Textfield is the second one (FormApp is first)
    const manualTf = tfs.find(t => t.props.value !== undefined);
    expect(manualTf).toBeDefined();

    // Pass browser-style synthetic event (what real DOM would give you)
    sim.ui.interact(manualTf!, 'onChange', { target: { value: 'manual-test' } });
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const saveBtn = sim.ui.findByType(sim.ui.getForgeDoc('form-page')!, 'Button')
      .find(b => sim.ui.getTextContent(b).includes('Save'));
    sim.ui.interact(saveBtn!, 'onClick');
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const finalText = sim.ui.getTextContent(sim.ui.getForgeDoc('form-page')!);
    console.log('=== manual w/ synthetic event: ===', finalText);
    expect(finalText).toContain('saved: manual-test');
  });

  it('MANUAL controlled component: passing RAW value breaks it', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;
    const tfs = sim.ui.findByType(doc, 'Textfield');
    const manualTf = tfs.find(t => t.props.value !== undefined);

    // Pass the raw value (what works for register() in useForm)
    try {
      sim.ui.interact(manualTf!, 'onChange', 'manual-raw');
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      const finalText = sim.ui.getTextContent(sim.ui.getForgeDoc('form-page')!);
      console.log('=== manual w/ raw value: ===', finalText);
    } catch (e) {
      console.log('=== manual w/ raw value THREW: ===', (e as Error).message);
    }
  });

  it('does passing the raw value to onChange give us a clean submit?', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;
    const tf = sim.ui.findByType(doc, 'Textfield')[0];

    // Pass just the string, not a synthetic event
    sim.ui.interact(tf, 'onChange', 'Ryan');
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const form = sim.ui.findByType(doc, 'Form')[0];
    await form.props.onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const finalText = sim.ui.getTextContent(sim.ui.getForgeDoc('form-page')!);
    console.log('=== with raw value: ===', finalText);
  });

  it('CURRENT BEHAVIOR: simulateEvent + handleSubmit shows what happens today', async () => {
    await sim.ui.render('form-page');
    const doc = sim.ui.getForgeDoc('form-page')!;

    // Step 1: fire onChange on the Textfield with a synthetic event
    const tf = sim.ui.findByType(doc, 'Textfield')[0];
    sim.ui.interact(tf, 'onChange', { target: { value: 'Ryan', name: 'name' } });

    // Step 2: wait for any state-update re-renders to flush
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    // Step 3: fire Form.onSubmit (this is handleSubmit, which validates first)
    const form = sim.ui.findByType(doc, 'Form')[0];
    const onSubmit = form.props.onSubmit;
    expect(typeof onSubmit).toBe('function');

    // handleSubmit returns a function that takes the form event
    await onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });

    // Wait for any post-submit state updates
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    // Step 4: inspect the tree to see what landed
    const finalDoc = sim.ui.getForgeDoc('form-page')!;
    const textContent = sim.ui.getTextContent(finalDoc);

    // Log everything for diagnosis (test always passes; this is investigation)
    console.log('=== Final tree text ===');
    console.log(textContent);
    console.log('=== Final tree (pretty) ===');
    console.log(sim.ui.prettyPrint(finalDoc).slice(0, 1500));

    // Loose assertion: did anything indicate success or failure?
    if (textContent.includes('submitted: Ryan')) {
      console.log('✅ onChange THROUGH useForm WORKED');
    } else if (textContent.includes('error:')) {
      console.log('❌ Validation failed — useForm did not see "Ryan"');
    } else {
      console.log('❓ Neither path triggered — onSubmit may not have fired');
    }
  });
});
