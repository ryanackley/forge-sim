/**
 * Tests for @forge/react/router support — Router, Route, useNavigate,
 * useLocation, useParams running headlessly against the sim's in-memory
 * bridge history.
 *
 * The real @forge/react router is pure client-side React: <Router> calls
 * `view.createHistory()` (async useEffect) and provides RouterContext;
 * <Route> matches via matchPath (exact segment count, `:param`, trailing
 * `*` catch-all, first-match-wins). The initial reconcile therefore shows
 * Router's "History is not defined" SectionMessage — routed content appears
 * only after the createHistory promise resolves, so tests use
 * `sim.ui.waitForContent()` to settle the async chain.
 *
 * Parity notes:
 * - history follows the v4 runtime contract: `listen((location, action))`,
 *   `goBack()`/`goForward()` — matching real Forge's bridge history.
 * - `navigate(-1)` → `history.go(-1)` exercises the in-memory entries stack.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

const fixtureDir = new URL('./fixtures/router-panel', import.meta.url).pathname;

describe('@forge/react/router', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  afterEach(async () => {
    await sim.reset();
  });

  it('renders the matching Route once createHistory resolves', async () => {
    await sim.deploy(fixtureDir);
    await sim.ui.render('router-panel');

    // Router starts at '/' — the Home route should render after the async
    // createHistory effect settles.
    const doc = await sim.ui.waitForContent('router-panel', 'Home page');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('Home page');
    // The other route and the fallback must NOT render
    expect(text).not.toContain('Detail for');
    expect(text).not.toContain('Not found');
  });

  it('useNavigate pushes a new route; useParams/useLocation reflect it', async () => {
    await sim.deploy(fixtureDir);
    await sim.ui.render('router-panel');
    let doc = await sim.ui.waitForContent('router-panel', 'Home page');

    // Click "Go to detail" → navigate('/detail/TEST-1') → history.push
    const button = sim.ui.findByTypeAndText(doc, 'Button', 'Go to detail');
    sim.ui.interact(button, 'onClick');

    doc = await sim.ui.waitForContent('router-panel', 'Detail for TEST-1');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('Detail for TEST-1'); // useParams → :id
    expect(text).toContain('At /detail/TEST-1'); // useLocation → pathname
    expect(text).not.toContain('Home page'); // first-match-wins, old route gone
  });

  it('navigate(-1) pops back through the in-memory history stack', async () => {
    await sim.deploy(fixtureDir);
    await sim.ui.render('router-panel');
    let doc = await sim.ui.waitForContent('router-panel', 'Home page');

    const forward = sim.ui.findByTypeAndText(doc, 'Button', 'Go to detail');
    sim.ui.interact(forward, 'onClick');
    doc = await sim.ui.waitForContent('router-panel', 'Detail for TEST-1');

    // Click "Back" → navigate(-1) → history.go(-1) → POP notify
    const back = sim.ui.findByTypeAndText(doc, 'Button', 'Back');
    sim.ui.interact(back, 'onClick');

    doc = await sim.ui.waitForContent('router-panel', 'Home page');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('Home page');
    expect(text).not.toContain('Detail for');
  });

  it('Router/Route never appear in the ForgeDoc (client-side only)', async () => {
    await sim.deploy(fixtureDir);
    await sim.ui.render('router-panel');
    const doc = await sim.ui.waitForContent('router-panel', 'Home page');

    expect(sim.ui.findByType(doc, 'Router')).toHaveLength(0);
    expect(sim.ui.findByType(doc, 'Route')).toHaveLength(0);
  });
});
