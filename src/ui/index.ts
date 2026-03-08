/**
 * UI module — bridge + doc utilities for rendering and interacting with Forge UIKit apps.
 *
 * Prefer sim.ui.* for all UI operations. These direct exports are kept for
 * backward compatibility but are considered internal/deprecated.
 */

// Primary export: the SimulatorUI class
export { SimulatorUI } from './simulator-ui.js';

// Types (always needed)
export type { ForgeDoc, BridgeCall } from './bridge.js';

// ── Backward-compat exports (prefer sim.ui.* instead) ───────────────────

/** @deprecated Use sim.ui.ensureBridge() instead */
export { installBridge } from './bridge.js';
/** @deprecated Use sim.ui.ensureBridge() instead */
export { connectSimulator } from './bridge.js';
/** @deprecated Use sim.ui.getForgeDoc() instead */
export { getLatestForgeDoc } from './bridge.js';
/** @deprecated Use sim.ui.waitForRender() instead */
export { waitForRender } from './bridge.js';
/** @deprecated Use sim.ui.getBridgeCalls() instead */
export { getBridgeCalls } from './bridge.js';
/** @deprecated Use sim.ui.reset() instead */
export { resetBridge } from './bridge.js';
/** @deprecated Use sim.ui.resetAll() instead */
export { resetAll } from './bridge.js';
/** @deprecated Use sim.ui.onRender() instead */
export { onRender } from './bridge.js';

/** @deprecated Use sim.ui.findByType() instead */
export { findByType } from './doc-utils.js';
/** @deprecated Use sim.ui.findFirstByType() instead */
export { findFirstByType } from './doc-utils.js';
/** @deprecated Use sim.ui.findByProps() instead */
export { findByProps } from './doc-utils.js';
/** @deprecated Use sim.ui.getTextContent() instead */
export { getTextContent } from './doc-utils.js';
/** @deprecated Use sim.ui.interact() instead */
export { simulateEvent } from './doc-utils.js';
/** @deprecated Use sim.ui.listComponentTypes() instead */
export { listComponentTypes } from './doc-utils.js';
/** @deprecated Use sim.ui.findByTypeAndText() instead */
export { findByTypeAndText } from './doc-utils.js';
/** @deprecated Use sim.ui.prettyPrint() instead */
export { prettyPrint } from './doc-utils.js';
