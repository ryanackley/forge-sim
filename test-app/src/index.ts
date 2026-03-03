import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getText', (req: any) => {
  console.log('getText called with:', req.payload);
  return { text: 'Hello from the resolver! 🔥' };
});

resolver.define('getCount', (req: any) => {
  return { count: Math.floor(Math.random() * 100) };
});

export const handler = resolver.getDefinitions();
