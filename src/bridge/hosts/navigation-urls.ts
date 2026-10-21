/**
 * `router.getUrl()` — the product path for a `NavigationLocation`, shared by
 * both hosts.
 *
 * The real `@forge/bridge` requires `location.target` and runs `new URL()`
 * on whatever the host answers (out/router/router.js getUrl), so a host must
 * return an ABSOLUTE url or the package throws `Failed to get URL`. The
 * target → path table is a static property of the products and does not
 * vary by environment; only the origin does — the page's own in a browser,
 * the simulated site's headless. Each host supplies that and resolves the
 * path here against it.
 *
 * No DOM and no Node: pulled into the browser bundle as well as the root build.
 */

import type { BridgeNavigationLocation } from '../protocol/index.js';

/** The product path for a location, or null when the target is unknown. A string location is returned as-is. */
export function resolveNavigationPath(location: BridgeNavigationLocation): string | null {
  if (typeof location === 'string') return location;
  const l = location as Record<string, any>;
  if (typeof l.url === 'string') return l.url;
  switch (l.target) {
    case 'issue': return `/browse/${l.issueKey}`;
    case 'contentView': return `/wiki/pages/${l.contentId}`;
    case 'contentEdit': return `/wiki/pages/edit-v2/${l.contentId}`;
    case 'contentList': return `/wiki/spaces/${l.spaceKey}/pages`;
    case 'spaceView': return `/wiki/spaces/${l.spaceKey}`;
    case 'dashboard': return `/jira/dashboards/${l.dashboardId}`;
    case 'userProfile': return `/people/${l.accountId}`;
    case 'projectSettingsDetails': return `/jira/software/projects/${l.projectKey}/settings`;
    case 'module': return `/module/${l.moduleKey}/`;
    default: return null;
  }
}

/** Resolve a location to the absolute url the real package demands, or null when it cannot be mapped. */
export function resolveNavigationUrl(location: BridgeNavigationLocation, origin: string): string | null {
  const path = resolveNavigationPath(location);
  if (path === null) return null;
  try { return new URL(path, origin).toString(); } catch { return null; }
}
