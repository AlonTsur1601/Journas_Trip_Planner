---
doc: spec
status: approved
---

# Tevel — Technical Specification

## How This Works, In Plain Language

The browser displays a trip's places, time blocks, and tasks. Firebase identifies the person; the server checks that they may change the trip before storing an edit. Firestore sends changed planning data to other authorised open browsers. Each person separately saves their panel layout. A daily cleanup removes expired personal memberships; it deletes shared planning data only after nobody retains the trip.

## Where It Runs and How Someone Tries It

React/TypeScript/Vite frontend, Vercel server functions, Firebase Authentication and Firestore Spark, MapLibre/OpenFreeMap. See the canonical [setup guide](../README.md) for executable commands, emulator operation, and Firebase/Vercel configuration. Target repository: https://github.com/AlonTsur1601/Tevel_Trip_Planner. Target Vercel project name: `tevel-trip-planner`; deployment status must be verified rather than inferred from that name.

## Components

### Authenticated Planner Shell

Implements `prd.md > Trips and Dates` and `Personal Workspace and Persistence`. The header selects trips/dates, opens the month grid and settings, and displays save status and the active clock zone. Date changes await/save outgoing work safely. On a fresh visit choose today's date; layouts use a per-user/trip/date namespace.

### Map, Schedule, and Tasks

Implements `prd.md > Places and Connections` and `Schedule and Linked Tasks`. MapLibre draws editable markers, gradient lines/arrows, and notes. The schedule places start/end intervals vertically with overlap handling and the current-time line. Tasks preserve links until targets disappear. Store inheritance overrides explicitly so a deliberate change is distinguishable from a copied value.

### Persistence and Live Updates

Implements `prd.md > Sharing and Collaboration`. Writes use authenticated API requests, bounded validated payloads, and transactions checking version and membership. Listen only to the active authorised planning day. Compare field versions before saving and return conflict details for an explicit user decision. Queue failed changes locally under the signed-in account; clear subscriptions and private state on sign-out/access loss. Save layout periodically and on navigation; viewing empty dates must perform no day-creation write.

### Membership, Sharing, and Cleanup

Implements `prd.md > Retention and Deletion` and `Limits and Settings`. A shared trip stores one content tree and separate account memberships. Owner identity is immutable across personal auto-removal. Random share capabilities are stored as hashes, scoped to view/join and revocable. Membership/trip-count updates are transactional. Nonowner manual and all automatic removals revoke only personal membership/layout data. Owner manual deletion marks the shared trip deleted and invalidates access before bounded physical cleanup. Recheck authorisation on every mutation so stale clients cannot resurrect deleted trips.

### Settings and Clock

Implements `prd.md > Limits and Settings`. Account preferences default to system theme, purple accent, and one-year enabled retention. Profile image uploads are decoded, resized, and bounded; public URL entry is validated. Resolve place coordinates to an IANA zone; retain explicit manual overrides. Store planning times with their zone and flag nonexistent/ambiguous DST times. Run periodic clock updates while visible; label the active zone.

## Data Model

Conceptual data: users/preferences; immutable trip owner plus dates/name/status; personal memberships; sparse day content with pins/connections/blocks/tasks and item/field versions; personal date layouts; hashed share grants; bounded cleanup/rate-limit bookkeeping. Runtime interfaces and collection names in source are authoritative and must remain consistent with this model. A day absent from storage renders defaults; its first actual edit creates data. Reading a trip does not increase its user's saved-trip count.

## File Structure

```text
src/                 # React interface, authenticated client, planner and settings
server/              # Authenticated operations, schema/limits, persistence, cleanup
api/                 # Vercel request handlers
tests/               # Behaviour, permissions, and integration verification
devpost/             # Scope, PRD, specification, checklist, submission materials
docs/                # Setup and operational guidance
README.md            # Canonical run/configure/deploy instructions
.env.example         # Placeholder configuration; never real credentials
```

## External Services

- [Firebase Authentication](https://firebase.google.com/docs/auth/web/start): Google/email sign-in; verified Firebase ID token on the server.
- [Firestore](https://firebase.google.com/docs/firestore): transactional persistent data and live subscriptions; [security rules](https://firebase.google.com/docs/firestore/security/get-started).
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite): local integration and rule verification without production writes.
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) and [OpenFreeMap](https://openfreemap.org/quick_start/): rendered map, required visible attribution.
- [Vercel](https://vercel.com/docs) and [Cron](https://vercel.com/docs/cron-jobs): hosting, server operations, authenticated daily retention. Firebase Functions/Cloud Scheduler are not needed and must not be enabled through billing.

## Failure Modes and Security

Missing Firebase configuration disables cloud sign-in with setup guidance. Network/quota failures show pending/error state without claiming a save. Read-only links cannot mutate or join unless enabled. Access revocation drops reads and mutations. Use same-origin APIs, ID-token checks, escaped text, upload/type/size limits, and rate controls. Never include server private keys in `VITE_` variables, code, logs, or screenshots. Maintain sparse writes/subscriptions and bounded cron pages to stay within shared free quotas.

## Decisions and Open Issues

The displayed stack and full product plan were approved. Firebase/Vercel account configuration and user eligibility/learning reflections still require actual evidence. Tests, deployment links, and completed checkpoints are recorded only after observed execution; no artifact implies completion by existing alone.
