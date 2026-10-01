---
status: accepted
---

# Module state lives on one flat object

The 34 mutable module-level bindings that used to be bare `let` declarations (`config`, `logs`,
`me`, `endpoint`, `renderedDay`, `creditRuns`, the feed and modal flags, …) live on a single flat
`state` object in `src/app-core.js`, assigned to `globalThis.state`. It is not an ES-module export:
the bundled artifact keeps its implementation helpers in its closure, and tests mutate state
properties through that source seam.

This is forced by bundling, not chosen for elegance. The test suites mutate module state from
outside — roughly 460 assignments assign to those names — and once esbuild wraps the bundle in a
closure, no shim restores that. `--global-name` exposes exports for reading only: assigning
`APP.config = {…}` leaves the module's own binding untouched, which was verified directly. Mutating
a *property* of a shared object does cross the boundary, so `state.config = {…}` works.

Deliberately flat and deliberately not grouped. Splitting into `state` / `ui` / `sync` now would
guess at seams the deepening work has not settled yet, and the obvious "keep the private ones
private" refinement fails on contact: `creditRuns` looks like a scoring internal and is read by an
assertion in `tests/client-state.dom.test.js`, so the private set would be decided by test coupling
rather than by design.

Expect a future architecture review to flag 34 fields on one object and propose grouping them. That
is the right instinct at the wrong time — regroup once the activity-intake and storage-mode seams
exist and can say where the groups actually fall.
