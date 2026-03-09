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
// Bridge is now managed by sim.ui — no direct bridge imports needed here

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
  // Try appDir-relative first (handles "src/resolver" → appDir/src/resolver.ts)
  for (const ext of FILE_EXTENSIONS) {
    const candidate = resolve(appDir, fileStem + ext);
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  // Fallback: try under src/ (handles "resolver" → appDir/src/resolver.ts)
  for (const ext of FILE_EXTENSIONS) {
    const candidate = resolve(appDir, 'src', fileStem + ext);
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
export async function resolveResourceFile(appDir: string, resourcePath: string): Promise<string | null> {
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
    sim.ui.ensureBridge();
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

  // ── Determine function types from manifest context ──────────────────────
  // Build sets of function keys by how they're used in the manifest
  const triggerFnKeys = new Set(manifest.triggers.map(t => t.functionKey));
  const consumerFnKeys = new Set(manifest.consumers.map(c => c.functionKey));
  const scheduledFnKeys = new Set(manifest.scheduledTriggers.map(s => s.functionKey));
  const resolverFnKeys = new Set<string>();
  for (const uiModule of manifest.uiModules) {
    if (uiModule.resolverFunctionKey) resolverFnKeys.add(uiModule.resolverFunctionKey);
  }

  // 3. Wire up resolvers (UI bridge pattern)
  // UI modules reference functions via resolver.function — those functions
  // export a Resolver's getDefinitions() result (a map of handler functions).
  // Resolver-defined functions get { payload, context } as a single wrapped object.
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
      sim.resolver.define(uiModule.resolverFunctionKey, exported);
    }
  }

  // Also register non-resolver functions that export definitions maps
  // (e.g., functions used by invoke() but not referenced by UI modules)
  for (const [fnKey, handler] of handlerExports) {
    if (typeof handler === 'object') {
      // Definitions map — register each sub-handler as resolver type
      for (const [defKey, defHandler] of Object.entries(handler)) {
        if (typeof defHandler === 'function' && !sim.resolver.getDefinitions().includes(defKey)) {
          sim.resolver.define(defKey, defHandler as any);
        }
      }
    }
  }

  // 4. Register trigger functions in the function registry
  // Triggers receive (event, context) as two separate arguments.
  for (const trigger of manifest.triggers) {
    const handler = handlerExports.get(trigger.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerFunction(trigger.functionKey, handler, 'trigger');
    }
  }

  // 5. Wire up consumers
  // Consumers receive (event, context) as two separate arguments.
  for (const consumer of manifest.consumers) {
    const handler = handlerExports.get(consumer.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerFunction(consumer.functionKey, handler, 'consumer');
      sim.registerConsumer(consumer.queue, handler);
    }
  }

  // 6. Register scheduled trigger functions
  // Scheduled triggers receive ({ context: { cloudId, moduleKey }, contextToken }, context)
  // and must return { statusCode, body?, headers?, statusText? }.
  for (const st of manifest.scheduledTriggers) {
    const handler = handlerExports.get(st.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerFunction(st.functionKey, handler, 'scheduledTrigger');
    }
  }

  // 7. Register remaining functions as generic (if not already registered)
  for (const [fnKey, handler] of handlerExports) {
    if (typeof handler === 'function' && !sim.functions.has(fnKey)) {
      // Not a trigger, consumer, or scheduled trigger — register as generic
      sim.registerFunction(fnKey, handler, 'generic');
      // Also make it available via resolver.define() for backward compat
      if (!sim.resolver.getDefinitions().includes(fnKey)) {
        sim.resolver.define(fnKey, handler);
      }
    }
  }

  // 8. Fire scheduled triggers once on deploy
  // In real Forge, scheduled triggers run on an interval (e.g. hourly).
  // For simulation, we fire them once at deploy time — this handles migrations
  // and any other startup tasks that use scheduledTrigger.
  for (const st of manifest.scheduledTriggers) {
    const handler = handlerExports.get(st.functionKey);
    if (handler && typeof handler === 'function') {
      console.log(` ⏰ Firing scheduled trigger: ${st.key} (${st.functionKey})`);

      // Build request per Forge docs: { context: { cloudId, moduleKey }, contextToken }
      const request = {
        context: {
          cloudId: 'sim-cloud-001',
          moduleKey: st.key,
        },
        contextToken: 'sim-context-token',
      };
      const context = {
        installContext: 'ari:cloud:jira::site/sim-site',
      };

      try {
        const result = await handler(request, context);

        // Validate response format (Forge requires { statusCode })
        if (result !== undefined && result !== null && typeof result === 'object' && 'statusCode' in result) {
          if (result.statusCode >= 500) {
            console.error(` ⚠️ Scheduled trigger "${st.key}" returned error: ${result.statusCode}`);
            errors.push({ functionKey: st.functionKey, error: `Scheduled trigger returned status ${result.statusCode}` });
          }
        }
        // Note: we don't enforce the return format here to be lenient during development.
        // Use sim.fireScheduledTrigger() for strict validation.
      } catch (err: any) {
        console.error(` ⚠️ Scheduled trigger "${st.key}" failed:`, err.message);
        errors.push({ functionKey: st.functionKey, error: `Scheduled trigger error: ${err.message}` });
      }
    }
  }

  // 6. UI resources are NOT loaded during deploy.
  // Use sim.ui.render(moduleKey) to load and render specific UI modules.
  // This gives per-module ForgeDoc isolation and proper context scoping.

  // Store manifest + app dir on simulator
  sim.loadManifestData(manifest);
  sim.setAppDir(absDir);

  return { manifest, loadedFunctions, loadedResources, errors };
}
