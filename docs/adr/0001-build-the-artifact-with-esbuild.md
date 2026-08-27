---
status: proposed
---

# Build the artifact with esbuild

**Decided, not yet implemented.** At the time of writing `package.json` has no esbuild and no
lockfile, `scripts/build.mjs` still inlines the raw sources, and neither workflow runs `npm ci`.
This ADR records the decision; the migration lands in a later change.

`src/` will be bundled and minified by esbuild into the single self-contained `index.html` at the
repository root. This repo previously forbade all dependencies, runtime and dev alike, which forced
the source to be hand-compacted — 400-character lines, one top-level function per line — and left
`index.html` at 97.4% of its byte budget with no room to grow.

Measured on the already hand-compacted artifact, real minification returns 182,091 → 161,693 bytes
(script −13.8%, styles −9.0%) with scoring totals, bounty rotation, week keys, pace state and
`render()` output all verified identical. Tooling buys budget rather than spending it, so the
compact style no longer earns its cost.

The rule that mattered — one self-contained artifact, no runtime dependency on another host, no new
network requests — was a property of the *output* being enforced on the *input*. It now binds the
artifact (AGENTS.md constraint 7), and `src/` is free to be modules. Nothing about the published
page changes: same URL, same single file, same zero external requests.

## Considered options

- **Minify only, keep one source file.** Banks the same bytes, but leaves the source a 95 KB
  monolith and the test surface asserting over source text — so it buys budget and nothing else.
- **Vendor the minifier into the repo.** Keeps the deploy hermetic at the cost of a
  platform-specific binary in git, permanently.
- **Hand-roll a minifier in `scripts/`.** No dependency, but then we maintain a minifier.

## Consequences

Both workflows will gain `npm ci` against a committed lockfile, so the deploy gate will then depend
on the npm registry. A failed install blocks *new* deploys; GitHub Pages keeps serving the last successful
one, so the crew never sees an outage. Dependency versions are to be pinned exactly.

The Apps Script constant is to be interpolated *after* minification, so the built ``const
SCRIPT=`…`;`` line and the `SUPPORTED_API_VERSIONS` line after it survive intact and
`tests/backend-script.test.js` keeps extracting the backend source unchanged.
