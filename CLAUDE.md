# Road to Send — agent orientation

**This app is live** at <https://huangmj0.github.io/road-to-send/>, serving a real crew's data from a
shared Google Sheet and from their browsers' localStorage. `index.html` is the deployed artifact and
**stays at the repository root** — moving or renaming it changes the published URL.

## Read this first

`AGENTS.md` is the authoritative repository guide: structure, commands, the hard constraints that
come from running a live app, tone, style, testing, and commit conventions. Read it before touching
anything. This file deliberately does not restate it, because a second copy is a second thing to
drift. The short version:

- Edit `src/app.js`, `src/index.template.html`, `src/styles.css` and `tests/`. **Never** edit
  `index.html` by hand; run `npm run build` to regenerate it, then `npm test`.
- Commit the regenerated `index.html` with your `src/` changes. Never weaken an existing assertion.
- `npm run check:generated` is read-only; if it fails, run `npm run build` and commit `index.html`.
- `src/apps-script.js`, `src/schema.json` and `src/scoring.json` are the shared browser/backend
  contract — changing one forces an API version bump and an organizer redeploy.
- Harness traps live in a header comment in the test file they apply to — read it before adding
  assertions there.

## Agent skills

This repo uses [Matt Pocock's skills](https://github.com/mattpocock/skills), vendored under
`.agents/skills/` and exposed to Claude Code through `.claude/skills/` symlinks.
`skills-lock.json` pins them; `npx skills@latest update` refreshes them.

### Issue tracker

Issues live in this repo's GitHub Issues, driven through the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root, both created lazily by
`/domain-modeling` when a term or decision actually gets resolved. See `docs/agents/domain.md`.
