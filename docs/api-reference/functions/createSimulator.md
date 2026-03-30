[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / createSimulator

# Function: createSimulator()

> **createSimulator**(`config?`): [`ForgeSimulator`](../classes/ForgeSimulator.md)

Defined in: simulator.ts:940

Create (or replace) the global simulator singleton.
This is the preferred way to initialize forge-sim.

## Parameters

### config?

[`SimulationConfig`](../interfaces/SimulationConfig.md)

Optional simulation configuration

## Returns

[`ForgeSimulator`](../classes/ForgeSimulator.md)

The new ForgeSimulator instance (also accessible via getSimulator())
