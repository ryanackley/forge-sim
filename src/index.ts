/**
 * forge-sim — Simulated Forge runtime for AI-driven development and testing.
 */

export { ForgeSimulator } from './simulator.js';
export { UnifiedKVS, WhereConditions, KVSQueryBuilder, EntityAPI, EntityQueryBuilder, TransactionBuilder } from './kvs.js';
export type { EntitySchema, IndexDefinition, EntityStoreDump, StoredEntry } from './kvs.js';
/** @deprecated Use UnifiedKVS instead */
export { UnifiedKVS as SimulatedKVS } from './kvs.js';
export { SimulatedQueue, SimulatedQueueInstance } from './queue.js';
export { SimulatedResolver } from './resolver.js';
export { SimulatedProductApi, route } from './product-api.js';
export { parseManifest, parseManifestContent } from './manifest.js';
export { deploy } from './deployer.js';
export { setSimulator, getSimulator } from './shims/globals.js';

// UI rendering (SimulatorUI is the primary API — access via sim.ui.*)
export { SimulatorUI } from './ui/index.js';
export type { ForgeDoc, BridgeCall } from './ui/index.js';
export { buildForgeContext, buildDefaultContext } from './context.js';
export type { ForgeContext, RenderContextOptions } from './context.js';

// Backward-compat UI exports (deprecated — prefer sim.ui.*)
export {
  installBridge,
  connectSimulator,
  getLatestForgeDoc,
  waitForRender,
  getBridgeCalls,
  resetBridge,
  resetAll,
  onRender,
  findByType,
  findFirstByType,
  findByProps,
  getTextContent,
  simulateEvent,
  listComponentTypes,
  findByTypeAndText,
  prettyPrint,
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

export { I18nStore } from './i18n-store.js';
export { ExternalAuthStore, loadProviderSecrets, saveProviderSecrets } from './external-auth-store.js';
export type { I18nInfoConfig, TranslationResource, GetTranslationsResult } from './i18n-store.js';
