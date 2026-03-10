/**
 * Simulated Property Store for Jira issue properties, Confluence content/space properties.
 *
 * These are the backing store for useIssueProperty, useContentProperty, useSpaceProperty hooks.
 * When no real API is connected, properties are stored here.
 * When real API is connected, this store is bypassed (hooks talk to real APIs).
 *
 * Data format mirrors the REST API response:
 *   GET /rest/api/2/issue/{id}/properties/{key} → { key, value }
 *   PUT /rest/api/2/issue/{id}/properties/{key} ← body is the value
 *   POST /rest/api/2/issue/properties ← { entitiesIds, properties: { key: value } }
 */

import type { ProductApiRequest, ProductApiResponse } from './types.js';

function makeResponse(status: number, body: any): ProductApiResponse {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json' },
    ok: status >= 200 && status < 300,
    json: async () => typeof body === 'string' ? JSON.parse(body) : body,
    text: async () => bodyStr,
  };
}

export class PropertyStore {
  // Key format: "jira:issue:{issueId}:{propertyKey}" or "confluence:content:{contentId}:{key}"
  private properties = new Map<string, any>();

  // ── Jira Issue Properties ───────────────────────────────────────────

  getIssueProperty(issueId: string, propertyKey: string): any | undefined {
    return this.properties.get(`jira:issue:${issueId}:${propertyKey}`);
  }

  setIssueProperty(issueId: string, propertyKey: string, value: any): void {
    this.properties.set(`jira:issue:${issueId}:${propertyKey}`, value);
  }

  deleteIssueProperty(issueId: string, propertyKey: string): boolean {
    return this.properties.delete(`jira:issue:${issueId}:${propertyKey}`);
  }

  // ── Confluence Content Properties ───────────────────────────────────

  getContentProperty(contentId: string, propertyKey: string): any | undefined {
    return this.properties.get(`confluence:content:${contentId}:${propertyKey}`);
  }

  setContentProperty(contentId: string, propertyKey: string, value: any): void {
    this.properties.set(`confluence:content:${contentId}:${propertyKey}`, value);
  }

  deleteContentProperty(contentId: string, propertyKey: string): boolean {
    return this.properties.delete(`confluence:content:${contentId}:${propertyKey}`);
  }

  // ── Confluence Space Properties ─────────────────────────────────────

  getSpaceProperty(spaceKey: string, propertyKey: string): any | undefined {
    return this.properties.get(`confluence:space:${spaceKey}:${propertyKey}`);
  }

  setSpaceProperty(spaceKey: string, propertyKey: string, value: any): void {
    this.properties.set(`confluence:space:${spaceKey}:${propertyKey}`, value);
  }

  deleteSpaceProperty(spaceKey: string, propertyKey: string): boolean {
    return this.properties.delete(`confluence:space:${spaceKey}:${propertyKey}`);
  }

  // ── Route Handlers ──────────────────────────────────────────────────

  /**
   * Handle Jira property API routes. Returns null if the route doesn't match.
   */
  handleJiraRoute(path: string, options?: ProductApiRequest): ProductApiResponse | null {
    const method = options?.method?.toUpperCase() ?? 'GET';

    // POST /rest/api/2/issue/properties — bulk set
    const bulkMatch = path.match(/^\/rest\/api\/[23]\/issue\/properties$/);
    if (bulkMatch && method === 'POST') {
      try {
        const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
        const { entitiesIds, properties } = body;
        for (const entityId of entitiesIds) {
          for (const [key, value] of Object.entries(properties)) {
            this.setIssueProperty(entityId, key, value);
          }
        }
        return makeResponse(200, {});
      } catch {
        return makeResponse(400, { error: 'Invalid body' });
      }
    }

    // GET/PUT/DELETE /rest/api/2/issue/{issueId}/properties/{key}
    const propMatch = path.match(/^\/rest\/api\/[23]\/issue\/([^/]+)\/properties\/([^/]+)$/);
    if (propMatch) {
      const [, issueId, propertyKey] = propMatch;

      if (method === 'GET') {
        const value = this.getIssueProperty(issueId, propertyKey);
        if (value === undefined) {
          return makeResponse(404, { errorMessages: ['Property not found'] });
        }
        return makeResponse(200, { key: propertyKey, value });
      }

      if (method === 'PUT') {
        try {
          const value = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
          this.setIssueProperty(issueId, propertyKey, value);
          return makeResponse(200, {});
        } catch {
          return makeResponse(400, { error: 'Invalid body' });
        }
      }

      if (method === 'DELETE') {
        this.deleteIssueProperty(issueId, propertyKey);
        return makeResponse(204, '');
      }
    }

    // GET /rest/api/2/issue/{issueId}/properties — list all
    const listMatch = path.match(/^\/rest\/api\/[23]\/issue\/([^/]+)\/properties$/);
    if (listMatch && method === 'GET') {
      const [, issueId] = listMatch;
      const prefix = `jira:issue:${issueId}:`;
      const keys: Array<{ self: string; key: string }> = [];
      for (const [k] of this.properties) {
        if (k.startsWith(prefix)) {
          const propertyKey = k.slice(prefix.length);
          keys.push({ self: path + '/' + propertyKey, key: propertyKey });
        }
      }
      return makeResponse(200, { keys });
    }

    return null; // Not a property route
  }

  /**
   * Handle Confluence property API routes. Returns null if the route doesn't match.
   */
  handleConfluenceRoute(path: string, options?: ProductApiRequest): ProductApiResponse | null {
    const method = options?.method?.toUpperCase() ?? 'GET';

    // Content properties: /rest/api/content/{contentId}/property/{key}
    const contentPropMatch = path.match(/^\/rest\/api\/content\/([^/]+)\/property\/([^/]+)$/);
    if (contentPropMatch) {
      const [, contentId, propertyKey] = contentPropMatch;

      if (method === 'GET') {
        const value = this.getContentProperty(contentId, propertyKey);
        if (value === undefined) {
          return makeResponse(404, { message: 'Property not found' });
        }
        return makeResponse(200, { id: propertyKey, key: propertyKey, value, version: { number: 1 } });
      }

      if (method === 'PUT' || method === 'POST') {
        try {
          const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
          this.setContentProperty(contentId, propertyKey, body.value ?? body);
          return makeResponse(200, {});
        } catch {
          return makeResponse(400, { error: 'Invalid body' });
        }
      }

      if (method === 'DELETE') {
        this.deleteContentProperty(contentId, propertyKey);
        return makeResponse(204, '');
      }
    }

    // Space properties: /rest/api/space/{spaceKey}/property/{key}
    const spacePropMatch = path.match(/^\/rest\/api\/space\/([^/]+)\/property\/([^/]+)$/);
    if (spacePropMatch) {
      const [, spaceKey, propertyKey] = spacePropMatch;

      if (method === 'GET') {
        const value = this.getSpaceProperty(spaceKey, propertyKey);
        if (value === undefined) {
          return makeResponse(404, { message: 'Property not found' });
        }
        return makeResponse(200, { id: propertyKey, key: propertyKey, value, version: { number: 1 } });
      }

      if (method === 'PUT' || method === 'POST') {
        try {
          const body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body;
          this.setSpaceProperty(spaceKey, propertyKey, body.value ?? body);
          return makeResponse(200, {});
        } catch {
          return makeResponse(400, { error: 'Invalid body' });
        }
      }

      if (method === 'DELETE') {
        this.deleteSpaceProperty(spaceKey, propertyKey);
        return makeResponse(204, '');
      }
    }

    return null; // Not a property route
  }

  // ── Utility ─────────────────────────────────────────────────────────

  /** Dump all properties (for debugging/inspection). */
  dump(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.properties) {
      result[key] = value;
    }
    return result;
  }

  /** Clear all properties. */
  clear(): void {
    this.properties.clear();
  }
}
