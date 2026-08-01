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

Status: implemented with source generation, shared contracts, behavioral and smoke coverage, mobile visual baselines, and CI. Keep tests and screenshots current as behavior changes.

The application, styles, and embedded Apps Script currently live in one compact HTML file. That makes reviews and behavioral tests unnecessarily difficult.

- [x] Split browser code, styles, and Apps Script source into formatted files while preserving a simple deploy artifact.
- [x] Define one versioned schema for settings, participants, activities, and error responses.
- [x] Centralize scoring constants so browser and backend cannot drift.
- [x] Keep behavioral coverage current as scoring and migration rules evolve. Current tests cover scoring caps, challenge boundaries, bounties, malformed remote rows, local-calendar formatting, and key backend write/error paths; broader Sheets integration cases remain useful.
- [x] Add contract fixtures for current, legacy, malformed, and partial Apps Script responses.
- [x] Add browser-driven visual regression coverage for the You, Record, and Crew tabs at common mobile widths.
- [x] Run the static UX and behavioral tests in continuous integration.

## P2 — Clarify recovery and data ownership

Status: implemented for the current architecture with separated caches, retry-safe messaging, diagnostics, and an organizer backup/restore runbook. Periodically verify the runbook against Google Sheets and Apps Script UI changes.

- [x] Distinguish “save failed” from “saved, but refresh failed” to prevent duplicate retries.
- [x] Provide export, backup, restore, and deployment rollback instructions for organizers.
- [x] Keep local demo entries separate from cached shared entries.
- [x] Show protocol version, last successful sync, and a copyable sanitized error code in diagnostics.

## P3 — Improve the available bounties

Status: resolved in API v9. Balanced three-category scoring (Climbing / Exercise / Mobility) with a
+2 balanced-day bonus, plus rotating daily bounties returned as a clear catalog in `src/scoring.json`.

- Circuit-board references removed.
- Bounties simplified to a curated catalog; three rotate per day (one per category), chosen
  deterministically from the date so the whole crew sees the same set.
- Each bounty has a fun name, a one-line description, and a 1–3 point value scaled to difficulty.
- A weekly bounty-point cap keeps them a spice; over-cap claims still count toward the 🏹 Bounty
  Hunter tag (most weekly completions) for bragging rights.
