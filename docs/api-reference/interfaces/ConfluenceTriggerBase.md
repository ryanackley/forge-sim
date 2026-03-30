[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / ConfluenceTriggerBase

# Interface: ConfluenceTriggerBase\<TEvent\>

Defined in: trigger-event-types.ts:11

Strong TypeScript payload types for programmatic trigger invocation.

These types are canonical for forge-sim's public programmatic API.
UI/MCP samples can be looser, but `sim.fireTrigger()` should provide
event-name autocomplete and payload-type checking for documented events.

First cut: Confluence product events only.

## Type Parameters

### TEvent

`TEvent` *extends* `string`

## Properties

### atlassianId?

> `optional` **atlassianId?**: `string`

Defined in: trigger-event-types.ts:14

***

### eventCreatedDate

> **eventCreatedDate**: `string`

Defined in: trigger-event-types.ts:13

***

### eventType

> **eventType**: `TEvent`

Defined in: trigger-event-types.ts:12

***

### suppressNotifications?

> `optional` **suppressNotifications?**: `boolean`

Defined in: trigger-event-types.ts:15
