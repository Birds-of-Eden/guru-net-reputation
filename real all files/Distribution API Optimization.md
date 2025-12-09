# Distribution API Optimization Notes

This document captures the API‐level performance work completed while optimizing `app/[role]/distribution/client-agent/[clientId]/page.tsx`.

## Summary

| API | Optimization |
| --- | --- |
| `/api/tasks/clients` | Replaced `include` chains with a batched task fetch, single-pass aggregation, and lean client projections so the response scales linearly with task count. |
| `/api/tasks/agents[?teamId=]` | Returns a cached, projected payload (`BASE_AGENT_SELECT`) instead of full `user` objects; applies short CDN cache headers. |
| `/api/clients/:clientId?view=distribution` | New query flag skips heavy relations and progress recompute when the distribution page only needs summary data. |
| `/api/tasks/client/:clientId` | Uses `select` instead of `include` to pull just the task fields rendered in the distribution UI. |
| `/api/tasks/distribute` (POST/PUT) | Counts assignments once, uses `upsert`/`updateMany` for `clientTeamMember` rows, and handles bulk deltas without per-task lookups. |

## API Details

### `/api/tasks/clients`
- **File:** `app/api/tasks/clients/route.ts`
- **Changes:** Swapped `include { tasks }` for a two-query model (clients projection + task batch), added single-pass reducers for categories/asset types/posting, and memoized `createdTasks` for the optional `includeTasks=true` path.

### `/api/tasks/agents` & `/api/tasks/agents?teamId=`
- **File:** `app/api/tasks/agents/route.ts`
- **Changes:** Introduced `BASE_AGENT_SELECT`, enforced projections in `findMany`, and added cache headers so repeated agent fetches leverage CDN/server cache.

### `/api/clients/:clientId?view=distribution`
- **File:** `app/api/clients/[id]/route.ts`
- **Changes:** Added `buildClientSelect(compact)` helper and honored `view=distribution` to skip task/team relations and progress recalculation; the distribution page now fetches `/api/clients/:id?view=distribution`.

### `/api/tasks/client/:clientId`
- **File:** `app/api/tasks/client/[clientId]/route.ts`
- **Changes:** Converted to a `select` query with only the task fields needed by the UI, keeping sort order and nested selects intact.

### `/api/tasks/distribute` (POST / PUT)
- **File:** `app/api/tasks/distribute/route.ts`
- **Changes:** Pre-computed per-agent assignment counts, used `upsert` for `clientTeamMember` updates, and applied delta maps plus `updateMany` to avoid sequential fetch/update patterns in both post and bulk put flows.

## Frontend Touchpoint

`app/[role]/distribution/client-agent/[clientId]/page.tsx` now calls:
```ts
useSWR(clientId ? `/api/clients/${clientId}?view=distribution` : null, jsonFetcher)
```
to align with the new compact response.

## Validation

Manual tests still required:

1. Load `/[role]/distribution/client-agent/[clientId]` and ensure client header + task list render correctly.
2. Trigger `/api/tasks/distribute` POST and PUT flows (bulk + single reassignment) and confirm counters/notifications behave as expected.
3. Hit `/api/tasks/clients?includeTasks=true` and `/api/tasks/clients` without the flag to confirm payload structure stays backwards-compatible.
