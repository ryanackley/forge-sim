// Every handler records who it ran as, through the REAL bundled @forge/api:
// the runtime's aaid, what asUser()/asApp() answered, and whether authorize()
// could find a user. Results land in KVS under probe:<kind> so the test can
// read them back whatever the kind's return convention is.
import Resolver from '@forge/resolver';
import { asApp, asUser, authorize, route } from '@forge/api';
import { kvs } from '@forge/kvs';

// `payload` is what the kind's first argument was; the convention check
// reads payloadKeys/contextKeys to tell Forge's (payload, context) from the
// resolver wrap ({ payload, context }, undefined).
async function probe(kind, context, payload) {
  const rt = globalThis.__forge_runtime__;
  const out = {
    kind,
    aaid: rt.aaid ?? null,
    moduleType: rt.appContext.moduleType,
    moduleKey: rt.appContext.moduleKey,
    functionKey: rt.appContext.functionKey,
    remainingMs: rt.lambdaContext.getRemainingTimeInMillis(),
    contextKeys: Object.keys(context ?? {}).sort(),
    principal: context?.principal ?? null,
    payloadKeys: Object.keys(payload ?? {}).sort(),
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
export const consumer = async (event, context) => probe('consumer', context, event);
// Forge calls every non-resolver function (payload, context); so does
// sim.invoke() once the manifest gives the function its kind.
export const action = async (payload, context) => probe('action', context, payload);
export const preUninstall = async (payload, context) => probe('preUninstall', context, payload);
export const cfValue = async (payload, context) => probe('customFieldValue', context, payload);
export const validator = async (payload, context) => probe('workflow', context, payload);
export const jql = async (payload, context) => probe('jqlFunction', context, payload);
