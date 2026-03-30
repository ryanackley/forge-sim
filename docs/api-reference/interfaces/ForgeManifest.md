[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / ForgeManifest

# Interface: ForgeManifest

Defined in: types.ts:7

Core types for the Forge simulation environment.

## Properties

### app

> **app**: `object`

Defined in: types.ts:8

#### id?

> `optional` **id?**: `string`

#### name?

> `optional` **name?**: `string`

#### runtime?

> `optional` **runtime?**: `object`

##### runtime.architecture?

> `optional` **architecture?**: `string`

##### runtime.memoryMB?

> `optional` **memoryMB?**: `number`

##### runtime.name?

> `optional` **name?**: `string`

***

### modules

> **modules**: `Record`\<`string`, [`ManifestModule`](ManifestModule.md)[]\>

Defined in: types.ts:17

***

### permissions?

> `optional` **permissions?**: `object`

Defined in: types.ts:18

#### external?

> `optional` **external?**: `object`

##### external.fetch?

> `optional` **fetch?**: `object`

##### external.fetch.backend?

> `optional` **backend?**: `string`[]

#### scopes?

> `optional` **scopes?**: `string`[]

***

### providers?

> `optional` **providers?**: `object`

Defined in: types.ts:23

#### auth?

> `optional` **auth?**: `ManifestAuthProvider`[]

***

### remotes?

> `optional` **remotes?**: `ManifestRemote`[]

Defined in: types.ts:22
