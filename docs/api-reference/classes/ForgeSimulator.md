[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / ForgeSimulator

# Class: ForgeSimulator

Defined in: simulator.ts:40

forge-sim — Simulated Forge runtime for AI-driven development and testing.

## Accessors

### entityStore

#### Get Signature

> **get** **entityStore**(): [`UnifiedKVS`](UnifiedKVS.md)

Defined in: simulator.ts:60

##### Deprecated

Use sim.kvs instead — entity store is now unified into UnifiedKVS.
This getter exists for backward compatibility only.

##### Returns

[`UnifiedKVS`](UnifiedKVS.md)

## Constructors

### Constructor

> **new ForgeSimulator**(`config?`): `ForgeSimulator`

Defined in: simulator.ts:87

#### Parameters

##### config?

[`SimulationConfig`](../interfaces/SimulationConfig.md)

#### Returns

`ForgeSimulator`

## Methods

### clearLogs()

> **clearLogs**(): `void`

Defined in: simulator.ts:647

#### Returns

`void`

***

### createApiClient()

> **createApiClient**(`mode?`): `object`

Defined in: simulator.ts:399

Create an API client that mirrors @forge/api's interface.

#### Parameters

##### mode?

`"asUser"` \| `"asApp"`

#### Returns

`object`

##### requestBitbucket

> **requestBitbucket**: (`path`, `options?`) => `Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

###### Parameters

###### path

`string`

###### options?

[`ProductApiRequest`](../interfaces/ProductApiRequest.md)

###### Returns

`Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

##### requestConfluence

> **requestConfluence**: (`path`, `options?`) => `Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

###### Parameters

###### path

`string`

###### options?

[`ProductApiRequest`](../interfaces/ProductApiRequest.md)

###### Returns

`Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

##### requestJira

> **requestJira**: (`path`, `options?`) => `Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

###### Parameters

###### path

`string`

###### options?

[`ProductApiRequest`](../interfaces/ProductApiRequest.md)

###### Returns

`Promise`\<[`ProductApiResponse`](../interfaces/ProductApiResponse.md)\>

***

### deploy()

> **deploy**(`appDir`): `Promise`\<`DeployResult`\>

Defined in: simulator.ts:238

Deploy a Forge app directory into this simulator.
Reads the manifest, imports handler modules, and wires everything up.

#### Parameters

##### appDir

`string`

#### Returns

`Promise`\<`DeployResult`\>

***

### fireScheduledTrigger()

> **fireScheduledTrigger**(`triggerKey`): `Promise`\<\{ `body?`: `string`; `error?`: `string`; `statusCode`: `number`; \}\>

Defined in: simulator.ts:540

Fire a scheduled trigger.

Per Forge docs, scheduled trigger handlers receive a SINGLE argument:
  { context: { cloudId, moduleKey }, contextToken }

They MUST return: { statusCode: number, body?: string, headers?: object, statusText?: string }
- statusCode 204 = success
- statusCode 5xx = error
- Missing/wrong format = 424 Failed Dependency (platform error)

#### Parameters

##### triggerKey

`string`

#### Returns

`Promise`\<\{ `body?`: `string`; `error?`: `string`; `statusCode`: `number`; \}\>

***

### fireTrigger()

#### Call Signature

> **fireTrigger**\<`K`\>(`eventName`, `data`): `Promise`\<`any`[]\>

Defined in: simulator.ts:476

Fire a product event trigger (e.g., 'avi:jira:created:issue').

Per Forge docs, trigger handlers receive TWO arguments: (event, context)
- event: event-specific payload ({ issue: {...} }, { sprint: {...} }, etc.)
- context: standard context object

Overload behavior:
- known documented trigger names get strong payload typing
- arbitrary strings still work for forward-compat and experimentation

##### Type Parameters

###### K

`K` *extends* `ConfluencePageSharedEvents` \| `ConfluenceBlogpostSharedEvents` \| `ConfluenceWhiteboardSharedEvents` \| `ConfluenceDatabaseSharedEvents` \| `ConfluenceEmbedSharedEvents` \| `ConfluenceFolderSharedEvents` \| `ConfluenceTaskSharedEvents` \| `ConfluenceCommentSharedEvents` \| `ConfluenceSpaceSharedEvents` \| `ConfluenceAttachmentSharedEvents` \| `ConfluenceCustomContentSharedEvents` \| `ConfluenceLabelSharedEvents` \| `ConfluenceUserSharedEvents` \| `ConfluenceGroupSharedEvents` \| `ConfluenceRelationSharedEvents` \| `"avi:confluence:updated:page"` \| `"avi:confluence:moved:page"` \| `"avi:confluence:copied:page"` \| `"avi:confluence:children_reordered:page"` \| `"avi:confluence:started:page"` \| `"avi:confluence:snapshotted:page"` \| `"avi:confluence:updated:blogpost"` \| `"avi:confluence:updated:task"` \| `"avi:confluence:updated:comment"` \| `"avi:confluence:updated:attachment"` \| `"avi:confluence:updated:custom_content"` \| `"avi:confluence:performed:search"` \| `"avi:jira:updated:issue"` \| `"avi:jira:commented:issue"` \| `"avi:jira:mentioned:comment"` \| `"avi:jira:deleted:comment"` \| `"avi:jira:updated:field:context:configuration"` \| `"avi:jira:failed:expression"` \| `"avi:jira:merged:version"` \| `"avi:jira:deleted:version"` \| `"avi:jira:deleted:user"` \| `"avi:jira:timetracking:provider:changed"` \| `"avi:jira:changed:configuration"` \| `JiraIssueSharedEvents` \| `JiraIssueLinkSharedEvents` \| `JiraWorklogSharedEvents` \| `JiraIssueTypeSharedEvents` \| `JiraCustomFieldSharedEvents` \| `JiraCustomFieldContextSharedEvents` \| `JiraVersionSharedEvents` \| `JiraProjectSharedEvents` \| `JiraAttachmentSharedEvents` \| `JiraComponentSharedEvents` \| `JiraUserCreatedUpdatedSharedEvents` \| `JiraFilterSharedEvents` \| `"avi:jira-software:configuration-changed:board"` \| `JiraSwBoardSharedEvents` \| `JiraSwSprintSharedEvents` \| `"avi:forge:installed:app"` \| `"avi:forge:upgraded:app"`

##### Parameters

###### eventName

`K`

###### data

[`TriggerPayloadByEvent`](../type-aliases/TriggerPayloadByEvent.md)\[`K`\]

##### Returns

`Promise`\<`any`[]\>

#### Call Signature

> **fireTrigger**(`eventName`, `data?`): `Promise`\<`any`[]\>

Defined in: simulator.ts:477

Fire a product event trigger (e.g., 'avi:jira:created:issue').

Per Forge docs, trigger handlers receive TWO arguments: (event, context)
- event: event-specific payload ({ issue: {...} }, { sprint: {...} }, etc.)
- context: standard context object

Overload behavior:
- known documented trigger names get strong payload typing
- arbitrary strings still work for forward-compat and experimentation

##### Parameters

###### eventName

`string`

###### data?

`Record`\<`string`, `unknown`\>

##### Returns

`Promise`\<`any`[]\>

***

### getAppDir()

> **getAppDir**(): `string` \| `null`

Defined in: simulator.ts:188

Get the deployed app directory.

#### Returns

`string` \| `null`

***

### getConsoleLogs()

> **getConsoleLogs**(): `ConsoleLine`[]

Defined in: simulator.ts:643

#### Returns

`ConsoleLine`[]

***

### getLogs()

> **getLogs**(): `LogEntry`[]

Defined in: simulator.ts:639

#### Returns

`LogEntry`[]

***

### getManifest()

> **getManifest**(): [`ParsedManifest`](../interfaces/ParsedManifest.md) \| `null`

Defined in: simulator.ts:177

#### Returns

[`ParsedManifest`](../interfaces/ParsedManifest.md) \| `null`

***

### getModuleRoute()

> **getModuleRoute**(`moduleKey`): \{ `endpointKey?`: `string`; `moduleType?`: `string`; `resolverFunctionKey?`: `string`; \} \| `undefined`

Defined in: simulator.ts:263

Get the module route for a given module key.

#### Parameters

##### moduleKey

`string`

#### Returns

\{ `endpointKey?`: `string`; `moduleType?`: `string`; `resolverFunctionKey?`: `string`; \} \| `undefined`

***

### getModuleType()

> **getModuleType**(`moduleKey`): `string` \| `undefined`

Defined in: simulator.ts:270

Get the module type (e.g., 'jira:issuePanel', 'confluence:globalPage') for a module key.

#### Parameters

##### moduleKey

`string`

#### Returns

`string` \| `undefined`

***

### invoke()

> **invoke**(`functionKey`, `payload?`, `moduleKey?`): `Promise`\<`any`\>

Defined in: simulator.ts:362

Invoke a resolver function, simulating the @forge/bridge invoke() call.
This uses the resolver's { payload, context } wrapping — the UI bridge pattern.

If moduleKey is provided, validates that the function key is accessible
from that module's resolver (behavioral parity with Forge).

#### Parameters

##### functionKey

`string`

##### payload?

`any`

##### moduleKey?

`string`

#### Returns

`Promise`\<`any`\>

***

### loadAuthFromEnv()

> **loadAuthFromEnv**(): `Promise`\<[`LoadAuthResult`](../interfaces/LoadAuthResult.md)\>

Defined in: simulator.ts:747

Load auth credentials from environment variables and/or .forge-sim config files.
**Must be called after deploy()** — uses the deployed app directory for .forge-sim lookups.

ENV vars take priority over .forge-sim files.

**Atlassian credentials (ENV):**
  FORGE_SIM_SITE, FORGE_SIM_EMAIL, FORGE_SIM_PAT — builds a PAT account
  FORGE_SIM_CLOUD_ID, FORGE_SIM_ACCOUNT_ID — optional overrides

**Atlassian credentials (.forge-sim fallback):**
  Loads from loadCredentials(appDir) → getDefaultAccount()

**Third-party provider tokens (ENV):**
  FORGE_SIM_PROVIDER_<KEY>_TOKEN — KEY is provider key uppercased, hyphens→underscores

**Third-party tokens (.forge-sim fallback):**
  Loads from credential store thirdParty tokens for the default account

**Provider secrets (.forge-sim only):**
  Always tries loadProviderSecrets(appDir)

#### Returns

`Promise`\<[`LoadAuthResult`](../interfaces/LoadAuthResult.md)\>

***

### loadManifest()

> **loadManifest**(`pathOrContent`): `Promise`\<[`ParsedManifest`](../interfaces/ParsedManifest.md)\>

Defined in: simulator.ts:131

#### Parameters

##### pathOrContent

`string`

#### Returns

`Promise`\<[`ParsedManifest`](../interfaces/ParsedManifest.md)\>

***

### loadManifestData()

> **loadManifestData**(`manifest`): `void`

Defined in: simulator.ts:199

#### Parameters

##### manifest

[`ParsedManifest`](../interfaces/ParsedManifest.md)

#### Returns

`void`

***

### mockGraphQL()

> **mockGraphQL**(`mocks`): `void`

Defined in: simulator.ts:429

Mock GraphQL responses by operation name.
See SimulatedProductApi.mockGraphQL for details.

#### Parameters

##### mocks

`Record`\<`string`, `any`\>

#### Returns

`void`

***

### mockProductApi()

> **mockProductApi**(`product`, `handler`): `void`

Defined in: simulator.ts:414

Mock product API with simple route definitions.

#### Parameters

##### product

`string`

##### handler

[`ProductApiHandler`](../type-aliases/ProductApiHandler.md)

#### Returns

`void`

***

### mockProductRoutes()

> **mockProductRoutes**(`product`, `routes`): `void`

Defined in: simulator.ts:418

#### Parameters

##### product

`string`

##### routes

`Record`\<`string`, `any`\>

#### Returns

`void`

***

### onLog()

> **onLog**(`listener`): () => `void`

Defined in: simulator.ts:632

Register a listener for real-time log events. Returns unsubscribe function.

#### Parameters

##### listener

(`entry`) => `void`

#### Returns

() => `void`

***

### registerConsumer()

> **registerConsumer**(`queueKey`, `handler`): `void`

Defined in: simulator.ts:438

Register a consumer handler for a queue.

#### Parameters

##### queueKey

`string`

##### handler

(`event`, `context`) => `Promise`\<`any`\>

#### Returns

`void`

***

### registerFunction()

> **registerFunction**(`key`, `handler`, `type?`): `void`

Defined in: simulator.ts:349

Register a function with its Forge type.
This is the primary way to register non-resolver functions (triggers, consumers, etc.).
Resolver-defined functions should use sim.resolver.define() instead.

#### Parameters

##### key

`string`

##### handler

(...`args`) => `any`

##### type?

`ForgeFunctionType` = `'generic'`

#### Returns

`void`

***

### registerModuleRoute()

> **registerModuleRoute**(`moduleKey`, `route`): `void`

Defined in: simulator.ts:249

Register a UI module's routing info (called by deployer).
Maps moduleKey → resolver function key or endpoint key.

#### Parameters

##### moduleKey

`string`

##### route

###### endpointKey?

`string`

###### moduleType?

`string`

###### resolverFunctionKey?

`string`

#### Returns

`void`

***

### registerResolverOwnership()

> **registerResolverOwnership**(`definedKey`, `resolverFunctionKey`): `void`

Defined in: simulator.ts:256

Register resolver ownership: a define()'d function key belongs to a manifest resolver.

#### Parameters

##### definedKey

`string`

##### resolverFunctionKey

`string`

#### Returns

`void`

***

### reset()

> **reset**(): `void`

Defined in: simulator.ts:887

#### Returns

`void`

***

### resolveModuleEndpoint()

> **resolveModuleEndpoint**(`moduleKey?`): `string` \| `undefined`

Defined in: simulator.ts:315

Validate and resolve the endpoint for a remote invoke from a module.
Returns the endpoint key. Throws if module has no endpoint.

#### Parameters

##### moduleKey?

`string`

#### Returns

`string` \| `undefined`

***

### setAppDir()

> **setAppDir**(`dir`): `void`

Defined in: simulator.ts:193

Set the app directory (called by deployer).

#### Parameters

##### dir

`string`

#### Returns

`void`

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: simulator.ts:911

Stop all background services (MySQL server, etc.).
Call this when you're done with the simulator.

#### Returns

`Promise`\<`void`\>

***

### validateActionInputs()

> **validateActionInputs**(`actionKey`, `payload`): `string`[]

Defined in: simulator.ts:686

Validate Rovo action inputs against the action's schema.
Returns an array of validation errors (empty = valid).

#### Parameters

##### actionKey

`string`

##### payload

`Record`\<`string`, `any`\>

#### Returns

`string`[]

***

### validateResolverAccess()

> **validateResolverAccess**(`functionKey`, `moduleKey?`): `void`

Defined in: simulator.ts:279

Validate that a function key is reachable from a module.
If moduleKey is provided, checks that the function key belongs to that module's resolver.
Returns the function key if valid, throws if not.

#### Parameters

##### functionKey

`string`

##### moduleKey?

`string`

#### Returns

`void`

## Properties

### currentModuleKey

> **currentModuleKey**: `string` \| `undefined`

Defined in: simulator.ts:79

The currently active module key (set by dev-command when rendering a module).
Used by server-side shims that don't have URL context.

***

### externalAuth

> `readonly` **externalAuth**: [`ExternalAuthStore`](ExternalAuthStore.md)

Defined in: simulator.ts:49

***

### fit

> `readonly` **fit**: `FITProvider`

Defined in: simulator.ts:50

***

### functions

> `readonly` **functions**: `FunctionRegistry`

Defined in: simulator.ts:46

***

### i18n

> `readonly` **i18n**: [`I18nStore`](I18nStore.md)

Defined in: simulator.ts:48

***

### kvs

> `readonly` **kvs**: [`UnifiedKVS`](UnifiedKVS.md)

Defined in: simulator.ts:41

***

### productApi

> `readonly` **productApi**: [`SimulatedProductApi`](SimulatedProductApi.md)

Defined in: simulator.ts:44

***

### properties

> `readonly` **properties**: `PropertyStore`

Defined in: simulator.ts:47

***

### queue

> `readonly` **queue**: [`SimulatedQueue`](SimulatedQueue.md)

Defined in: simulator.ts:42

***

### remotes

> `readonly` **remotes**: `RemoteProxy`

Defined in: simulator.ts:51

***

### resolver

> `readonly` **resolver**: [`SimulatedResolver`](SimulatedResolver.md)

Defined in: simulator.ts:43

***

### sql

> `readonly` **sql**: `SimulatedForgeSQL`

Defined in: simulator.ts:45

***

### ui

> `readonly` **ui**: [`SimulatorUI`](SimulatorUI.md)

Defined in: simulator.ts:54

UI API — ForgeDoc access, tree traversal, interaction, bridge lifecycle.
