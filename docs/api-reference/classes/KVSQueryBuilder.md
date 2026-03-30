[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / KVSQueryBuilder

# Class: KVSQueryBuilder

Defined in: kvs.ts:812

## Constructors

### Constructor

> **new KVSQueryBuilder**(`store`): `KVSQueryBuilder`

Defined in: kvs.ts:822

#### Parameters

##### store

`Map`\<`string`, [`StoredEntry`](../interfaces/StoredEntry.md)\>

#### Returns

`KVSQueryBuilder`

## Methods

### cursor()

> **cursor**(`c`): `this`

Defined in: kvs.ts:841

#### Parameters

##### c

`string`

#### Returns

`this`

***

### getMany()

> **getMany**(): `Promise`\<[`StorageQueryResult`](../interfaces/StorageQueryResult.md)\>

Defined in: kvs.ts:851

#### Returns

`Promise`\<[`StorageQueryResult`](../interfaces/StorageQueryResult.md)\>

***

### getOne()

> **getOne**(): `Promise`\<[`StorageEntry`](../interfaces/StorageEntry.md) \| `undefined`\>

Defined in: kvs.ts:886

#### Returns

`Promise`\<[`StorageEntry`](../interfaces/StorageEntry.md) \| `undefined`\>

***

### limit()

> **limit**(`n`): `this`

Defined in: kvs.ts:836

#### Parameters

##### n

`number`

#### Returns

`this`

***

### sort()

> **sort**(`direction`): `this`

Defined in: kvs.ts:846

#### Parameters

##### direction

`"ASC"` \| `"DESC"`

#### Returns

`this`

***

### where()

> **where**(`field`, `condition`): `this`

Defined in: kvs.ts:824

#### Parameters

##### field

`"key"`

##### condition

\{ `beginsWith`: `string`; \} \| \{ `equalsTo`: `string`; \}

#### Returns

`this`
