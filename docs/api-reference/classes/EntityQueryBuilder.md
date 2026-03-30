[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / EntityQueryBuilder

# Class: EntityQueryBuilder

Defined in: kvs.ts:927

## Constructors

### Constructor

> **new EntityQueryBuilder**(`entityName`, `entities`, `schemas`): `EntityQueryBuilder`

Defined in: kvs.ts:936

#### Parameters

##### entityName

`string`

##### entities

`Map`\<`string`, [`StoredEntry`](../interfaces/StoredEntry.md)\>

##### schemas

`Map`\<`string`, [`EntitySchema`](../interfaces/EntitySchema.md)\>

#### Returns

`EntityQueryBuilder`

## Methods

### cursor()

> **cursor**(`c`): `this`

Defined in: kvs.ts:965

#### Parameters

##### c

`string`

#### Returns

`this`

***

### filters()

> **filters**(`filter`): `this`

Defined in: kvs.ts:953

#### Parameters

##### filter

###### filters

###### operator

#### Returns

`this`

***

### getMany()

> **getMany**(): `Promise`\<\{ `nextCursor?`: `string`; `results`: `object`[]; \}\>

Defined in: kvs.ts:975

#### Returns

`Promise`\<\{ `nextCursor?`: `string`; `results`: `object`[]; \}\>

***

### getOne()

> **getOne**(): `Promise`\<\{ `key`: `string`; `value`: `any`; \} \| `undefined`\>

Defined in: kvs.ts:1044

#### Returns

`Promise`\<\{ `key`: `string`; `value`: `any`; \} \| `undefined`\>

***

### index()

> **index**(`name`, `options?`): `this`

Defined in: kvs.ts:942

#### Parameters

##### name

`string`

##### options?

###### partition?

`unknown`[]

#### Returns

`this`

***

### limit()

> **limit**(`n`): `this`

Defined in: kvs.ts:970

#### Parameters

##### n

`number`

#### Returns

`this`

***

### sort()

> **sort**(`direction`): `this`

Defined in: kvs.ts:960

#### Parameters

##### direction

`"ASC"` \| `"DESC"`

#### Returns

`this`

***

### where()

> **where**(`condition`): `this`

Defined in: kvs.ts:948

#### Parameters

##### condition

###### condition

`string`

###### values

`any`[]

#### Returns

`this`
