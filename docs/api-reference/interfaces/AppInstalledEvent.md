[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / AppInstalledEvent

# Interface: AppInstalledEvent

Defined in: trigger-event-types.ts:949

Payload for `avi:forge:installed:app`.

NOTE: Unlike Jira/Confluence events, lifecycle event payloads do NOT include
an `eventType` field. The event name is only available via the function signature.

## Properties

### app

> **app**: [`ForgeAppInfo`](ForgeAppInfo.md)

Defined in: trigger-event-types.ts:952

***

### environment?

> `optional` **environment?**: [`ForgeEnvironmentInfo`](ForgeEnvironmentInfo.md)

Defined in: trigger-event-types.ts:953

***

### id

> **id**: `string`

Defined in: trigger-event-types.ts:950

***

### installerAccountId?

> `optional` **installerAccountId?**: `string`

Defined in: trigger-event-types.ts:951
