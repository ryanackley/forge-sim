[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / SimulatedResolver

# Class: SimulatedResolver

Defined in: resolver.ts:19

## Constructors

### Constructor

> **new SimulatedResolver**(): `SimulatedResolver`

#### Returns

`SimulatedResolver`

## Methods

### clear()

> **clear**(): `void`

Defined in: resolver.ts:101

#### Returns

`void`

***

### define()

> **define**(`functionKey`, `handler`): `void`

Defined in: resolver.ts:26

Define a resolver function (mirrors Resolver.define()).

#### Parameters

##### functionKey

`string`

##### handler

`ResolverHandler`

#### Returns

`void`

***

### getAvailableKeys()

> **getAvailableKeys**(): `string`[]

Defined in: resolver.ts:83

Alias for getDefinitions() — returns all registered resolver keys.

#### Returns

`string`[]

***

### getContextOverrides()

> **getContextOverrides**(): `Partial`\<[`ResolverContext`](../interfaces/ResolverContext.md)\>

Defined in: resolver.ts:90

Get the current context overrides.

#### Returns

`Partial`\<[`ResolverContext`](../interfaces/ResolverContext.md)\>

***

### getDefinitions()

> **getDefinitions**(): `string`[]

Defined in: resolver.ts:71

Get all defined function keys.

#### Returns

`string`[]

***

### getHandler()

> **getHandler**(`functionKey`): `ResolverHandler` \| `undefined`

Defined in: resolver.ts:78

Get a single handler by key (for direct invocation outside resolver pattern).

#### Parameters

##### functionKey

`string`

#### Returns

`ResolverHandler` \| `undefined`

***

### getHandlerMap()

> **getHandlerMap**(): `Map`\<`string`, `ResolverHandler`\>

Defined in: resolver.ts:97

Get the handler map (for wiring into the bridge mock).

#### Returns

`Map`\<`string`, `ResolverHandler`\>

***

### invoke()

> **invoke**(`functionKey`, `payload?`): `Promise`\<`any`\>

Defined in: resolver.ts:46

Invoke a resolver function by key (mirrors bridge invoke call).

#### Parameters

##### functionKey

`string`

##### payload?

`any`

#### Returns

`Promise`\<`any`\>

***

### setContext()

> **setContext**(`overrides`): `void`

Defined in: resolver.ts:39

Set context overrides for all invocations.

#### Parameters

##### overrides

`Partial`\<[`ResolverContext`](../interfaces/ResolverContext.md)\>

#### Returns

`void`
