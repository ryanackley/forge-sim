/**
 * Entity Store tests — both direct API and E2E through real @forge/kvs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

describe('SimulatedEntityStore', () => {
  let sim: ForgeSimulator;

  beforeAll(() => {
    sim = createSimulator();

    // Register entity schemas (normally comes from manifest)
    sim.entityStore.registerEntitySchema('Employee', {
      attributes: {
        name: { type: 'string' },
        department: { type: 'string' },
        salary: { type: 'number' },
        startDate: { type: 'string' },
      },
      indexes: [
        { name: 'by-department', partition: ['department'], range: 'salary' },
        { name: 'by-name', partition: [], range: 'name' },
        { name: 'by-date', partition: ['department'], range: 'startDate' },
      ],
    });
  });

  beforeEach(() => {
    sim.entityStore.clear();
  });

  describe('Direct API', () => {
    it('should set and get entities', async () => {
      const res1 = await sim.entityStore.handleRequest('/api/v1/entity/set', {
        method: 'POST',
        body: JSON.stringify({ entityName: 'Employee', key: 'emp-1', value: { name: 'Alice', department: 'Eng', salary: 120000 } }),
      });
      expect(res1.ok).toBe(true);

      const res2 = await sim.entityStore.handleRequest('/api/v1/entity/get', {
        method: 'POST',
        body: JSON.stringify({ entityName: 'Employee', key: 'emp-1' }),
      });
      expect(res2.ok).toBe(true);
      const data = await res2.json();
      expect(data.value.name).toBe('Alice');
      expect(data.key).toBe('emp-1');
      expect(data.createdAt).toBeDefined();
    });

    it('should return KEY_NOT_FOUND for missing entities', async () => {
      const res = await sim.entityStore.handleRequest('/api/v1/entity/get', {
        method: 'POST',
        body: JSON.stringify({ entityName: 'Employee', key: 'nonexistent' }),
      });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe('KEY_NOT_FOUND');
    });

    it('should delete entities', async () => {
      await sim.entityStore.handleRequest('/api/v1/entity/set', {
        method: 'POST',
        body: JSON.stringify({ entityName: 'Employee', key: 'emp-del', value: { name: 'Temp' } }),
      });

      const delRes = await sim.entityStore.handleRequest('/api/v1/entity/delete', {
        method: 'POST',
        body: JSON.stringify({ entityName: 'Employee', key: 'emp-del' }),
      });
      expect(delRes.ok).toBe(true);

      const getRes = await sim.entityStore.handleRequest('/api/v1/entity/get', {
        method: 'POST',
        body: JSON.stringify({ entityName: 'Employee', key: 'emp-del' }),
      });
      expect(getRes.status).toBe(404);
    });

    it('should query entities with partition + range', async () => {
      // Seed data
      const employees = [
        { key: 'e1', value: { name: 'Alice', department: 'Eng', salary: 120000, startDate: '2023-01-15' } },
        { key: 'e2', value: { name: 'Bob', department: 'Eng', salary: 90000, startDate: '2023-06-01' } },
        { key: 'e3', value: { name: 'Carol', department: 'Sales', salary: 110000, startDate: '2022-11-01' } },
        { key: 'e4', value: { name: 'Dave', department: 'Eng', salary: 150000, startDate: '2021-03-20' } },
      ];
      for (const emp of employees) {
        await sim.entityStore.handleRequest('/api/v1/entity/set', {
          method: 'POST',
          body: JSON.stringify({ entityName: 'Employee', ...emp }),
        });
      }

      // Query: Eng department, salary > 100000
      const res = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          range: { condition: 'GREATER_THAN', values: [100000] },
          sort: 'ASC',
        }),
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.data).toHaveLength(2); // Alice (120k) and Dave (150k)
      expect(data.data[0].value.name).toBe('Alice'); // sorted ASC by salary
      expect(data.data[1].value.name).toBe('Dave');
    });

    it('should query with filters (AND)', async () => {
      const employees = [
        { key: 'e1', value: { name: 'Alice', department: 'Eng', salary: 120000 } },
        { key: 'e2', value: { name: 'Bob', department: 'Eng', salary: 90000 } },
        { key: 'e3', value: { name: 'Carol', department: 'Eng', salary: 130000 } },
      ];
      for (const emp of employees) {
        await sim.entityStore.handleRequest('/api/v1/entity/set', {
          method: 'POST',
          body: JSON.stringify({ entityName: 'Employee', ...emp }),
        });
      }

      // All Eng, salary >= 100k AND name begins with 'A'
      const res = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          filters: {
            and: [
              { property: 'salary', condition: 'GREATER_THAN_EQUAL_TO', values: [100000] },
              { property: 'name', condition: 'BEGINS_WITH', values: ['A'] },
            ],
          },
        }),
      });
      const data = await res.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].value.name).toBe('Alice');
    });

    it('should query with filters (OR)', async () => {
      const employees = [
        { key: 'e1', value: { name: 'Alice', department: 'Eng', salary: 120000 } },
        { key: 'e2', value: { name: 'Bob', department: 'Eng', salary: 90000 } },
        { key: 'e3', value: { name: 'Carol', department: 'Eng', salary: 130000 } },
      ];
      for (const emp of employees) {
        await sim.entityStore.handleRequest('/api/v1/entity/set', {
          method: 'POST',
          body: JSON.stringify({ entityName: 'Employee', ...emp }),
        });
      }

      // All Eng, name = 'Bob' OR salary > 125k
      const res = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          filters: {
            or: [
              { property: 'name', condition: 'EQUAL_TO', values: ['Bob'] },
              { property: 'salary', condition: 'GREATER_THAN', values: [125000] },
            ],
          },
        }),
      });
      const data = await res.json();
      expect(data.data).toHaveLength(2); // Bob and Carol
    });

    it('should support DESC sort', async () => {
      const employees = [
        { key: 'e1', value: { name: 'Alice', department: 'Eng', salary: 120000 } },
        { key: 'e2', value: { name: 'Bob', department: 'Eng', salary: 90000 } },
        { key: 'e3', value: { name: 'Carol', department: 'Eng', salary: 150000 } },
      ];
      for (const emp of employees) {
        await sim.entityStore.handleRequest('/api/v1/entity/set', {
          method: 'POST',
          body: JSON.stringify({ entityName: 'Employee', ...emp }),
        });
      }

      const res = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          sort: 'DESC',
        }),
      });
      const data = await res.json();
      expect(data.data[0].value.salary).toBe(150000);
      expect(data.data[2].value.salary).toBe(90000);
    });

    it('should support pagination with cursor and limit', async () => {
      for (let i = 1; i <= 5; i++) {
        await sim.entityStore.handleRequest('/api/v1/entity/set', {
          method: 'POST',
          body: JSON.stringify({
            entityName: 'Employee',
            key: `e${i}`,
            value: { name: `Emp${i}`, department: 'Eng', salary: i * 10000 },
          }),
        });
      }

      // First page
      const res1 = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          sort: 'ASC',
          limit: 2,
        }),
      });
      const data1 = await res1.json();
      expect(data1.data).toHaveLength(2);
      expect(data1.cursor).toBeDefined();

      // Second page
      const res2 = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          sort: 'ASC',
          limit: 2,
          cursor: data1.cursor,
        }),
      });
      const data2 = await res2.json();
      expect(data2.data).toHaveLength(2);
    });

    it('should support BETWEEN range condition', async () => {
      const employees = [
        { key: 'e1', value: { name: 'Alice', department: 'Eng', salary: 80000 } },
        { key: 'e2', value: { name: 'Bob', department: 'Eng', salary: 100000 } },
        { key: 'e3', value: { name: 'Carol', department: 'Eng', salary: 120000 } },
        { key: 'e4', value: { name: 'Dave', department: 'Eng', salary: 150000 } },
      ];
      for (const emp of employees) {
        await sim.entityStore.handleRequest('/api/v1/entity/set', {
          method: 'POST',
          body: JSON.stringify({ entityName: 'Employee', ...emp }),
        });
      }

      const res = await sim.entityStore.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'Employee',
          indexName: 'by-department',
          partition: ['Eng'],
          range: { condition: 'BETWEEN', values: [90000, 130000] },
        }),
      });
      const data = await res.json();
      expect(data.data).toHaveLength(2); // Bob (100k) and Carol (120k)
    });
  });

  describe('Plain KVS via entity store backend', () => {
    it('should handle plain get/set/delete', async () => {
      await sim.entityStore.handleRequest('/api/v1/set', {
        method: 'POST',
        body: JSON.stringify({ key: 'test-key', value: { hello: 'world' } }),
      });

      const res = await sim.entityStore.handleRequest('/api/v1/get', {
        method: 'POST',
        body: JSON.stringify({ key: 'test-key' }),
      });
      const data = await res.json();
      expect(data.value).toEqual({ hello: 'world' });
    });

    it('should handle plain query with beginsWith', async () => {
      await sim.entityStore.handleRequest('/api/v1/set', {
        method: 'POST', body: JSON.stringify({ key: 'user:1', value: 'Alice' }),
      });
      await sim.entityStore.handleRequest('/api/v1/set', {
        method: 'POST', body: JSON.stringify({ key: 'user:2', value: 'Bob' }),
      });
      await sim.entityStore.handleRequest('/api/v1/set', {
        method: 'POST', body: JSON.stringify({ key: 'post:1', value: 'Hello' }),
      });

      const res = await sim.entityStore.handleRequest('/api/v1/query', {
        method: 'POST',
        body: JSON.stringify({ where: [{ property: 'key', condition: 'BEGINS_WITH', values: ['user:'] }] }),
      });
      const data = await res.json();
      expect(data.data).toHaveLength(2);
    });

    it('should handle batch set', async () => {
      const res = await sim.entityStore.handleRequest('/api/v1/batch/set', {
        method: 'POST',
        body: JSON.stringify([
          { key: 'b1', value: 'one' },
          { key: 'b2', value: 'two' },
          { key: 'b3', value: 'three', entityName: 'Employee' },
        ]),
      });
      const data = await res.json();
      expect(data.successfulKeys).toHaveLength(3);

      // Verify plain KVS
      const r1 = await sim.entityStore.handleRequest('/api/v1/get', {
        method: 'POST', body: JSON.stringify({ key: 'b1' }),
      });
      expect((await r1.json()).value).toBe('one');

      // Verify entity
      const r2 = await sim.entityStore.handleRequest('/api/v1/entity/get', {
        method: 'POST', body: JSON.stringify({ entityName: 'Employee', key: 'b3' }),
      });
      expect((await r2.json()).value).toBe('three');
    });

    it('should support FAIL_IF_EXISTS key policy', async () => {
      await sim.entityStore.handleRequest('/api/v1/set', {
        method: 'POST',
        body: JSON.stringify({ key: 'unique', value: 'first' }),
      });

      const res = await sim.entityStore.handleRequest('/api/v1/set', {
        method: 'POST',
        body: JSON.stringify({ key: 'unique', value: 'second', options: { keyPolicy: 'FAIL_IF_EXISTS' } }),
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('KEY_ALREADY_EXISTS');
    });
  });
});
