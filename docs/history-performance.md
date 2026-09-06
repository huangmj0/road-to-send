# History performance

Issue #162 removes repeated full-history scans and per-view sorts from the personal and crew history
path. The browser now derives one snapshot when the activity-array or configuration reference
changes. That snapshot owns the existing `computeCredits()` result and newest-first indexes for all
activities, each climber, each type, and each climber/type pair.

## Benchmark

Measurements were taken on 2026-09-05 with Node 24.14.0 on the same development machine. Synthetic
histories cycle across climb, exercise, mobility, and bounty entries and distribute entries evenly
through the stated crew size. Each reported steady-state value is the median of seven runs after one
warm-up. The workload selects one climber's filtered history, renders up to 500 rows, selects the
crew's filtered history, lists that climber's bounty claims, and builds their five-entry recent list.

| Activities | Crew | Before | After | Change |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 10 | 0.87 ms | 0.56 ms | 36% faster |
| 10,000 | 50 | 2.28 ms | 0.59 ms | 74% faster |
| 50,000 | 100 | 10.55 ms | 1.00 ms | 91% faster |

The prior workload performed four complete array filters and two per-climber sorts even though its
scoring map was already memoized. The new measurements read the same views from the shared snapshot.
Snapshot construction remains linear apart from its one newest-first sort and happens once per new
activity-array/configuration pair. Its cold medians, including the existing scoring pass, were 5.85
ms, 59.08 ms, and 304.49 ms at 1k, 10k, and 50k respectively. Subsequent renders and filter changes
reuse it.

The benchmark intentionally uses synthetic data and Node rather than a phone browser, so absolute
times are directional. Behavioral tests separately pin credits, source indexes used by deletion,
date/created-at ordering, type filtering, and snapshot invalidation.
