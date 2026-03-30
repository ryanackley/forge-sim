[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / createWebTriggerHandler

# Function: createWebTriggerHandler()

> **createWebTriggerHandler**(`config`): (`req`, `res`, `pathname`) => `Promise`\<`boolean`\>

Defined in: web-trigger.ts:92

Create an HTTP request handler for web triggers.

Returns a function that handles requests to /__trigger/<key>.
Returns true if the request was handled, false otherwise.

## Parameters

### config

[`WebTriggerConfig`](../interfaces/WebTriggerConfig.md)

## Returns

(`req`, `res`, `pathname`) => `Promise`\<`boolean`\>
