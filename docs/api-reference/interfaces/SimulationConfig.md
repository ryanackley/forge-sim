[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / SimulationConfig

# Interface: SimulationConfig

Defined in: types.ts:176

## Properties

### context?

> `optional` **context?**: `Partial`\<[`ResolverContext`](ResolverContext.md)\>

Defined in: types.ts:178

Mock context values

***

### forgeSQL?

> `optional` **forgeSQL?**: `object`

Defined in: types.ts:197

Forge SQL options (ephemeral MySQL backend)

#### dbName?

> `optional` **dbName?**: `string`

Database name (default: 'forge_app')

#### logLevel?

> `optional` **logLevel?**: `"LOG"` \| `"WARN"` \| `"ERROR"`

Log level (default: 'ERROR')

#### mysqlVersion?

> `optional` **mysqlVersion?**: `string`

MySQL version (default: '8.4.x')

***

### initialStorage?

> `optional` **initialStorage?**: `Record`\<`string`, `any`\>

Defined in: types.ts:180

Pre-seed storage with data

***

### productApis?

> `optional` **productApis?**: `object`

Defined in: types.ts:182

Product API mock handlers

#### bitbucket?

> `optional` **bitbucket?**: [`ProductApiHandler`](../type-aliases/ProductApiHandler.md)

#### confluence?

> `optional` **confluence?**: [`ProductApiHandler`](../type-aliases/ProductApiHandler.md)

#### jira?

> `optional` **jira?**: [`ProductApiHandler`](../type-aliases/ProductApiHandler.md)

***

### queueMode?

> `optional` **queueMode?**: `"sequential"` \| `"concurrent"`

Defined in: types.ts:188

Queue processing mode: 'sequential' (default) or 'concurrent'

***

### storageLatency?

> `optional` **storageLatency?**: `number` \| `boolean`

Defined in: types.ts:195

Simulate async latency on KVS operations to expose race conditions.
- false (default): instant
- true: yield to event loop
- number: random delay up to this many ms
