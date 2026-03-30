[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / SimulatedProductApi

# Class: SimulatedProductApi

Defined in: product-api.ts:64

## Accessors

### connectedAccount

#### Get Signature

> **get** **connectedAccount**(): `AtlassianAccount` \| `null`

Defined in: product-api.ts:124

##### Returns

`AtlassianAccount` \| `null`

***

### isRealMode

#### Get Signature

> **get** **isRealMode**(): `boolean`

Defined in: product-api.ts:120

##### Returns

`boolean`

## Constructors

### Constructor

> **new SimulatedProductApi**(): `SimulatedProductApi`

Defined in: product-api.ts:72

#### Returns

`SimulatedProductApi`

## Methods

### clear()

> **clear**(): `void`

Defined in: product-api.ts:399

#### Returns

`void`

***

### connectRealApis()

> **connectRealApis**(`account`, `options?`): `void`

Defined in: product-api.ts:91

Connect to real Atlassian APIs using an OAuth account.
Mock routes still take priority — real API is the fallback.

#### Parameters

##### account

`AtlassianAccount`

##### options?

###### onTokenRefresh?

(`account`) => `void`

#### Returns

`void`

***

### disconnectRealApis()

> **disconnectRealApis**(): `void`

Defined in: product-api.ts:110

Disconnect from real APIs, revert to mocks.

#### Returns

`void`

***

### mock()

> **mock**(`product`, `handler`): `void`

Defined in: product-api.ts:225

Register a mock handler for a product API.

#### Parameters

##### product

`string`

##### handler

[`ProductApiHandler`](../type-aliases/ProductApiHandler.md)

#### Returns

`void`

***

### mockGraphQL()

> **mockGraphQL**(`mocks`): `void`

Defined in: product-api.ts:315

Register mock handlers for GraphQL operations, keyed by operation name.

Values can be:
- A static object (returned as-is as the response body)
- A function (query, variables) => response body

Use '*' as a catch-all for anonymous queries or unmatched operations.

Example:
  sim.productApi.mockGraphQL({
    'GetIssue': { data: { issue: { key: 'TEST-1' } } },
    'SearchUsers': (query, variables) => ({ data: { users: [] } }),
    '*': { errors: [{ message: 'Unknown operation' }] },
  });

#### Parameters

##### mocks

`Record`\<`string`, `GraphQLHandler` \| `any`\>

#### Returns

`void`

***

### mockRoutes()

> **mockRoutes**(`product`, `routes`): `void`

Defined in: product-api.ts:236

Register a simple route-based mock.

Route keys are "METHOD /path" tuples (e.g. "GET /rest/api/3/issue/TEST-1").
Method defaults to GET if omitted (just "/rest/api/3/issue/TEST-1").
Path matching is prefix-based so "/rest/api/3/issue" matches "/rest/api/3/issue/TEST-1".

#### Parameters

##### product

`string`

##### routes

`Record`\<`string`, `any` \| ((`path`, `options?`) => `any`)\>

#### Returns

`void`

***

### registerPropertyStore()

> **registerPropertyStore**(`store`): `void`

Defined in: product-api.ts:83

Register a PropertyStore for handling issue/content/space property routes.
Property routes are checked before mock routes and real API.

#### Parameters

##### store

`PropertyStore`

#### Returns

`void`

***

### request()

> **request**(`product`, `path`, `options?`): `Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

Defined in: product-api.ts:272

Make a request (called by the simulated @forge/api module).

#### Parameters

##### product

`string`

##### path

`string`

##### options?

[`ProductApiRequest`](../interfaces/ProductApiRequest.md)

#### Returns

`Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

***

### requestGraph()

> **requestGraph**(`query`, `variables?`, `headers?`): `Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

Defined in: product-api.ts:325

Execute a GraphQL request. Checks mocks first (by operation name),
then falls back to the real Atlassian Gateway if connected.

#### Parameters

##### query

`string`

##### variables?

`Record`\<`string`, `any`\>

##### headers?

`Record`\<`string`, `string`\>

#### Returns

`Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>
