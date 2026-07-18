/**
 * Eval-7 F5 + F6 — MCP handshake honesty.
 *
 * F5: serverInfo.version was hardcoded '0.1.0' and lied on every release
 * since. It now comes from package.json (one directory above both src/
 * and dist/, so the same relative URL works under vitest and from the
 * published build).
 *
 * F6: tool names used a dotted `forge.deploy` convention. The MCP spec's
 * tool-name pattern is `[a-zA-Z0-9_-]{1,64}` — several clients enforce it
 * and reject dotted names outright, and our own docs/skill already spoke
 * `forge_deploy`. Names are now underscore-only.
 *
 * mcp-server.ts starts a transport on import, so these are source-level
 * pins (same approach as the staleness message pins).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(resolve(import.meta.dirname, '../mcp-server.ts'), 'utf8');
const PKG = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'));

/** All registered tool names, extracted from `server.tool(\n  'name',` calls. */
function registeredToolNames(): string[] {
  const names: string[] = [];
  const re = /server\.tool\(\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SOURCE)) !== null) names.push(m[1]);
  return names;
}

describe('eval-7 F6 — MCP tool names are spec-safe', () => {
  it('registers a full toolset (sanity: extraction regex works)', () => {
    const names = registeredToolNames();
    expect(names.length).toBeGreaterThanOrEqual(40);
    expect(names).toContain('forge_deploy');
    expect(names).toContain('forge_invoke');
    expect(names).toContain('forge_ui_fill_form');
  });

  it('every tool name matches the MCP spec pattern [a-zA-Z0-9_-]{1,64}', () => {
    for (const name of registeredToolNames()) {
      expect(name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });

  it('no dotted forge.* tool names remain anywhere in the server source', () => {
    // Dotted names in strings OR comments both re-teach the dead
    // convention — ban the pattern outright (forge:// resource URIs are
    // fine, the dot never precedes a slash).
    expect(SOURCE).not.toMatch(/forge\.[a-z0-9_]+'/);
    expect(SOURCE).not.toMatch(/`forge\.[a-z0-9_]/);
  });
});

describe('eval-7 F5 — serverInfo.version comes from package.json', () => {
  it('the McpServer constructor uses readPackageVersion(), not a literal', () => {
    expect(SOURCE).toMatch(/version:\s*readPackageVersion\(\)/);
    // The old bug shape: a hardcoded semver literal in the constructor.
    expect(SOURCE).not.toMatch(/version:\s*'\d+\.\d+\.\d+'/);
  });

  it('package.json actually has a semver version for it to read', () => {
    expect(PKG.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
