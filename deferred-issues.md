# Deferred issues

A staging file for work that should become a GitHub issue but hasn't yet.

**Why this exists:** multiple agents work in this repo concurrently. If each
one files issues directly they collide — duplicates, races on numbering, and
issues opened against work another agent is mid-way through changing. So
agents append here instead, and a single agent is handed this file later to
open the issues in one pass.

## Conventions

- Append to the end; don't renumber or reorder existing entries.
- One `##`-level heading per item, a few sentences at most: what's wrong, why
  it was left, and what a fix would need to decide. Link code as
  `path/to/file.ts` or `path/to/file.ts:123`.
- Don't delete an entry when the work lands — the agent that files the issues
  prunes what's already fixed.

---

## Headless `Modal.open()` throws instead of rendering

`Modal.open()` is the one bridge command whose behaviour differs by surface.
The browser host draws a real overlay; the headless host
(`src/bridge/hosts/headless.ts`) throws, because there is no window to draw
into and silently resolving `undefined` would leave the app waiting on a
modal that never appears. That is defensible today, but it means a headless
test cannot exercise any flow that opens a modal, and a prebuilt bundle
running the real `@forge/bridge` hits it unavoidably.

Worth revisiting: headless could instead treat a modal as a second render
tree (as it already does for macro inline config), so `sim.ui` could render
the modal module by key and drive submit/close through the existing view-event
stream. The decision to make is whether the modal's ForgeDoc becomes a
first-class thing `sim.ui` exposes, or stays a thrown error with a pointer to
`forge-sim dev`.

## Dev mode does not hot-reload `__LOCALES__` edits

`forge-sim dev` now loads the app's translations at boot (`sim.i18n.loadFromAppDir`
in `src/dev-command.ts`) and serves them at `<page>/__LOCALES__/<file>`. The store
caches each locale after first read, and nothing re-reads on change, so editing
`en-US.json` while dev is running has no effect until restart. The file watcher
already fires for the app dir; the fix is to call `loadFromAppDir` again (it
clears the caches) when a changed path is under a `__LOCALES__` directory, then
let the page's next `useTranslation` fetch pick it up. Decide whether a locale
change should also trigger a browser reload, since the real package caches
translations per page load too.
