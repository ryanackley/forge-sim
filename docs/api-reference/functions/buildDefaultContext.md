[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / buildDefaultContext

# Function: buildDefaultContext()

> **buildDefaultContext**(`moduleKey`, `moduleType?`, `account?`, `extraExtension?`): [`ForgeContext`](../interfaces/ForgeContext.md)

Defined in: context.ts:368

Build a minimal context from whatever we have.
Used when no render options are provided — returns defaults.

## Parameters

### moduleKey

`string`

### moduleType?

`string`

### account?

\{ `accountId`: `string`; `cloudId`: `string`; `site`: `string`; \} \| `null`

### extraExtension?

`Record`\<`string`, `any`\>

## Returns

[`ForgeContext`](../interfaces/ForgeContext.md)
