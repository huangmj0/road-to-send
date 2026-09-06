# Issue 161: voluntary recap

The recap is now opened only through the **Recap** button on the You view. Booting the app, loading
or refreshing shared data, choosing an identity, creating a profile, and moving between views do not
open it. Closing the dialog returns focus to the control that opened it.

The following automatic or prompting expectations were deliberately retired because the recap is a
reflection surface that must report recorded achievements without asking the crew to participate:

- The once-per-calendar-week automatic recap after local boot.
- The automatic recap after choosing an existing identity.
- The automatic recap after creating a profile.
- The automatic recap after a shared Sheet load or manual sync.
- The zero-point “Welcome to the crew” panel and its instruction to log activities.
- The empty leaderboard instruction to be first this week.
- The empty Bounty Hunter message that said the crown was up for grabs.
- The challenge countdown, final-week exhortation, and completion message inside the recap.

The earned recap expectations remain: a climber's previous Monday–Sunday points, active days, and
hardest send; the crew's recorded top point earners; and recorded Bounty Hunter results. The
leaderboard's rolling range is labeled **Last 7 days**, while the bounty-credit hint explicitly says
**this week (Monday–Sunday)** so the two time ranges cannot be mistaken for one another.
