/**
 * ForgeDocRenderer — recursively walks a ForgeDoc tree and renders
 * each node using the Atlaskit component map.
 *
 * This is the main entry point for rendering ForgeDoc → real UI.
 */

import React from 'react';
import { COMPONENT_MAP, FallbackComponent } from './component-map';
import type { ForgeDoc } from './types';

interface ForgeDocRendererProps {
  doc: ForgeDoc;
  onEvent?: (handlerId: string, eventName: string, ...args: any[]) => void;
}

function renderNode(doc: ForgeDoc, onEvent?: ForgeDocRendererProps['onEvent']): React.ReactNode {
  // Render children recursively first
  const children = (doc.children ?? []).map((child) => renderNode(child, onEvent));

  // Look up the component renderer
  const renderer = COMPONENT_MAP[doc.type] ?? FallbackComponent;

  // Wire up event handlers — pass the onEvent callback through props
  const props = { ...doc.props };
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      const originalFn = value;
      props[key] = (...args: any[]) => {
        if (onEvent) {
          onEvent(originalFn.__id__ ?? 'unknown', key, ...args);
        }
        return originalFn(...args);
      };
    }
  }

  return (
    <React.Fragment key={doc.key}>
      {renderer(props, children, doc)}
    </React.Fragment>
  );
}

export function ForgeDocRenderer({ doc, onEvent }: ForgeDocRendererProps) {
  return <>{renderNode(doc, onEvent)}</>;
}
