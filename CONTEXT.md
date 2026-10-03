# Road to Send

A climbing crew's shared training board for one dated challenge: everyone logs activities, the app
scores them, and the whole crew sees the same totals.

## Language

**Crew**:
The group of climbers sharing one board and one group goal. The people a change can hurt — whether
something reaches the crew is the test for whether a rule in `AGENTS.md` is a hard constraint.
_Avoid_: users, team, group

**Climber**:
One member of a crew, identified by name. The person whose data a frozen localStorage key holds.
_Avoid_: user, participant, player

**Organizer**:
The climber who set the crew up and who deploys, and redeploys by hand, the board's Supabase function. Distinct
from a climber because a backend change only reaches a crew once *its* organizer redeploys.
_Avoid_: admin, owner, maintainer

**Shared mode**:
The state in which a crew's board is backed by the crew's shared-board backend (a Supabase function; the
old Google Sheet now only redirects), so every climber sees the same data and the challenge day
follows the backend's timezone.
_Avoid_: online, connected, endpoint mode

**Local mode**:
The state in which a board exists only in one browser's localStorage, with no shared board behind it.
Deletes are undoable here and not in shared mode.
_Avoid_: offline, standalone, unconnected

**Redirector**:
The crew's old Google Sheet, frozen at API v13. It serves its last board with `movedTo` set and
refuses writes, so old `?sheet=` links lead the browser to the Supabase function.
_Avoid_: backup, legacy backend
