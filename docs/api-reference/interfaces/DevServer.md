[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / DevServer

# Interface: DevServer

Defined in: dev-server.ts:38

## Accessors

### clientCount

#### Get Signature

> **get** **clientCount**(): `number`

Defined in: dev-server.ts:44

Number of connected renderer clients

##### Returns

`number`

## Methods

### broadcast()

> **broadcast**(`doc`, `moduleKey?`): `void`

Defined in: dev-server.ts:40

Broadcast a ForgeDoc update to all connected renderers

#### Parameters

##### doc

[`ForgeDoc`](ForgeDoc.md)

##### moduleKey?

`string`

#### Returns

`void`

***

### close()

> **close**(): `void`

Defined in: dev-server.ts:46

Shut down the server

#### Returns

`void`

***

### sendEvent()

> **sendEvent**(`event`): `void`

Defined in: dev-server.ts:42

Send an event to all connected renderers

#### Parameters

##### event

`ServerEvent`

#### Returns

`void`
