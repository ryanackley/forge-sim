/**
 * Placement context from the page query string, in the browser bridge.
 *
 * The dev server and the modal URL builder both encode a full placement as
 * BASE64 JSON in `?context=`, alongside the `issueKey` / `contentId` /
 * `spaceKey` shorthands. The first cut of the shared browser host decoded
 * `?context=` as URI-encoded JSON and ignored the shorthands entirely, so
 * every resolver invoke and getContext from a Custom UI or proxied frame
 * went up with no placement — resolvers would see a default context instead
 * of the issue/page the app was actually embedded in.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { installBrowserBridge } from './helpers/browser-bridge-harness.js';
import { readContextOptionsFromUrl } from '../bridge/hosts/browser/context.js';

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/module/panel/${search}`);
}

describe('context options from the page URL', () => {
  beforeEach(() => setSearch(''));

  it('returns undefined when the URL carries no placement', () => {
    expect(readContextOptionsFromUrl()).toBeUndefined();
  });

  it('reads the issueKey / contentId / spaceKey shorthands', () => {
    setSearch('?issueKey=TEST-1&spaceKey=ENG');
    expect(readContextOptionsFromUrl()).toEqual({ issueKey: 'TEST-1', spaceKey: 'ENG' });
  });

  it('decodes ?context= as base64 JSON, the shape the dev server writes', () => {
    const context = { issueKey: 'B-2', extension: { type: 'jira:issuePanel' } };
    setSearch(`?context=${encodeURIComponent(btoa(JSON.stringify(context)))}`);
    expect(readContextOptionsFromUrl()).toEqual(context);
  });

  it('merges both forms, with ?context= winning on a conflict', () => {
    setSearch(`?issueKey=FROM-SHORTHAND&context=${encodeURIComponent(btoa(JSON.stringify({ issueKey: 'FROM-CONTEXT' })))}`);
    expect(readContextOptionsFromUrl()).toEqual({ issueKey: 'FROM-CONTEXT' });
  });

  it('survives a malformed ?context= instead of throwing into app code', () => {
    setSearch('?issueKey=T-1&context=not-base64!!');
    expect(readContextOptionsFromUrl()).toEqual({ issueKey: 'T-1' });
  });

  it('rides along on invoke and getContext so resolvers see the placement', async () => {
    setSearch('?issueKey=TEST-9');
    const { callBridge, rpcs } = installBrowserBridge({
      moduleKey: 'panel',
      getContextOptions: readContextOptionsFromUrl,
    });

    await callBridge('invoke', { functionKey: 'f', payload: { a: 1 } });
    await callBridge('getContext');

    expect(rpcs[0]).toEqual({
      method: 'invoke',
      params: { functionKey: 'f', payload: { a: 1 }, moduleKey: 'panel', contextOptions: { issueKey: 'TEST-9' } },
    });
    expect(rpcs[1]).toEqual({
      method: 'getContext',
      params: { moduleKey: 'panel', contextOptions: { issueKey: 'TEST-9' } },
    });
  });
});
