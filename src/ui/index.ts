/**
 * UI module — bridge + doc utilities for rendering and interacting with Forge UIKit apps.
 */

export {
  installBridge,
  connectSimulator,
  getLatestForgeDoc,
  waitForRender,
  getBridgeCalls,
  resetBridge,
  resetAll,
  type ForgeDoc,
  type BridgeCall,
} from './bridge.js';

export {
  findByType,
  findFirstByType,
  findByProps,
  getTextContent,
  simulateEvent,
  listComponentTypes,
  findByTypeAndText,
  prettyPrint,
} from './doc-utils.js';
