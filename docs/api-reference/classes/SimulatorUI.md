[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / SimulatorUI

# Class: SimulatorUI

Defined in: ui/simulator-ui.ts:48

## Constructors

### Constructor

> **new SimulatorUI**(`sim`): `SimulatorUI`

Defined in: ui/simulator-ui.ts:69

#### Parameters

##### sim

[`ForgeSimulator`](ForgeSimulator.md)

#### Returns

`SimulatorUI`

## Methods

### ensureBridge()

> **ensureBridge**(): `void`

Defined in: ui/simulator-ui.ts:78

Install the bridge and connect this simulator.
Called automatically by deploy() — you don't need to call this manually
unless you're setting up the bridge before deploying.

#### Returns

`void`

***

### findByProps()

> **findByProps**(`doc`, `props`): [`ForgeDoc`](../interfaces/ForgeDoc.md)[]

Defined in: ui/simulator-ui.ts:401

Find nodes whose props match all given key/value pairs.

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

##### props

`Record`\<`string`, `any`\>

#### Returns

[`ForgeDoc`](../interfaces/ForgeDoc.md)[]

***

### findByType()

> **findByType**(`doc`, `type`): [`ForgeDoc`](../interfaces/ForgeDoc.md)[]

Defined in: ui/simulator-ui.ts:391

Find all nodes matching a component type.

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

##### type

`string`

#### Returns

[`ForgeDoc`](../interfaces/ForgeDoc.md)[]

***

### findByTypeAndText()

> **findByTypeAndText**(`doc`, `type`, `matchText?`, `nthMatch?`): [`ForgeDoc`](../interfaces/ForgeDoc.md)

Defined in: ui/simulator-ui.ts:409

Find a component by type and optional text content.
Throws if no match found (for clear test assertion errors).

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

##### type

`string`

##### matchText?

`string`

##### nthMatch?

`number`

#### Returns

[`ForgeDoc`](../interfaces/ForgeDoc.md)

***

### findFirstByType()

> **findFirstByType**(`doc`, `type`): [`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`

Defined in: ui/simulator-ui.ts:396

Find the first node matching a component type, or null.

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

##### type

`string`

#### Returns

[`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`

***

### getBridgeCalls()

> **getBridgeCalls**(): [`BridgeCall`](../interfaces/BridgeCall.md)[]

Defined in: ui/simulator-ui.ts:224

Get all bridge calls made so far (for debugging/assertions).

#### Returns

[`BridgeCall`](../interfaces/BridgeCall.md)[]

***

### getContext()

> **getContext**(`moduleKey?`): [`ForgeContext`](../interfaces/ForgeContext.md) \| `null`

Defined in: ui/simulator-ui.ts:136

Get the Forge context for a module (what useProductContext() returns).
Returns null if the module hasn't been rendered.

#### Parameters

##### moduleKey?

`string`

#### Returns

[`ForgeContext`](../interfaces/ForgeContext.md) \| `null`

***

### getForgeDoc()

> **getForgeDoc**(`moduleKey?`): [`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`

Defined in: ui/simulator-ui.ts:119

Get the ForgeDoc for a specific module, or the most recently rendered doc.

#### Parameters

##### moduleKey?

`string`

— UI module key from manifest (e.g. 'issue-panel').
  If omitted, returns the most recently rendered ForgeDoc (any module).

#### Returns

[`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`

***

### getRenderedModules()

> **getRenderedModules**(): `string`[]

Defined in: ui/simulator-ui.ts:128

Get all rendered module keys.

#### Returns

`string`[]

***

### getTextContent()

> **getTextContent**(`doc`): `string`

Defined in: ui/simulator-ui.ts:414

Extract all text content from a subtree.

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

#### Returns

`string`

***

### interact()

> **interact**(`node`, `eventName`, ...`args`): `any`

Defined in: ui/simulator-ui.ts:434

Simulate an event on a ForgeDoc node.
Returns the handler's return value (may be a Promise for async handlers).

#### Parameters

##### node

[`ForgeDoc`](../interfaces/ForgeDoc.md)

##### eventName

`string`

##### args

...`any`[]

#### Returns

`any`

***

### interactWith()

> **interactWith**(`componentType`, `options?`): `Promise`\<\{ `result`: `any`; `updatedDoc`: [`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`; \}\>

Defined in: ui/simulator-ui.ts:442

High-level: find a component and interact with it in one call.
Returns { result, updatedDoc } after the interaction.

#### Parameters

##### componentType

`string`

##### options?

###### args?

`any`[]

###### event?

`string`

###### matchText?

`string`

###### nthMatch?

`number`

#### Returns

`Promise`\<\{ `result`: `any`; `updatedDoc`: [`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`; \}\>

***

### listComponentTypes()

> **listComponentTypes**(`doc`): `string`[]

Defined in: ui/simulator-ui.ts:419

List all unique component types in a tree.

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

#### Returns

`string`[]

***

### onModuleRender()

> **onModuleRender**(`moduleKey`, `listener`): () => `void`

Defined in: ui/simulator-ui.ts:161

Register a listener scoped to a specific module.
Returns an unbind function.

#### Parameters

##### moduleKey

`string`

##### listener

(`doc`) => `void`

#### Returns

() => `void`

***

### onRender()

> **onRender**(`listener`): () => `void`

Defined in: ui/simulator-ui.ts:153

Register a persistent listener that fires on every render (any module).
Returns an unbind function.

#### Parameters

##### listener

(`doc`) => `void`

#### Returns

() => `void`

***

### prettyPrint()

> **prettyPrint**(`doc`): `string`

Defined in: ui/simulator-ui.ts:424

Pretty-print a ForgeDoc tree (for debugging/logging).

#### Parameters

##### doc

[`ForgeDoc`](../interfaces/ForgeDoc.md)

#### Returns

`string`

***

### refresh()

> **refresh**(`moduleKey?`): `Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`\>

Defined in: ui/simulator-ui.ts:369

Refresh a UI module — clears its ForgeDoc and re-renders.
Like a tab refresh in the browser: unmount + remount from scratch.

If no module key given and only one module is rendered, refreshes that one.

#### Parameters

##### moduleKey?

`string`

#### Returns

`Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`\>

***

### render()

> **render**(`moduleKey`, `options?`): `Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`\>

Defined in: ui/simulator-ui.ts:251

Render a UI module by its manifest key.

Loads the module's frontend resource (the file that calls
ForgeReconciler.render()), which triggers React reconciliation
and produces a ForgeDoc. The frontend's invoke() calls are routed
to the module's resolver via the bridge.

  // Full context object
  await sim.ui.render('my-panel', {
    context: { issueKey: 'PROJ-1', projectKey: 'PROJ' }
  });

  // Item key shortcut — hydrates full context via product API
  await sim.ui.render('my-panel', { issueKey: 'PROJ-42' });

  // Confluence content
  await sim.ui.render('my-macro', { contentId: '12345' });

  const doc = sim.ui.getForgeDoc('my-panel');

#### Parameters

##### moduleKey

`string`

##### options?

[`RenderContextOptions`](../interfaces/RenderContextOptions.md)

#### Returns

`Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md) \| `null`\>

***

### reset()

> **reset**(): `void`

Defined in: ui/simulator-ui.ts:465

Reset UI state (ForgeDoc, bridge calls, module docs). Does NOT disconnect simulator.

#### Returns

`void`

***

### resetAll()

> **resetAll**(): `void`

Defined in: ui/simulator-ui.ts:474

Full reset — disconnects simulator too.

#### Returns

`void`

***

### waitForContent()

> **waitForContent**(`moduleKey`, `text`, `timeoutMs?`): `Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md)\>

Defined in: ui/simulator-ui.ts:182

Wait until a module's ForgeDoc contains the expected text.
Useful for async frontends that show "Loading..." then fetch data.

  await sim.ui.render('issue-panel', { context: { issueKey: 'PROJ-1' } });
  const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-1');

#### Parameters

##### moduleKey

`string`

##### text

`string`

##### timeoutMs?

`number` = `5000`

#### Returns

`Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md)\>

***

### waitForRender()

> **waitForRender**(): `Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md)\>

Defined in: ui/simulator-ui.ts:145

Wait for the next render (reconcile) from any module. Returns the new ForgeDoc.

#### Returns

`Promise`\<[`ForgeDoc`](../interfaces/ForgeDoc.md)\>
