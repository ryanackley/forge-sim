import Resolver from '@forge/resolver';

const resolver = new Resolver();

/**
 * Echoes back exactly what the resolver sees in req.context.
 *
 * The canonical Forge pattern is `context.extension.project.key` /
 * `context.extension.issue.key`. Real Forge NEVER delivers `context.project`
 * or `context.issue` at the top level — if those show up here, the sim
 * flattened extension data (the 0.1.1 eval HIGH-1 bug).
 */
resolver.define('echoContext', async (req: any) => {
  const ctx = req.context ?? {};
  return {
    ext: ctx.extension ?? null,
    accountId: ctx.accountId ?? null,
    cloudId: ctx.cloudId ?? null,
    // Parity canaries — must stay null:
    flattenedProject: ctx.project ?? null,
    flattenedIssue: ctx.issue ?? null,
  };
});

export const handler = resolver.getDefinitions();
