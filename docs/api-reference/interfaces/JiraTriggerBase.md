[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / JiraTriggerBase

# Interface: JiraTriggerBase\<TEvent\>

Defined in: trigger-event-types.ts:368

Common base for all Jira event payloads.
Note: unlike Confluence, Jira uses `timestamp` (epoch ms as string) rather
than `eventCreatedDate`, and `webhookTrace` is an optional correlation field.
`atlassianId` is NOT always present; individual event types declare it where documented.

## Type Parameters

### TEvent

`TEvent` *extends* `string`

## Properties

### eventType

> **eventType**: `TEvent`

Defined in: trigger-event-types.ts:369

***

### timestamp

> **timestamp**: `string`

Defined in: trigger-event-types.ts:370

***

### webhookTrace?

> `optional` **webhookTrace?**: `string`

Defined in: trigger-event-types.ts:371
