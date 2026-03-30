[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / DevServerOptions

# Interface: DevServerOptions

Defined in: dev-server.ts:23

## Properties

### context?

> `optional` **context?**: `Record`\<`string`, `any`\>

Defined in: dev-server.ts:35

Simulated Forge context returned by getContext

***

### debounceMs?

> `optional` **debounceMs?**: `number`

Defined in: dev-server.ts:29

Debounce interval for file changes in ms (default: 300)

***

### onFileChange?

> `optional` **onFileChange?**: (`changedFile`) => `Promise`\<[`ForgeDoc`](ForgeDoc.md) \| `null`\>

Defined in: dev-server.ts:31

Called when a file change is detected — should re-deploy and return new ForgeDoc

#### Parameters

##### changedFile

`string`

#### Returns

`Promise`\<[`ForgeDoc`](ForgeDoc.md) \| `null`\>

***

### port?

> `optional` **port?**: `number`

Defined in: dev-server.ts:25

WebSocket port (default: 5174)

***

### simulator?

> `optional` **simulator?**: [`ForgeSimulator`](../classes/ForgeSimulator.md)

Defined in: dev-server.ts:33

ForgeSimulator instance — required for browser mode RPC (invoke, fetchProduct, etc.)

***

### watchDir?

> `optional` **watchDir?**: `string`

Defined in: dev-server.ts:27

App source directory to watch for changes
