/**
 * Web Trigger URL management — mirrors real @forge/api's webTrigger surface.
 *
 * Real surface (node_modules/@forge/api/out/webTrigger.js):
 *   getUrl(webTriggerModuleKey, forceCreate = false) → Promise<string>
 *   deleteUrl(webTriggerUrl) → Promise<void>
 *   queryUrls(moduleKey?) → Promise<Array<{ moduleKey, url }>>
 *
 * Real URL formats (manifest `urlFormat`):
 *   v1 (default): https://<uuid>.hello.atlassian-dev.net/x1/<id>
 *   v2:           https://<uuid>.webtrigger.atlassian.app/public/<id>
 *
 * Parity quirks deliberately mirrored:
 *   - deleteUrl extracts the ID with /\/x1\/([^\/\?\#]+)/ — it can NOT parse
 *     v2 (/public/) URLs and throws the parse error, exactly like real Forge.
 *   - Error strings are byte-identical to the real package.
 *
 * When the dev server is running (globalThis.__forgeSim_devPort__ set),
 * generated URLs point at localhost so they are actually invokable:
 *   http://localhost:<port>/x1/<id>  (or /public/<id> for v2)
 */

import { randomUUID } from 'node:crypto';
import type { ManifestWebTrigger } from './manifest.js';

export interface WebTriggerUrlRecord {
  id: string;
  moduleKey: string;
  url: string;
}

/** Real @forge/api's ID-extraction regex, verbatim. */
const URL_ID_REGEX = /\/x1\/([^\/\?\#]+)/;

export class WebTriggerUrlRegistry {
  /** moduleKey → trigger definition (registered at deploy) */
  private modules = new Map<string, ManifestWebTrigger>();
  /** id → active URL record */
  private urls = new Map<string, WebTriggerUrlRecord>();
  /** Stable fake app host UUID (one per registry, like one per installation) */
  private readonly hostUuid = randomUUID();

  /** Register web trigger modules from a parsed manifest (called on deploy). */
  registerModules(triggers: ManifestWebTrigger[]): void {
    this.modules.clear();
    for (const t of triggers) this.modules.set(t.key, t);
    // Drop URLs whose module no longer exists after redeploy
    for (const [id, rec] of this.urls) {
      if (!this.modules.has(rec.moduleKey)) this.urls.delete(id);
    }
  }

  /** Module definition lookup (used by the HTTP handler for static outputs). */
  getModule(moduleKey: string): ManifestWebTrigger | undefined {
    return this.modules.get(moduleKey);
  }

  /** Resolve a URL id → module key. Undefined when unknown or deleted. */
  resolveId(id: string): string | undefined {
    return this.urls.get(id)?.moduleKey;
  }

  private buildUrl(trigger: ManifestWebTrigger, id: string): string {
    const isV2 = trigger.urlFormat === 'v2';
    const pathPart = isV2 ? `/public/${id}` : `/x1/${id}`;
    const devPort = (globalThis as any).__forgeSim_devPort__;
    if (devPort) {
      return `http://localhost:${devPort}${pathPart}`;
    }
    return isV2
      ? `https://${this.hostUuid}.webtrigger.atlassian.app${pathPart}`
      : `https://${this.hostUuid}.hello.atlassian-dev.net${pathPart}`;
  }

  /**
   * Get (or create) the URL for a web trigger module.
   * Mirrors real getUrl: reuses the existing URL unless forceCreate is true.
   */
  async getUrl(webTriggerModuleKey: string, forceCreate = false): Promise<string> {
    const trigger = this.modules.get(webTriggerModuleKey);
    if (!trigger) {
      // Real backend fails → shim throws this exact string.
      throw new Error('Internal error occurred: Failed to get web trigger URL.');
    }

    if (!forceCreate) {
      for (const rec of this.urls.values()) {
        if (rec.moduleKey === webTriggerModuleKey) return rec.url;
      }
    }

    const id = randomUUID().replace(/-/g, '');
    const url = this.buildUrl(trigger, id);
    this.urls.set(id, { id, moduleKey: webTriggerModuleKey, url });
    return url;
  }

  /**
   * Delete a web trigger URL. Mirrors real deleteUrl:
   *   - ID extracted via /\/x1\/.../ regex (v2 URLs fail the parse — real quirk)
   *   - unknown ID → backend-style failure with default errorText
   */
  async deleteUrl(webTriggerUrl: string): Promise<void> {
    const match = webTriggerUrl.match(URL_ID_REGEX);
    const id = match?.[1];
    if (!id) {
      throw new Error('Internal error occurred: Failed to parse web trigger URL for ID');
    }
    if (!this.urls.has(id)) {
      throw new Error('Internal error occurred: Failed to delete web trigger URL: unknown error');
    }
    this.urls.delete(id);
  }

  /**
   * List active web trigger URLs, optionally filtered by module key.
   * Mirrors real queryUrls (fetch all, filter client-side).
   */
  async queryUrls(moduleKey?: string): Promise<Array<{ moduleKey: string; url: string }>> {
    const all = [...this.urls.values()].map((r) => ({ moduleKey: r.moduleKey, url: r.url }));
    return moduleKey ? all.filter((r) => r.moduleKey === moduleKey) : all;
  }

  /** Clear all state (simulator reset). */
  reset(): void {
    this.modules.clear();
    this.urls.clear();
  }
}
