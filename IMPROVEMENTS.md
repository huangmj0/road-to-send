# Road to Send improvement backlog

This backlog records work that should follow the current sync-diagnostics, inline-validation, and accessibility pass. Priorities reflect risk to scoring integrity and organizer confidence.

## P0 — Define and enforce the challenge window

The interface describes a ten-week challenge, but the data model only has a trip date and currently counts activities outside any defined start/end window.

- Add an explicit challenge start date and decide whether the trip date is inclusive.
- Reject or visibly exclude entries before the start or after the end.
- Define behavior for timezone boundaries and backdated entries.
- Add unit tests for the first and last valid day, Sunday/Monday week boundaries, daylight-saving transitions, and entries logged after the trip.
- Derive “ten-week” and “November” copy from settings instead of hard-coding it.

## P1 — Make bingo genuinely shared

Bingo state currently lives in one browser even though the copy describes crew progress.

- Store tile completion centrally with the participant, completion time, and an optional note.
- Define whether a tile can be reversed and whether organizer approval is needed.
- Show who completed each tile and announce remote updates accessibly.
- Preserve an explicit local-only mode for demos and offline use.

## P1 — Add security and organizer controls

Anyone holding the Apps Script URL can currently submit activities or alter setup.

API version 4 now allowlists activity types, derives points server-side, validates participant/date/text fields, and returns structured errors. The remaining work is authorization and abuse recovery:

- Separate participant logging permissions from organizer settings and deletion permissions.
- Add rate limiting or another abuse-control strategy appropriate for Apps Script.
- Add idempotency keys so retries cannot create duplicate activities.
- Keep an audit history for settings changes and deletions, with a recoverable undo path.
- Document the privacy implications of putting the endpoint in a shared URL.

## P2 — Improve maintainability and automated coverage

The application, styles, and embedded Apps Script currently live in one compact HTML file. That makes reviews and behavioral tests unnecessarily difficult.

- Split browser code, styles, and Apps Script source into formatted files while preserving a simple deploy artifact.
- Define one versioned schema for settings, participants, activities, and error responses.
- Centralize scoring constants so browser and backend cannot drift.
- Add unit tests for settings validation, scoring caps, balanced-week bonuses, malformed rows, and local-calendar date formatting.
- Add contract fixtures for current, legacy, malformed, and partial Apps Script responses.
- Add an end-to-end smoke test covering connection, settings save, activity add, sync, and deletion.
- Run the static UX checks and future behavioral tests in continuous integration.

## P2 — Clarify recovery and data ownership

- Distinguish “save failed” from “saved, but refresh failed” to prevent duplicate retries.
- Provide export, backup, and restore instructions for organizers.
- Keep local demo entries separate from cached shared entries.
- Show protocol version, last successful sync, and a copyable sanitized error code in diagnostics.
