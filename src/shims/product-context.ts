/**
 * `ProductContext` enums, exactly as shipped in
 * `@forge/bridge/out/realtime/productContext.d.ts`. Exported from both the
 * `@forge/bridge` shim (the real package re-exports `./realtime` from its
 * index) and the `@forge/bridge/realtime` subpath shim (the import path the
 * Forge docs use: `import { Jira } from '@forge/bridge/realtime'`).
 *
 * Not itself a shim entry; lives in this directory so both shims can share it
 * without a circular import.
 */

export enum Jira {
  Board = 'board',
  Issue = 'issue',
  Project = 'project',
}

export enum Confluence {
  Content = 'content',
  Space = 'space',
}

export enum Bitbucket {
  Repository = 'repository',
  PullRequest = 'pullRequest',
}

export type ProductContext = Jira | Confluence | Bitbucket;
