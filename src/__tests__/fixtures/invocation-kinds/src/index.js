// Every handler records who it ran as, through the REAL bundled @forge/api:
// the runtime's aaid, what asUser()/asApp() answered, and whether authorize()
// could find a user. Results land in KVS under probe:<kind> so the test can
// read them back whatever the kind's return convention is.
import Resolver from '@forge/resolver';
import { asApp, asUser, authorize, route } from '@forge/api';
import { kvs } from '@forge/kvs';

async function probe(kind, context) {
  const rt = globalThis.__forge_runtime__;
  const out = {
    kind,
    aaid: rt.aaid ?? null,
    moduleType: rt.appContext.moduleType,
    contextKeys: Object.keys(context ?? {}).sort(),
  };
  try {
    const res = await asUser().requestJira(route`/rest/api/3/myself`);
    out.asUser = { status: res.status, body: await res.json() };
  } catch (err) {
    out.asUser = { error: { name: err.name, status: err.status, message: err.message } };
  }
  const app = await asApp().requestJira(route`/rest/api/3/myself`);
  out.asApp = { status: app.status, body: await app.json() };
  try {
    authorize();
    out.authorize = 'ok';
  } catch (err) {
    out.authorize = err.message;
  }
  await kvs.set(`probe:${kind}`, out);
  return out;
}

const r = new Resolver();
r.define('whoami', async (req) => probe('resolver', req.context));
export const resolver = r.getDefinitions();

export const trigger = async (event, context) => probe('trigger', context);
export const sched = async (request, context) => probe('scheduledTrigger', context);
export const hook = async (request, context) => {
  await probe('webTrigger', context);
  return { statusCode: 200, body: 'ok' };
};
export const consumer = async (event, context) => probe('consumer', context);
// The sim drives these through sim.invoke(), which still wraps the payload
// resolver-style; accept either argument shape.
export const preUninstall = async (a, b) => probe('preUninstall', b ?? a?.context);
export const cfValue = async (a, b) => probe('customFieldValue', b ?? a?.context);
export const validator = async (a, b) => probe('workflow', b ?? a?.context);
export const jql = async (a, b) => probe('jqlFunction', b ?? a?.context);
