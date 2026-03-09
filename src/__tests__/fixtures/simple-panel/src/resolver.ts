import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getData', async (req: any) => {
  return {
    message: `Hello from ${req.context?.issueKey ?? 'unknown'}`,
  };
});

export const handler = resolver.getDefinitions();
