[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / buildForgeContext

# Function: buildForgeContext()

> **buildForgeContext**(`sim`, `moduleKey`, `moduleType`, `options?`): `Promise`\<[`ForgeContext`](../interfaces/ForgeContext.md)\>

Defined in: context.ts:115

Build a full ForgeContext for a given module.

Resolution order for extension data:
  1. Explicit `extension` override (used as-is)
  2. Item key shortcuts (`issueKey`, `contentId`) — hydrated via product API
  3. Raw `context` object — spread into extension
  4. Defaults based on module type

## Parameters

### sim

[`ForgeSimulator`](../classes/ForgeSimulator.md)

### moduleKey

`string`

### moduleType

`string`

### options?

[`RenderContextOptions`](../interfaces/RenderContextOptions.md) = `{}`

## Returns

`Promise`\<[`ForgeContext`](../interfaces/ForgeContext.md)\>
