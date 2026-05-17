/**
 * forge-sim — Simulated Forge runtime for AI-driven development and testing.
 */

export { ForgeSimulator, createSimulator } from './simulator.js';
export type { LoadAuthResult } from './simulator.js';
export { UnifiedKVS, WhereConditions, KVSQueryBuilder, EntityAPI, EntityQueryBuilder, TransactionBuilder } from './kvs.js';
export type { EntitySchema, IndexDefinition, EntityStoreDump, StoredEntry } from './kvs.js';
/** @deprecated Use UnifiedKVS instead */
export { UnifiedKVS as SimulatedKVS } from './kvs.js';
export { SimulatedQueue, SimulatedQueueInstance } from './queue.js';
export { SimulatedResolver } from './resolver.js';
export { SimulatedProductApi, route, mockResponse, MOCK_RESPONSE_MARKER } from './product-api.js';
export type { MockResponseTag } from './product-api.js';
export { parseManifest, parseManifestContent } from './manifest.js';
export { deploy } from './deployer.js';
export { setSimulator, getSimulator } from './shims/globals.js';
export type {
  TriggerPayloadByEvent,
  KnownTriggerEvent,
  ConfluenceTriggerPayloadByEvent,
  ConfluenceTriggerBase,
  ConfluenceContent,
  ConfluenceContentReference,
  ConfluenceSpace,
  ConfluenceUser,
  ConfluenceTask,
  ConfluenceLabel,
  ConfluenceTemplate,
  ConfluenceGroup,
  ConfluenceRelationEntityWrapper,
  JiraTriggerPayloadByEvent,
  JiraTriggerBase,
  JiraIssue,
  JiraIssueFields,
  JiraUser,
  JiraUserDetails,
  JiraProject,
  JiraComment,
  JiraChangelog,
  JiraChangelogItem,
  JiraWorklog,
  JiraVersion,
  JiraAttachment,
  JiraComponent,
  JiraFilter,
  JiraIssueTypeDefinition,
  JiraProperty,
  // App lifecycle types
  AppLifecycleTriggerPayloadByEvent,
  AppInstalledEvent,
  AppUpgradedEvent,
  ForgeAppInfo,
  ForgeEnvironmentInfo,
  ForgePermissions,
  // Jira Software types
  JiraSoftwareTriggerPayloadByEvent,
  JiraSwTriggerBase,
  JiraSwBoard,
  JiraSwBoardConfiguration,
  JiraSwSprint,
} from './trigger-event-types.js';

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
export { createWebTriggerHandler, getWebTriggerUrl, type WebTriggerConfig } from './web-trigger.js';

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
export { SimulatedLLM, LlmApiError } from './llm.js';
export type { LlmPrompt, LlmResponse, LlmStreamResponse, LlmMessage, LlmChoice, LlmTool, LlmToolCall, ModelListResponse, ModelInfo, MockLlmResponse } from './llm.js';
export { SimulatedRealtime } from './realtime.js';
export type { RealtimePayload, PublishOptions, PublishResult, SubscriptionOptions, Subscription, RealtimeCallback, TokenResult, PublishListener } from './realtime.js';
