[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / SimulatedQueue

# Class: SimulatedQueue

Defined in: queue.ts:77

## Constructors

### Constructor

> **new SimulatedQueue**(`config?`): `SimulatedQueue`

Defined in: queue.ts:84

#### Parameters

##### config?

`QueueConfig`

#### Returns

`SimulatedQueue`

## Methods

### cancelJob()

> **cancelJob**(`jobId`): `void`

Defined in: queue.ts:235

#### Parameters

##### jobId

`string`

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: queue.ts:262

#### Returns

`void`

***

### createQueue()

> **createQueue**(`options`): [`SimulatedQueueInstance`](SimulatedQueueInstance.md)

Defined in: queue.ts:104

Create a Queue instance (mirrors @forge/events Queue constructor).

#### Parameters

##### options

###### key

`string`

#### Returns

[`SimulatedQueueInstance`](SimulatedQueueInstance.md)

***

### getEventLog()

> **getEventLog**(): `object`[]

Defined in: queue.ts:241

Get all events processed for inspection

#### Returns

`object`[]

***

### getJob()

> **getJob**(`jobId`): `QueueJob` \| `undefined`

Defined in: queue.ts:231

#### Parameters

##### jobId

`string`

#### Returns

`QueueJob` \| `undefined`

***

### getStats()

> **getStats**(): `Record`\<`string`, \{ `consumers`: `number`; `events`: `number`; `jobs`: `number`; \}\>

Defined in: queue.ts:246

Get stats for all queues.

#### Returns

`Record`\<`string`, \{ `consumers`: `number`; `events`: `number`; `jobs`: `number`; \}\>

***

### push()

> **push**(`queueKey`, `events`): `Promise`\<[`QueuePushResult`](../interfaces/QueuePushResult.md)\>

Defined in: queue.ts:111

Push events to a queue and process them.

#### Parameters

##### queueKey

`string`

##### events

[`QueueEvent`](../interfaces/QueueEvent.md) \| [`QueueEvent`](../interfaces/QueueEvent.md)[]

#### Returns

`Promise`\<[`QueuePushResult`](../interfaces/QueuePushResult.md)\>

***

### registerConsumer()

> **registerConsumer**(`queueKey`, `handler`): `void`

Defined in: queue.ts:97

Register a consumer function for a queue key.
In real Forge, this is defined via manifest consumer module.

#### Parameters

##### queueKey

`string`

##### handler

[`FunctionHandler`](../type-aliases/FunctionHandler.md)

#### Returns

`void`

***

### setMode()

> **setMode**(`mode`): `void`

Defined in: queue.ts:89

Change queue processing mode at runtime.

#### Parameters

##### mode

`"sequential"` \| `"concurrent"`

#### Returns

`void`
