[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / UnifiedKVS

# Class: UnifiedKVS

Defined in: kvs.ts:66

## Accessors

### entitySize

#### Get Signature

> **get** **entitySize**(): `number`

Defined in: kvs.ts:793

##### Returns

`number`

***

### kvsSize

#### Get Signature

> **get** **kvsSize**(): `number`

Defined in: kvs.ts:792

##### Returns

`number`

***

### secretSize

#### Get Signature

> **get** **secretSize**(): `number`

Defined in: kvs.ts:794

##### Returns

`number`

***

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: kvs.ts:788

##### Returns

`number`

## Constructors

### Constructor

> **new UnifiedKVS**(): `UnifiedKVS`

#### Returns

`UnifiedKVS`

## Methods

### clear()

> **clear**(): `void`

Defined in: kvs.ts:797

Clear runtime data (preserves schemas)

#### Returns

`void`

***

### clearAll()

> **clearAll**(): `void`

Defined in: kvs.ts:804

Full clear including schemas

#### Returns

`void`

***

### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: kvs.ts:116

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### deleteMany()

> **deleteMany**(`keys`): `Promise`\<`void`\>

Defined in: kvs.ts:167

#### Parameters

##### keys

`string`[]

#### Returns

`Promise`\<`void`\>

***

### deleteSecret()

> **deleteSecret**(`key`): `Promise`\<`void`\>

Defined in: kvs.ts:138

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### dump()

> **dump**(): `Record`\<`string`, `any`\>

Defined in: kvs.ts:720

Dump plain KVS as raw values (backward compat with SimulatedKVS.dump())

#### Returns

`Record`\<`string`, `any`\>

***

### dumpAll()

> **dumpAll**(): [`EntityStoreDump`](../interfaces/EntityStoreDump.md)

Defined in: kvs.ts:760

Dump full state for persistence (KVS + entities + secrets)

#### Returns

[`EntityStoreDump`](../interfaces/EntityStoreDump.md)

***

### dumpEntities()

> **dumpEntities**(): `Record`\<`string`, `object`[]\>

Defined in: kvs.ts:749

Get all entity entries grouped by entity name

#### Returns

`Record`\<`string`, `object`[]\>

***

### dumpKvs()

> **dumpKvs**(): `Record`\<`string`, `any`\>

Defined in: kvs.ts:742

Get all plain KVS entries as raw values

#### Returns

`Record`\<`string`, `any`\>

***

### entity()

> **entity**(`entityName`): [`EntityAPI`](EntityAPI.md)

Defined in: kvs.ts:179

Get an entity API scoped to a specific entity name.
Mirrors real @forge/kvs: kvs.entity('MyEntity').get/set/delete/query()

#### Parameters

##### entityName

`string`

#### Returns

[`EntityAPI`](EntityAPI.md)

***

### get()

> **get**(`key`): `Promise`\<`any`\>

Defined in: kvs.ts:95

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`any`\>

***

### getEntitySchemas()

> **getEntitySchemas**(): `Map`\<`string`, [`EntitySchema`](../interfaces/EntitySchema.md)\>

Defined in: kvs.ts:707

#### Returns

`Map`\<`string`, [`EntitySchema`](../interfaces/EntitySchema.md)\>

***

### getMany()

> **getMany**(`keys`): `Promise`\<`Map`\<`string`, `any`\>\>

Defined in: kvs.ts:150

#### Parameters

##### keys

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, `any`\>\>

***

### getSecret()

> **getSecret**(`key`): `Promise`\<`any`\>

Defined in: kvs.ts:123

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`any`\>

***

### handleRequest()

> **handleRequest**(`path`, `options?`): `Promise`\<`FetchLikeResponse`\>

Defined in: kvs.ts:255

#### Parameters

##### path

`string`

##### options?

###### body?

`string`

###### headers?

`Record`\<`string`, `string`\>

###### method?

`string`

#### Returns

`Promise`\<`FetchLikeResponse`\>

***

### query()

> **query**(): [`KVSQueryBuilder`](KVSQueryBuilder.md)

Defined in: kvs.ts:144

#### Returns

[`KVSQueryBuilder`](KVSQueryBuilder.md)

***

### registerEntitySchema()

> **registerEntitySchema**(`entityName`, `schema`): `void`

Defined in: kvs.ts:703

#### Parameters

##### entityName

`string`

##### schema

[`EntitySchema`](../interfaces/EntitySchema.md)

#### Returns

`void`

***

### restore()

> **restore**(`data`): `void`

Defined in: kvs.ts:729

Restore plain KVS from raw values dump (backward compat)

#### Parameters

##### data

`Record`\<`string`, `any`\>

#### Returns

`void`

***

### restoreAll()

> **restoreAll**(`dump`): `void`

Defined in: kvs.ts:769

Restore full state from a persistence dump

#### Parameters

##### dump

[`EntityStoreDump`](../interfaces/EntityStoreDump.md)

#### Returns

`void`

***

### set()

> **set**(`key`, `value`): `Promise`\<`void`\>

Defined in: kvs.ts:100

#### Parameters

##### key

`string`

##### value

`any`

#### Returns

`Promise`\<`void`\>

***

### setLatency()

> **setLatency**(`latency`): `void`

Defined in: kvs.ts:79

#### Parameters

##### latency

`number` \| `boolean`

#### Returns

`void`

***

### setMany()

> **setMany**(`entries`): `Promise`\<`void`\>

Defined in: kvs.ts:161

#### Parameters

##### entries

`object`[]

#### Returns

`Promise`\<`void`\>

***

### setSecret()

> **setSecret**(`key`, `value`): `Promise`\<`void`\>

Defined in: kvs.ts:127

#### Parameters

##### key

`string`

##### value

`any`

#### Returns

`Promise`\<`void`\>

***

### transact()

> **transact**(): [`TransactionBuilder`](TransactionBuilder.md)

Defined in: kvs.ts:190

Start a transaction builder for batched writes/deletes.
Mirrors real @forge/kvs: kvs.transact().set(k,v).delete(k).execute()
NOTE: This is batched write/delete only. No atomic read-then-write.

#### Returns

[`TransactionBuilder`](TransactionBuilder.md)
