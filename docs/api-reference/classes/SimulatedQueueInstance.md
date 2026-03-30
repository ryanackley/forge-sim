[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / SimulatedQueueInstance

# Class: SimulatedQueueInstance

Defined in: queue.ts:273

Mirrors the @forge/events Queue class interface.

## Constructors

### Constructor

> **new SimulatedQueueInstance**(`queueKey`, `system`): `SimulatedQueueInstance`

Defined in: queue.ts:274

#### Parameters

##### queueKey

`string`

##### system

[`SimulatedQueue`](SimulatedQueue.md)

#### Returns

`SimulatedQueueInstance`

## Methods

### getJob()

> **getJob**(`jobId`): `object`

Defined in: queue.ts:283

#### Parameters

##### jobId

`string`

#### Returns

`object`

##### cancel

> **cancel**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### getStats

> **getStats**: () => `Promise`\<\{ `failed`: `number`; `inProgress`: `number`; `success`: `number`; \}\>

###### Returns

`Promise`\<\{ `failed`: `number`; `inProgress`: `number`; `success`: `number`; \}\>

***

### push()

> **push**(`events`): `Promise`\<[`QueuePushResult`](../interfaces/QueuePushResult.md)\>

Defined in: queue.ts:279

#### Parameters

##### events

[`QueueEvent`](../interfaces/QueueEvent.md) \| [`QueueEvent`](../interfaces/QueueEvent.md)[]

#### Returns

`Promise`\<[`QueuePushResult`](../interfaces/QueuePushResult.md)\>
