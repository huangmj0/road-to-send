# Road to Send improvement backlog

This backlog records work that should follow the current sync-diagnostics, inline-validation, and accessibility pass. Priorities reflect risk to scoring integrity and organizer confidence.

## P0 — Define and enforce the challenge window

Status: implemented in API v6.

The interface describes a ten-week challenge, but the data model only has a trip date and currently counts activities outside any defined start/end window.

- Add an explicit challenge start date and decide whether the trip date is inclusive.
- Reject or visibly exclude entries before the start or after the end.
- Define behavior for timezone boundaries and backdated entries.
- Add unit tests for the first and last valid day, Sunday/Monday week boundaries, daylight-saving transitions, and entries logged after the trip.
- Derive “ten-week” and “November” copy from settings instead of hard-coding it.

## P1 — Improve maintainability and automated coverage

Status: implemented with source generation, shared contracts, smoke coverage, and CI.

The application, styles, and embedded Apps Script currently live in one compact HTML file. That makes reviews and behavioral tests unnecessarily difficult.

- Split browser code, styles, and Apps Script source into formatted files while preserving a simple deploy artifact.
- Define one versioned schema for settings, participants, activities, and error responses.
- Centralize scoring constants so browser and backend cannot drift.
- Keep unit coverage for settings validation, duration boundaries, scoring caps, balanced-week bonuses, bounties, benchmarks, malformed rows, and local-calendar date formatting current.
- Add contract fixtures for current, legacy, malformed, and partial Apps Script responses.
- Add browser-driven visual regression coverage for the You, Record, and Crew tabs at common mobile widths.
- Run the static UX checks and future behavioral tests in continuous integration.

## P2 — Clarify recovery and data ownership

Status: implemented with separated caches, retry-safe messaging, diagnostics, and recovery documentation.

- Distinguish “save failed” from “saved, but refresh failed” to prevent duplicate retries.
- Provide export, backup, and restore instructions for organizers.
- Keep local demo entries separate from cached shared entries.
- Show protocol version, last successful sync, and a copyable sanitized error code in diagnostics.

## P3 — Improve the available bounties

Status: implemented with simplified 1–3 point quests.

- Remove circuit board references
- Consider improvements to the bounties, simplify
- Each should have a fun name, then a simple description and how many points it is worth (adaptive to the difficulty)
