[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / EntityAPI

# Class: EntityAPI

Defined in: kvs.ts:902

## Constructors

### Constructor

> **new EntityAPI**(`entityName`, `kvs`): `EntityAPI`

Defined in: kvs.ts:903

#### Parameters

##### entityName

`string`

##### kvs

[`UnifiedKVS`](UnifiedKVS.md)

#### Returns

`EntityAPI`

## Methods

### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: kvs.ts:916

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`key`): `Promise`\<`any`\>

Defined in: kvs.ts:908

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`any`\>

***

### query()

> **query**(): [`EntityQueryBuilder`](EntityQueryBuilder.md)

Defined in: kvs.ts:920

#### Returns

[`EntityQueryBuilder`](EntityQueryBuilder.md)

***

### set()

> **set**(`key`, `value`): `Promise`\<`void`\>

Defined in: kvs.ts:912

#### Parameters

##### key

`string`

##### value

`any`

#### Returns

`Promise`\<`void`\>
