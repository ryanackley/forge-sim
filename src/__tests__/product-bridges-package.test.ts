/**
 * The REAL @forge/{jira,confluence,dashboards}-bridge packages, driven against
 * the bridge seam — the `*-package.test.ts` pattern applied to the product
 * bridges (Phase 4b).
 *
 * Why the real packages and not the shims: every one of these APIs validates
 * what comes back from `callBridge` and throws a BridgeAPIError when it does
 * not fit (see the file references in `src/bridge/hosts/product-surfaces.ts`).
 * A shim-shaped answer that looks fine in isolation fails inside the package,
 * which is lesson #5 — only the real package proves the real path.
 *
 * Loaded with `createRequire` at the `out/index.js` subpath: CJS bypasses the
 * vitest alias to the shims, and these three packages ship no `main` and no
 * `exports`, so a bare specifier cannot resolve under Node at all until
 * Phase 4d teaches the loader about them. The seam itself is in place from
 * the ForgeSimulator constructor (Phase 4a) — the jira package captures
 * `callBridge` at module evaluation.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const require = createRequire(import.meta.url);

let sim: ForgeSimulator;
let jira: any;
let confluence: any;
let dashboards: any;

beforeAll(() => {
  // Constructing the sim installs globalThis.__bridge, which the jira
  // package reads at module scope on the next line.
  sim = createSimulator();
  jira = require('@forge/jira-bridge/out/index.js');
  confluence = require('@forge/confluence-bridge/out/index.js');
  dashboards = require('@forge/dashboards-bridge/out/index.js');
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  sim.ui.reset();
});

/** Commands the dispatcher saw, in order. */
const commands = () => sim.ui.getBridgeCalls().map((c) => c.cmd);

describe('@forge/jira-bridge', () => {
  it('ViewIssueModal.open() resolves and the simulated modal closes itself', async () => {
    const onClose = vi.fn();
    const modal = new jira.ViewIssueModal({ context: { issueKey: 'TEST-1' }, onClose });

    await expect(modal.open()).resolves.toBeUndefined();
    expect(commands()).toContain('openIssueViewModal');

    // No Jira to keep it open, so onClose fires on its own — an app that
    // awaits it must not hang.
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('ViewIssueModal rejects a context with no issueKey, client-side', () => {
    // Real validation (out/modal/issue-view.js) the old shim did not have:
    // it throws in the CONSTRUCTOR, before any bridge call.
    expect(() => new jira.ViewIssueModal({ context: {} as never })).toThrow(/issueKey is missing/);
    expect(commands()).toEqual([]);
  });

  it('CreateIssueModal.open() resolves and reports that no issues were created', async () => {
    const onClose = vi.fn();
    await new jira.CreateIssueModal({ onClose }).open();
    expect(commands()).toContain('openIssueCreateModal');
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith({ payload: [] }));
  });

  it('workflowRules.onConfigure() registers without throwing', async () => {
    await expect(jira.workflowRules.onConfigure(() => 'config')).resolves.toBeUndefined();
    expect(commands()).toContain('setWorkflowRuleConfigurationCallback');
  });

  it('customFieldApi.getFieldData() registers; the callback never fires with no host', async () => {
    const onData = vi.fn();
    await expect(jira.customFieldApi.getFieldData(onData)).resolves.toBeDefined();
    expect(commands()).toContain('getCustomFieldInternalAPI');
    expect(onData).not.toHaveBeenCalled();
  });

  it('uiModificationsApi.onInit() runs the app callbacks against an empty form', async () => {
    // Unlike the rest of these surfaces this is not inert: out/ui-modifications/
    // onInit.js invokes both app callbacks as soon as the internal API
    // resolves, so "registered and waiting" is not a state that exists. The
    // app sees a form with no fields rather than never running at all.
    const registerFields = vi.fn().mockReturnValue([]);
    const onInit = vi.fn();

    await expect(jira.uiModificationsApi.onInit(onInit, registerFields)).resolves.toBeUndefined();

    expect(commands()).toContain('getUiModificationsInternalAPI');
    expect(registerFields).toHaveBeenCalledWith({ uiModifications: [] });
    expect(onInit).toHaveBeenCalledOnce();
    const { api } = onInit.mock.calls[0][0];
    expect(api.getFields()).toEqual([]);
    expect(api.getFieldById('summary')).toBeUndefined();
  });

  it('uiModificationsApi.onChange() subscribes; the callback never fires with no host', async () => {
    const onChange = vi.fn();
    await expect(jira.uiModificationsApi.onChange(onChange, () => [])).resolves.toBeUndefined();
    expect(commands()).toContain('getUiModificationsInternalAPI');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('@forge/confluence-bridge', () => {
  it('getEditorContent() / getMacroContent() return an empty document, not a throw', async () => {
    // Both throw BridgeAPIError on a FALSY answer, so `{ data: '' }` is the
    // smallest thing that is still a document.
    await expect(confluence.getEditorContent()).resolves.toEqual({ data: '' });
    await expect(confluence.getMacroContent()).resolves.toEqual({ data: '' });
    expect(commands()).toEqual(['getEditorContent', 'getMacroContent']);
  });

  it('updateMacro() and setMacroViewportHeight() resolve', async () => {
    await expect(confluence.updateMacro({ data: '<p>x</p>' })).resolves.toBe(true);
    await expect(confluence.setMacroViewportHeight(300)).resolves.toBe(true);
    expect(commands()).toEqual(['updateMacro', 'setMacroViewportHeight']);
  });

  it('setMacroViewportHeight() rejects a non-positive height client-side', async () => {
    // out/content/setMacroViewportHeight.js validates before calling the
    // bridge; the old shim accepted anything.
    await expect(confluence.setMacroViewportHeight(0)).rejects.toThrow(/positive integer/);
    expect(commands()).toEqual([]);
  });

  it('updateBylineProperties() rides the existing cross-module emit command', async () => {
    await expect(
      confluence.updateBylineProperties({ propertyKey: 'k', valueUpdate: { title: 'T' } }),
    ).resolves.toBeUndefined();
    // Not a product-bridge command of its own — out/content/updateBylineProperties.js
    // sends `emit` with event FORGE_CONTENT_PROPERTY_UPDATED.
    expect(commands()).toEqual(['emit']);
    expect(sim.ui.getBridgeCalls()[0].data).toMatchObject({ event: 'FORGE_CONTENT_PROPERTY_UPDATED' });
  });
});

describe('@forge/dashboards-bridge', () => {
  it('widgetEdit save callbacks register without throwing', async () => {
    // Each of these first calls view.getContext() to split the extension
    // (out/widgets/edit/utils/get-context-extension.js), so the headless
    // default context has to be shaped enough to destructure.
    await expect(dashboards.widgetEdit.onSave(async () => {})).resolves.toBeUndefined();
    await expect(dashboards.widgetEdit.onProductSave(async () => null)).resolves.toBeUndefined();
    await expect(dashboards.widgetEdit.onSaveError(() => {})).resolves.toBeUndefined();
    expect(commands()).toEqual([
      'getContext', 'getWidgetEditApi',
      'getContext', 'getWidgetEditApi',
      'getContext', 'getWidgetEditApi',
    ]);
  });

  it('widgetEdit.updateConfig() and widget.setPreviewConfig() resolve', async () => {
    await expect(dashboards.widgetEdit.updateConfig({ a: 1 })).resolves.toBeUndefined();
    await expect(dashboards.widget.setPreviewConfig({ a: 1 })).resolves.toBeUndefined();
    expect(commands()).toEqual(['getWidgetEditApi', 'getWidgetApi']);
  });
});
