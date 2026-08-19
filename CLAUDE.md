# Road to Send — agent orientation

**This app is live** at <https://huangmj0.github.io/road-to-send/>, serving a real crew's data from a
shared Google Sheet and from their browsers' localStorage. `index.html` is the deployed artifact and
**stays at the repository root** — moving or renaming it changes the published URL.

**Read `AGENTS.md` before touching anything.** It is the authoritative guide: structure, commands,
the hard constraints a live app imposes, tone, style, testing, and commits. The rules that bite
before you reach it:

- Edit `src/` and `tests/`; **never** edit `index.html` by hand. After any `src/` change run
  `npm run build`, then `npm test`, and commit the regenerated `index.html` with the source edit.
- Never weaken an existing test assertion.
- `src/apps-script.js`, `src/schema.json` and `src/scoring.json` are the browser/backend contract —
  changing one forces an API version bump and an organizer redeploy.
- Each test file's `TRAP` header comment names its harness's sharp edges — read it before adding
  assertions there.

## Per-repo skill configuration

The vendored skills read these repo-specific docs. Reach for the one whose surface a skill's work
lands on:

- **Issues, specs, triage** — driven through the `gh` CLI: `docs/agents/issue-tracker.md`.
- **Triage labels** — the five canonical roles and their label strings: `docs/agents/triage-labels.md`.
- **Domain terms and decisions** — `CONTEXT.md` and `docs/adr/`, created lazily by `/domain-modeling`:
  `docs/agents/domain.md`.
- **The improvement loop** — Claude plans and reviews, Codex executes, one issue per tick:
  `docs/loop-prompt.md`.
