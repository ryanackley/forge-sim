/**
 * ForgeDocRenderer — recursively walks a ForgeDoc tree and renders
 * each node using the Atlaskit component map.
 *
 * Supports two event modes:
 *   1. Direct (sample mode): function props are called directly
 *   2. Bridge (live mode): function markers (__fn__:handlerId) are routed
 *      through the WebSocket event bridge back to forge-sim
 */

import React from 'react';
import { COMPONENT_MAP, FallbackComponent } from './component-map';
import type { ForgeDoc } from './types';

interface ForgeDocRendererProps {
  doc: ForgeDoc;
  /** Called for direct function calls (sample mode) */
  onEvent?: (handlerId: string, eventName: string, ...args: any[]) => void;
  /** Called to send events through the WebSocket bridge (live mode) */
  onBridgeEvent?: (handlerId: string, eventName: string, ...args: any[]) => Promise<any>;
}

/**
 * Wire up event handler props.
 *
 * For serialized ForgeDoc (from WebSocket), function props are strings like "__fn__:handlerId".
 * We convert these to real functions that route through the bridge.
 *
 * For in-memory ForgeDoc (samples), function props are actual functions.
 */
function wireEventHandlers(
  props: Record<string, any>,
  onEvent?: ForgeDocRendererProps['onEvent'],
  onBridgeEvent?: ForgeDocRendererProps['onBridgeEvent']
): Record<string, any> {
  const wired: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.startsWith('__fn__:')) {
      // Serialized function marker from WebSocket — route through bridge
      const handlerId = value.slice(7);
      wired[key] = (...args: any[]) => {
        if (onBridgeEvent) {
          onBridgeEvent(handlerId, key, ...args);
        }
        if (onEvent) {
          onEvent(handlerId, key, ...args);
        }
      };
    } else if (typeof value === 'function') {
      // Direct function reference (sample mode)
      const originalFn = value;
      wired[key] = (...args: any[]) => {
        if (onEvent) {
          onEvent(originalFn.__id__ ?? 'unknown', key, ...args);
        }
        return originalFn(...args);
      };
    } else {
      wired[key] = value;
    }
  }

  return wired;
}

function renderNode(
  doc: ForgeDoc,
  onEvent?: ForgeDocRendererProps['onEvent'],
  onBridgeEvent?: ForgeDocRendererProps['onBridgeEvent']
): React.ReactNode {
  // Render children recursively first
  const children = (doc.children ?? []).map((child) =>
    renderNode(child, onEvent, onBridgeEvent)
  );

  // Root container node — just render its children, no wrapper needed
  if (doc.type === 'Root') {
    return <React.Fragment key={doc.key}>{children}</React.Fragment>;
  }

  // Look up the component renderer
  const renderer = COMPONENT_MAP[doc.type] ?? FallbackComponent;

  // Wire up event handlers
  const wiredProps = wireEventHandlers(doc.props, onEvent, onBridgeEvent);

  // Bound render function for components that need to render ForgeDoc sub-trees
  // (e.g. DynamicTable reconstructing head/rows from ContentWrapper children).
  // Carries the same onEvent/onBridgeEvent context as the parent render.
  const renderChild = (childDoc: ForgeDoc) =>
    renderNode(childDoc, onEvent, onBridgeEvent);

  const element = renderer(wiredProps, children, { ...doc, props: wiredProps }, renderChild);
  // Attach the ForgeDoc key directly on the rendered element — no Fragment wrapper.
  // This matters because components like Atlaskit Tooltip use cloneElement on children
  // and Fragments swallow the cloned props (event handlers, refs).
  if (doc.key && React.isValidElement(element)) {
    return React.cloneElement(element, { key: doc.key });
  }
  return element;
}

export function ForgeDocRenderer({ doc, onEvent, onBridgeEvent }: ForgeDocRendererProps) {
  return <>{renderNode(doc, onEvent, onBridgeEvent)}</>;
}
