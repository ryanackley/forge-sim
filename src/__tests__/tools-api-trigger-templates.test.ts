import { afterAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { createSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';
import { parseManifestContent } from '../manifest.js';

async function startApiServer(manifestYaml: string): Promise<{ server: ReturnType<typeof createServer>; url: string }> {
  const sim = createSimulator();
  const manifest = parseManifestContent(manifestYaml);
  const handler = createApiHandler(sim, manifest);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void handler(req, res, url);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

describe('tools api trigger templates', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    })));
  });

  it('exposes Confluence trigger templates through /api/manifest and filters to deployed events', async () => {
    const { server, url } = await startApiServer(`
app:
  id: ari:cloud:ecosystem::app/test
  name: trigger-template-test
modules:
  function:
    - key: trigger-handler
      handler: index.handler
  trigger:
    - key: confluence-created-page
      function: trigger-handler
      events:
        - avi:confluence:created:page
    - key: jira-created-issue
      function: trigger-handler
      events:
        - avi:jira:created:issue
`);
    servers.push(server);

    const response = await fetch(`${url}/api/manifest`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.triggers).toHaveLength(2);
    expect(body.triggerEventTemplates['avi:confluence:created:page']).toBeDefined();
    expect(body.triggerEventTemplates['avi:confluence:created:page'].samplePayload.eventType).toBe('avi:confluence:created:page');
    expect(body.triggerEventTemplates['avi:jira:created:issue']).toBeDefined();
  });
});
