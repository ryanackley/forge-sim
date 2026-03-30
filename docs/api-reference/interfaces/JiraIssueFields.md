[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / JiraIssueFields

# Interface: JiraIssueFields

Defined in: trigger-event-types.ts:452

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### assignee?

> `optional` **assignee?**: [`JiraUser`](JiraUser.md) \| `null`

Defined in: trigger-event-types.ts:455

***

### comment?

> `optional` **comment?**: `object`

Defined in: trigger-event-types.ts:464

#### comments

> **comments**: [`JiraComment`](JiraComment.md)[]

#### maxResults?

> `optional` **maxResults?**: `number`

#### total

> **total**: `number`

***

### created?

> `optional` **created?**: `string`

Defined in: trigger-event-types.ts:460

***

### description?

> `optional` **description?**: `unknown`

Defined in: trigger-event-types.ts:462

***

### issuetype?

> `optional` **issuetype?**: `JiraIssueTypeRef`

Defined in: trigger-event-types.ts:458

***

### labels?

> `optional` **labels?**: `string`[]

Defined in: trigger-event-types.ts:463

***

### priority?

> `optional` **priority?**: `JiraIssuePriority`

Defined in: trigger-event-types.ts:457

***

### project?

> `optional` **project?**: [`JiraProject`](JiraProject.md)

Defined in: trigger-event-types.ts:459

***

### reporter?

> `optional` **reporter?**: [`JiraUser`](JiraUser.md) \| `null`

Defined in: trigger-event-types.ts:456

***

### status?

> `optional` **status?**: `JiraIssueStatus`

Defined in: trigger-event-types.ts:454

***

### summary?

> `optional` **summary?**: `string`

Defined in: trigger-event-types.ts:453

***

### updated?

> `optional` **updated?**: `string`

Defined in: trigger-event-types.ts:461
