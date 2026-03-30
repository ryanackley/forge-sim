[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / AppUpgradedEvent

# Interface: AppUpgradedEvent

Defined in: trigger-event-types.ts:962

Payload for `avi:forge:upgraded:app`.

NOTE: Only sent for major version upgrades; minor/patch upgrades do not trigger this event.
Like the installed event, no `eventType` field is present in the payload.

## Properties

### app

> **app**: [`ForgeAppInfo`](ForgeAppInfo.md)

Defined in: trigger-event-types.ts:965

***

### environment?

> `optional` **environment?**: [`ForgeEnvironmentInfo`](ForgeEnvironmentInfo.md)

Defined in: trigger-event-types.ts:966

***

### id

> **id**: `string`

Defined in: trigger-event-types.ts:963

***

### permissions?

> `optional` **permissions?**: [`ForgePermissions`](ForgePermissions.md)

Defined in: trigger-event-types.ts:967

***

### upgraderAccountId?

> `optional` **upgraderAccountId?**: `string`

Defined in: trigger-event-types.ts:964
