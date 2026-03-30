[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / JiraSwTriggerBase

# Interface: JiraSwTriggerBase\<TEvent\>

Defined in: trigger-event-types.ts:987

Common base for Jira Software event payloads.
Docs: https://developer.atlassian.com/platform/forge/events-reference/jira-software/

NOTE: A separate JSM (Jira Service Management) events page was listed in the task
as https://developer.atlassian.com/platform/forge/events-reference/jira-service-management/
but that URL returns 404. The Jira Software events page covers boards and sprints,
which are the documented product-specific events closest to the requested JSM scope.

## Type Parameters

### TEvent

`TEvent` *extends* `string`

## Properties

### atlassianId?

> `optional` **atlassianId?**: `string`

Defined in: trigger-event-types.ts:989

***

### eventType

> **eventType**: `TEvent`

Defined in: trigger-event-types.ts:988
