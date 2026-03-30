[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / RenderContextOptions

# Interface: RenderContextOptions

Defined in: context.ts:43

## Properties

### contentId?

> `optional` **contentId?**: `string`

Defined in: context.ts:51

Confluence content ID — fetches content data to build context

***

### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

Defined in: context.ts:45

Raw context fields — merged into extension

***

### extension?

> `optional` **extension?**: `Record`\<`string`, `any`\>

Defined in: context.ts:55

Override the full extension object

***

### issueKey?

> `optional` **issueKey?**: `string`

Defined in: context.ts:47

Jira issue key — fetches issue data to build context

***

### projectKey?

> `optional` **projectKey?**: `string`

Defined in: context.ts:49

Jira project key — fetches project data to build context

***

### spaceKey?

> `optional` **spaceKey?**: `string`

Defined in: context.ts:53

Confluence space key — fetches space data to build context
