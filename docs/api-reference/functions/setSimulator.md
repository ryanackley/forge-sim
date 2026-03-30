[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / setSimulator

# ~~Function: setSimulator()~~

> **setSimulator**(`sim`): `void`

Defined in: shims/globals.ts:22

Set the active simulator instance.

## Parameters

### sim

[`ForgeSimulator`](../classes/ForgeSimulator.md)

## Returns

`void`

## Deprecated

Since v0.x — the ForgeSimulator constructor now calls this automatically.
You no longer need to call setSimulator() manually. It remains available for
backward compatibility and advanced use cases (e.g., swapping simulator instances).

Also installs global.__forge_fetch__ so that the real @forge/api CJS package
(used internally by @forge/sql and others) routes through our simulator.
