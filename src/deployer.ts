/**
 * Deployer — loads a Forge app directory into the simulator.
 *
 * Reads the manifest, resolves handler strings (e.g. "index.handler") to actual
 * module files in src/, dynamically imports them, and wires everything up:
 * resolvers, consumers, triggers, scheduled triggers.
 *
 * This is the "deploy to sim" equivalent — one call, zero app modifications.
 */

import { resolve, join } from 'node:path';
import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseManifest, type ParsedManifest, type ManifestFunction } from './manifest.js';
import type { ForgeSimulator } from './simulator.js';
import { installBridge, connectSimulator } from './ui/bridge.js';

export interface DeployResult {
  manifest: ParsedManifest;
  loadedFunctions: string[];
  loadedResources: string[];
  errors: Array<{ functionKey: string; error: string }>;
}

/**
 * Resolve a Forge handler string like "index.handler" to a file path and export name.
 * 
 * Convention: "file.exportName" → src/file.{js,ts,mjs} → import { exportName }
 * Supports nested: "resolvers/issue.handler" → src/resolvers/issue.{js,ts,mjs}
 */
function parseHandlerString(handler: string): { fileStem: string; exportName: string } {
  const lastDot = handler.lastIndexOf('.');
  if (lastDot === -1) {
    return { fileStem: handler, exportName: 'default' };
  }
  return {
    fileStem: handler.substring(0, lastDot),
    exportName: handler.substring(lastDot + 1),
  };
}

const FILE_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs'];

/**
 * Find the actual file for a handler stem, checking src/ with various extensions.
 */
async function resolveHandlerFile(appDir: string, fileStem: string): Promise<string | null> {
  const srcDir = join(appDir, 'src');
  
  // Try src/ first (standard Forge layout)
  for (const ext of FILE_EXTENSIONS) {
    const candidate = resolve(srcDir, fileStem + ext);
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  // Fall back to app root (some simple apps don't use src/)
  for (const ext of FILE_EXTENSIONS) {
    const candidate = resolve(appDir, fileStem + ext);
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

/**
 * Find the actual file for a resource path, trying exact match first then extensions.
 */
async function resolveResourceFile(appDir: string, resourcePath: string): Promise<string | null> {
  const exact = resolve(appDir, resourcePath);

  // If the path ends in .tsx/.ts/.jsx, try .js first (Node can't import tsx natively)
  if (/\.tsx?$|\.jsx$/.test(resourcePath)) {
    const jsPath = exact.replace(/\.tsx?$|\.jsx$/, '.js');
    try {
      await access(jsPath);
      return jsPath;
    } catch {}
  }

  // Try exact path
  try {
    await access(exact);
    return exact;
  } catch {}

  // Try without extension + each extension
  const withoutExt = exact.replace(/\.[^.]+$/, '');
  for (const ext of FILE_EXTENSIONS) {
    const candidate = withoutExt + ext;
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

/**
 * Deploy a Forge app directory into a simulator instance.
 * 
 * 1. Reads manifest.yml from appDir
 * 2. For each function in the manifest, resolves the handler file and imports it
 * 3. Wires up resolvers, consumers, and triggers on the simulator
 */
export async function deploy(sim: ForgeSimulator, appDir: string): Promise<DeployResult> {
  const absDir = resolve(appDir);
  const manifestPath = join(absDir, 'manifest.yml');

  // 1. Parse manifest
  const manifest = await parseManifest(manifestPath);

  // 1b. If there are UI resources, install the bridge and connect to sim
  if (manifest.resources.size > 0) {
    installBridge();
    connectSimulator(sim);
  }

  const loadedFunctions: string[] = [];
  const loadedResources: string[] = [];
  const errors: Array<{ functionKey: string; error: string }> = [];

  // 2. Load each function module
  const handlerExports = new Map<string, any>();

  for (const [fnKey, fnDef] of manifest.functions) {
    try {
      const { fileStem, exportName } = parseHandlerString(fnDef.handler);
      const filePath = await resolveHandlerFile(absDir, fileStem);
      
      if (!filePath) {
        errors.push({
          functionKey: fnKey,
          error: `Could not find handler file for "${fnDef.handler}" (tried src/${fileStem}.{js,ts,mjs,cjs} and ${fileStem}.{js,ts,mjs,cjs})`,
        });
        continue;
      }

      // Dynamic import (cache-bust so re-deploys get fresh modules)
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl + '?t=' + Date.now());

      const handler = mod[exportName] ?? mod.default?.[exportName];
      if (!handler) {
        errors.push({
          functionKey: fnKey,
          error: `Module "${filePath}" has no export "${exportName}". Available: ${Object.keys(mod).join(', ')}`,
        });
        continue;
      }

      handlerExports.set(fnKey, handler);
      loadedFunctions.push(fnKey);
    } catch (err) {
      errors.push({
        functionKey: fnKey,
        error: `Failed to load "${fnDef.handler}": ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 3. Wire up resolvers
  // UI modules reference functions via resolver.function — those functions
  // export a Resolver's getDefinitions() result (a map of handler functions).
  // We need to register each handler on the simulator.
  for (const uiModule of manifest.uiModules) {
    if (!uiModule.resolverFunctionKey) continue;

    const exported = handlerExports.get(uiModule.resolverFunctionKey);
    if (!exported) continue;

    if (typeof exported === 'object') {
      // It's a definitions map from Resolver.getDefinitions()
      for (const [defKey, defHandler] of Object.entries(exported)) {
        if (typeof defHandler === 'function') {
          sim.resolver.define(defKey, defHandler as any);
        }
      }
    } else if (typeof exported === 'function') {
      // Direct function handler
      sim.resolver.define(uiModule.resolverFunctionKey, exported);
    }
  }

  // Also wire up any function that's used directly as a resolver (not via UI module)
  // This handles cases where invoke() is called directly with a function key
  for (const [fnKey, handler] of handlerExports) {
    if (typeof handler === 'function') {
      // Register the function itself as invocable
      if (!sim.resolver.getDefinitions().includes(fnKey)) {
        sim.resolver.define(fnKey, handler);
      }
    } else if (typeof handler === 'object') {
      // Definitions map — register each sub-handler
      for (const [defKey, defHandler] of Object.entries(handler)) {
        if (typeof defHandler === 'function' && !sim.resolver.getDefinitions().includes(defKey)) {
          sim.resolver.define(defKey, defHandler as any);
        }
      }
    }
  }

  // 4. Wire up consumers
  for (const consumer of manifest.consumers) {
    const handler = handlerExports.get(consumer.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerConsumer(consumer.queue, handler);
    }
  }

  // 5. Wire up triggers
  // Triggers are already handled by fireTrigger() which looks up the manifest
  // and invokes via resolver — so as long as the function is registered, it works.

  // 5b. Fire scheduled triggers once on deploy
  // In real Forge, scheduled triggers run on an interval (e.g. hourly).
  // For simulation, we fire them once at deploy time — this handles migrations
  // and any other startup tasks that use scheduledTrigger.
  for (const st of manifest.scheduledTriggers) {
    const handler = handlerExports.get(st.functionKey);
    if (handler && typeof handler === 'function') {
      try {
        console.log(` ⏰ Firing scheduled trigger: ${st.key} (${st.functionKey})`);
        await handler({ scheduledTrigger: { key: st.key, interval: st.interval } });
      } catch (err: any) {
        console.error(` ⚠️ Scheduled trigger "${st.key}" failed:`, err.message);
        errors.push({ functionKey: st.functionKey, error: `Scheduled trigger error: ${err.message}` });
      }
    }
  }

  // 6. Load UI resources
  // Resources are front-end entry points (e.g. src/frontend/index.tsx) that
  // call ForgeReconciler.render(). Loading them triggers the UI to mount
  // and produce a ForgeDoc through the bridge.
  for (const uiModule of manifest.uiModules) {
    if (!uiModule.resourceKey) continue;

    const resource = manifest.resources.get(uiModule.resourceKey);
    if (!resource) {
      errors.push({
        functionKey: uiModule.key,
        error: `UI module "${uiModule.key}" references resource "${uiModule.resourceKey}" but it's not defined in manifest resources`,
      });
      continue;
    }

    try {
      const resourcePath = await resolveResourceFile(absDir, resource.path);
      if (!resourcePath) {
        errors.push({
          functionKey: uiModule.key,
          error: `Resource file not found: "${resource.path}"`,
        });
        continue;
      }

      const fileUrl = pathToFileURL(resourcePath).href;
      await import(fileUrl + '?t=' + Date.now());
      loadedResources.push(uiModule.resourceKey);
    } catch (err) {
      errors.push({
        functionKey: uiModule.key,
        error: `Failed to load resource "${resource.path}": ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Store manifest on simulator
  sim.loadManifestData(manifest);

  return { manifest, loadedFunctions, loadedResources, errors };
}
