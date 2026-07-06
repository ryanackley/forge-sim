/**
 * Resolver for the docs sample app. The behavior here is dictated by the
 * examples in docs/testing/README.md — `createItem` returns { success, id },
 * `getItem` returns the stored item's fields (or { error: 'Not found' }).
 * If you change this contract, the doc examples (and the sync tests guarding
 * them) must change with it.
 */
import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

let nextId = 1;

resolver.define('createItem', async (req: any) => {
  const id = `item-${nextId++}`;
  await storage.set(`item:${id}`, { id, ...req.payload });
  return { success: true, id };
});

resolver.define('getItem', async (req: any) => {
  const item = await storage.get(`item:${req.payload.id}`);
  if (!item) return { error: 'Not found' };
  return item;
});

resolver.define('getItems', async () => {
  const page = await storage.query().getMany();
  return { items: page.results.map((r: any) => r.value) };
});

export const handler = resolver.getDefinitions();
