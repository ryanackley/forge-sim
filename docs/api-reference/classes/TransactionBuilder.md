[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / TransactionBuilder

# Class: TransactionBuilder

Defined in: kvs.ts:1059

## Constructors

### Constructor

> **new TransactionBuilder**(`kvs`): `TransactionBuilder`

Defined in: kvs.ts:1062

#### Parameters

##### kvs

[`UnifiedKVS`](UnifiedKVS.md)

#### Returns

`TransactionBuilder`

## Methods

### check()

> **check**(`key`, `entity`): `this`

Defined in: kvs.ts:1074

#### Parameters

##### key

`string`

##### entity

###### entityName

`string`

#### Returns

`this`

***

### delete()

> **delete**(`key`, `entity?`): `this`

Defined in: kvs.ts:1069

#### Parameters

##### key

`string`

##### entity?

###### entityName

`string`

#### Returns

`this`

***

### execute()

> **execute**(): `Promise`\<`void`\>

Defined in: kvs.ts:1079

#### Returns

`Promise`\<`void`\>

***

### set()

> **set**(`key`, `value`, `entity?`): `this`

Defined in: kvs.ts:1064

#### Parameters

##### key

`string`

##### value

`any`

##### entity?

###### entityName

`string`

#### Returns

`this`
