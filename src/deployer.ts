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

export interface DeployResult {
  manifest: ParsedManifest;
  loadedFunctions: string[];
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

const FILE_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs'];

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

  const loadedFunctions: string[] = [];
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

      // Dynamic import
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);

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

  // Store manifest on simulator
  sim.loadManifestData(manifest);

  return { manifest, loadedFunctions, errors };
}
