[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / deploy

# Function: deploy()

> **deploy**(`sim`, `appDir`): `Promise`\<`DeployResult`\>

Defined in: deployer.ts:110

Deploy a Forge app directory into a simulator instance.

1. Reads manifest.yml from appDir
2. For each function in the manifest, resolves the handler file and imports it
3. Wires up resolvers, consumers, and triggers on the simulator

## Parameters

### sim

[`ForgeSimulator`](../classes/ForgeSimulator.md)

### appDir

`string`

## Returns

`Promise`\<`DeployResult`\>
