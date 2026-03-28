/**
 * Tests for the property store and the bridge → product API pipeline
 * that powers useIssueProperty, useContentProperty, useSpaceProperty hooks.
 *
 * These test the property store directly and the bridge shim's product request routing.
 * Full hook integration (with React) is tested separately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ForgeSimulator } from '../index.js';

describe('PropertyStore', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
  });

  describe('Jira Issue Properties', () => {
    it('set and get a property', () => {
      sim.properties.setIssueProperty('10001', 'viewCount', 42);
      expect(sim.properties.getIssueProperty('10001', 'viewCount')).toBe(42);
    });

    it('delete a property', () => {
      sim.properties.setIssueProperty('10001', 'viewCount', 42);
      sim.properties.deleteIssueProperty('10001', 'viewCount');
      expect(sim.properties.getIssueProperty('10001', 'viewCount')).toBeUndefined();
    });

    it('handles complex values', () => {
      const data = { views: 5, lastViewed: '2026-03-09', tags: ['bug', 'ui'] };
      sim.properties.setIssueProperty('10001', 'metadata', data);
      expect(sim.properties.getIssueProperty('10001', 'metadata')).toEqual(data);
    });

    it('properties are scoped per issue', () => {
      sim.properties.setIssueProperty('10001', 'views', 1);
      sim.properties.setIssueProperty('10002', 'views', 2);
      expect(sim.properties.getIssueProperty('10001', 'views')).toBe(1);
      expect(sim.properties.getIssueProperty('10002', 'views')).toBe(2);
    });
  });

  describe('Confluence Content Properties', () => {
    it('set and get a content property', () => {
      sim.properties.setContentProperty('12345', 'approval-status', { approved: true });
      expect(sim.properties.getContentProperty('12345', 'approval-status')).toEqual({ approved: true });
    });

    it('delete a content property', () => {
      sim.properties.setContentProperty('12345', 'data', 'hello');
      sim.properties.deleteContentProperty('12345', 'data');
      expect(sim.properties.getContentProperty('12345', 'data')).toBeUndefined();
    });
  });

  describe('Confluence Space Properties', () => {
    it('set and get a space property', () => {
      sim.properties.setSpaceProperty('MYSPACE', 'theme', { color: 'blue' });
      expect(sim.properties.getSpaceProperty('MYSPACE', 'theme')).toEqual({ color: 'blue' });
    });
  });

  describe('dump and clear', () => {
    it('dumps all properties', () => {
      sim.properties.setIssueProperty('10001', 'views', 5);
      sim.properties.setContentProperty('12345', 'status', 'draft');
      const dump = sim.properties.dump();
      expect(dump['jira:issue:10001:views']).toBe(5);
      expect(dump['confluence:content:12345:status']).toBe('draft');
    });

    it('clears all properties', () => {
      sim.properties.setIssueProperty('10001', 'views', 5);
      sim.properties.clear();
      expect(sim.properties.getIssueProperty('10001', 'views')).toBeUndefined();
    });
  });
});

describe('Property Store via Product API', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
  });

  describe('Jira Issue Property REST API', () => {
    it('GET returns 404 when property does not exist', async () => {
      const res = await sim.productApi.request('jira', '/rest/api/2/issue/10001/properties/viewCount');
      expect(res.status).toBe(404);
    });

    it('PUT creates a property, GET reads it back', async () => {
      const putRes = await sim.productApi.request('jira', '/rest/api/2/issue/10001/properties/viewCount', {
        method: 'PUT',
        body: JSON.stringify(42),
      });
      expect(putRes.ok).toBe(true);

      const getRes = await sim.productApi.request('jira', '/rest/api/2/issue/10001/properties/viewCount');
      expect(getRes.ok).toBe(true);
      const data = await getRes.json();
      expect(data.key).toBe('viewCount');
      expect(data.value).toBe(42);
    });

    it('DELETE removes a property', async () => {
      sim.properties.setIssueProperty('10001', 'viewCount', 42);
      const res = await sim.productApi.request('jira', '/rest/api/2/issue/10001/properties/viewCount', {
        method: 'DELETE',
      });
      expect(res.status).toBe(204);

      const getRes = await sim.productApi.request('jira', '/rest/api/2/issue/10001/properties/viewCount');
      expect(getRes.status).toBe(404);
    });

    it('POST bulk set creates multiple properties', async () => {
      const res = await sim.productApi.request('jira', '/rest/api/2/issue/properties', {
        method: 'POST',
        body: JSON.stringify({
          entitiesIds: ['10001'],
          properties: {
            'forge-viewCount': 0,
            'forge-lastViewed': '2026-03-09',
          },
        }),
      });
      expect(res.ok).toBe(true);

      expect(sim.properties.getIssueProperty('10001', 'forge-viewCount')).toBe(0);
      expect(sim.properties.getIssueProperty('10001', 'forge-lastViewed')).toBe('2026-03-09');
    });

    it('works with v3 API path', async () => {
      await sim.productApi.request('jira', '/rest/api/3/issue/10001/properties/test', {
        method: 'PUT',
        body: JSON.stringify('hello'),
      });
      const res = await sim.productApi.request('jira', '/rest/api/3/issue/10001/properties/test');
      const data = await res.json();
      expect(data.value).toBe('hello');
    });

    it('GET list returns all property keys for an issue', async () => {
      sim.properties.setIssueProperty('10001', 'views', 5);
      sim.properties.setIssueProperty('10001', 'status', 'read');
      sim.properties.setIssueProperty('10002', 'views', 1); // different issue

      const res = await sim.productApi.request('jira', '/rest/api/2/issue/10001/properties');
      const data = await res.json();
      expect(data.keys).toHaveLength(2);
      expect(data.keys.map((k: any) => k.key).sort()).toEqual(['status', 'views']);
    });
  });

  describe('Confluence Content Property REST API', () => {
    it('GET/PUT round-trip for content property', async () => {
      await sim.productApi.request('confluence', '/rest/api/content/12345/property/approval', {
        method: 'PUT',
        body: JSON.stringify({ value: { approved: true, reviewer: 'user-1' } }),
      });

      const res = await sim.productApi.request('confluence', '/rest/api/content/12345/property/approval');
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.value).toEqual({ approved: true, reviewer: 'user-1' });
    });
  });

  describe('Confluence Space Property REST API', () => {
    it('GET/PUT round-trip for space property', async () => {
      await sim.productApi.request('confluence', '/rest/api/space/MYSPACE/property/theme', {
        method: 'PUT',
        body: JSON.stringify({ value: { color: 'dark' } }),
      });

      const res = await sim.productApi.request('confluence', '/rest/api/space/MYSPACE/property/theme');
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.value).toEqual({ color: 'dark' });
    });
  });
});
