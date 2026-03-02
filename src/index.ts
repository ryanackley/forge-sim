/**
 * forge-sim — Simulated Forge runtime for AI-driven development and testing.
 */

export { ForgeSimulator } from './simulator.js';
export { SimulatedKVS, WhereConditions, KVSQueryBuilder } from './storage.js';
export { SimulatedQueue, SimulatedQueueInstance } from './queue.js';
export { SimulatedResolver } from './resolver.js';
export { SimulatedProductApi, route } from './product-api.js';
export { parseManifest, parseManifestContent } from './manifest.js';
export { deploy } from './deployer.js';
export { setSimulator, getSimulator } from './shims/globals.js';

// UI rendering (bridge + doc utilities)
export {
  installBridge,
  connectSimulator,
  getLatestForgeDoc,
  waitForRender,
  getBridgeCalls,
  resetBridge,
  resetAll,
  findByType,
  findFirstByType,
  findByProps,
  getTextContent,
  simulateEvent,
  listComponentTypes,
  findByTypeAndText,
  prettyPrint,
  type ForgeDoc,
  type BridgeCall,
} from './ui/index.js';

export type {
  ForgeManifest,
  ManifestModule,
  ResolverRequest,
  ResolverContext,
  StorageEntry,
  StorageQueryResult,
  QueueEvent,
  QueuePushResult,
  QueueJobStats,
  ProductApiRequest,
  ProductApiResponse,
  ProductApiHandler,
  TriggerEvent,
  FunctionHandler,
  SimulationConfig,
} from './types.js';

// Dev server (live preview)
export { createDevServer, type DevServer, type DevServerOptions, type DevEvent } from './dev-server.js';

export type {
  ParsedManifest,
  ManifestFunction,
  ManifestConsumer,
  ManifestTrigger,
  ManifestScheduledTrigger,
  ManifestUIModule,
} from './manifest.js';
