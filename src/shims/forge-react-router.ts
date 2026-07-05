/**
 * @forge/react/router shim — re-exports the real @forge/react router subpath.
 *
 * Why a shim at all: the loader redirects the bare `@forge/react` import to
 * forge-sim's installed copy (see forge-react.ts). If `@forge/react/router`
 * resolved via the consumer app's own node_modules instead, the app could end
 * up with TWO @forge/react copies in one graph — the shimmed main package and
 * the un-shimmed router — each with its own React internals. Routing the
 * subpath through the same copy keeps the module graph consistent.
 *
 * The router is pure client-side React: <Router> calls
 * `view.createHistory()` from @forge/bridge and provides RouterContext;
 * <Route>/useNavigate/useLocation/useParams consume it. Router/Route never
 * appear in the ForgeDoc, so no renderer mapping exists (or is needed).
 * `view.createHistory()` works headlessly because the real @forge/bridge
 * dispatches through `globalThis.__bridge.callBridge('createHistory')`,
 * which src/ui/bridge.ts handles with an in-memory history.
 */

// @ts-nocheck
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const realModule = require('@forge/react/router');

export const Router = realModule.Router;
export const Route = realModule.Route;
export const useNavigate = realModule.useNavigate;
export const useLocation = realModule.useLocation;
export const useParams = realModule.useParams;
