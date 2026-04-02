/**
 * Tests for view event listeners: onSubmit, onClose, onRefresh.
 *
 * These verify that when app code calls view.submit(), view.close(), or
 * view.refresh() from @forge/bridge, the SimulatorUI fires the
 * corresponding listener with the module key and payload.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSimulator, type ForgeSimulator } from '../index.js';

const FIXTURE_DIR = new URL('./fixtures/custom-field', import.meta.url).pathname;

describe('View Events', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE_DIR);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('onSubmit fires when edit view calls view.submit()', async () => {
    const submitHandler = vi.fn();
    sim.ui.onSubmit(submitHandler);

    await sim.ui.render('priority-score--edit');
    const doc = sim.ui.getForgeDoc('priority-score--edit');
    expect(doc).not.toBeNull();

    // Find and click the Save button
    const saveBtn = sim.ui.findByTypeAndText(doc!, 'Button', 'Save');
    await sim.ui.interact(saveBtn, 'onClick');

    // Give the async handler a tick to fire
    await new Promise(r => setTimeout(r, 10));

    expect(submitHandler).toHaveBeenCalledWith('priority-score--edit', { value: 99 });
  });

  it('onClose fires when edit view calls view.close()', async () => {
    const closeHandler = vi.fn();
    sim.ui.onClose(closeHandler);

    await sim.ui.render('priority-score--edit');
    const doc = sim.ui.getForgeDoc('priority-score--edit');

    const cancelBtn = sim.ui.findByTypeAndText(doc!, 'Button', 'Cancel');
    await sim.ui.interact(cancelBtn, 'onClick');

    await new Promise(r => setTimeout(r, 10));

    expect(closeHandler).toHaveBeenCalledWith('priority-score--edit', undefined);
  });

  it('onRefresh fires when edit view calls view.refresh()', async () => {
    const refreshHandler = vi.fn();
    sim.ui.onRefresh(refreshHandler);

    await sim.ui.render('priority-score--edit');
    const doc = sim.ui.getForgeDoc('priority-score--edit');

    const refreshBtn = sim.ui.findByTypeAndText(doc!, 'Button', 'Refresh');
    await sim.ui.interact(refreshBtn, 'onClick');

    await new Promise(r => setTimeout(r, 10));

    expect(refreshHandler).toHaveBeenCalledWith('priority-score--edit', { updated: true });
  });

  it('unbind function stops listener from firing', async () => {
    const handler = vi.fn();
    const unbind = sim.ui.onSubmit(handler);

    await sim.ui.render('priority-score--edit');
    const doc = sim.ui.getForgeDoc('priority-score--edit');

    // Unbind before interacting
    unbind();

    const saveBtn = sim.ui.findByTypeAndText(doc!, 'Button', 'Save');
    await sim.ui.interact(saveBtn, 'onClick');

    await new Promise(r => setTimeout(r, 10));

    expect(handler).not.toHaveBeenCalled();
  });

  it('view sub-module renders independently', async () => {
    await sim.ui.render('priority-score--view');
    const viewDoc = sim.ui.getForgeDoc('priority-score--view');
    expect(viewDoc).not.toBeNull();
    expect(sim.ui.getTextContent(viewDoc!)).toContain('Current value: 42');

    await sim.ui.render('priority-score--edit');
    const editDoc = sim.ui.getForgeDoc('priority-score--edit');
    expect(editDoc).not.toBeNull();
    expect(sim.ui.getTextContent(editDoc!)).toContain('Edit mode');

    // Both docs should coexist
    expect(sim.ui.getRenderedModules()).toContain('priority-score--view');
    expect(sim.ui.getRenderedModules()).toContain('priority-score--edit');
  });

  it('custom field submit → re-render view flow (manual orchestration)', async () => {
    let submittedValue: any = null;

    sim.ui.onSubmit((_moduleKey, payload) => {
      submittedValue = payload;
    });

    // 1. Render view
    await sim.ui.render('priority-score--view');
    expect(sim.ui.getTextContent(sim.ui.getForgeDoc('priority-score--view')!))
      .toContain('Current value: 42');

    // 2. Render edit and submit
    await sim.ui.render('priority-score--edit');
    const editDoc = sim.ui.getForgeDoc('priority-score--edit')!;
    const saveBtn = sim.ui.findByTypeAndText(editDoc, 'Button', 'Save');
    await sim.ui.interact(saveBtn, 'onClick');

    await new Promise(r => setTimeout(r, 10));

    // 3. Capture the submitted value
    expect(submittedValue).toEqual({ value: 99 });

    // 4. Dev could re-render view with the new value in context
    //    (the orchestration is in their hands, we just provide the event)
  });
});
