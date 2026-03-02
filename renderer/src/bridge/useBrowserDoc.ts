/**
 * useBrowserDoc — React hook for browser mode.
 *
 * In browser mode, @forge/react runs in the browser and produces ForgeDoc
 * locally via the reconciler. This hook listens for reconcile events from
 * our bridge shim (not WebSocket) and feeds the ForgeDoc to the renderer.
 *
 * This is the browser-mode counterpart to useLiveDoc (which receives
 * ForgeDoc over WebSocket from the Node backend).
 */

import { useState, useEffect } from 'react';
import { onReconcile } from './forge-bridge-shim';
import type { ForgeDoc } from '../types';

interface UseBrowserDocResult {
  /** The latest ForgeDoc from the local reconciler */
  doc: ForgeDoc | null;
  /** Number of renders so far */
  renderCount: number;
}

export function useBrowserDoc(): UseBrowserDocResult {
  const [doc, setDoc] = useState<ForgeDoc | null>(null);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    const unbind = onReconcile((forgeDoc: ForgeDoc) => {
      setDoc(forgeDoc);
      setRenderCount((n) => n + 1);
    });

    return unbind;
  }, []);

  return { doc, renderCount };
}
