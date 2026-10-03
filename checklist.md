---
doc: checklist
status: approved
---

# Journas — Build Checklist

Build mode: fast. The creator explicitly approved the displayed complete plan and requested implementation. Checkboxes below represent demonstrated verification, not intended capabilities.

## Slices

- [ ] **1. Plan a day with connected places, visits, and tasks**
  Becomes usable: A running planner with pins, connections, inherited schedule blocks, and linked completed tasks.
  Why now: Demonstrates the distinctive map/time/task loop before polishing peripheral flows.
  PRD ref: `prd.md > Places and Connections`, `Schedule and Linked Tasks`
  Spec ref: `spec.md > Map, Schedule, and Tasks`
  Build: Deliver the connected workspace, editing/deletion, schedule overlaps, and all panel combinations.
  Verify (mechanical): Typecheck/build, focused inheritance/detachment tests, real browser create/edit/delete/link flow and mobile layout.
  Learner check: Create a holiday day, add two places and a visit, link/check a task, resize the split and task panel.
  Commit: `Build connected daily planning workspace`

- [ ] **2. Sign in and restore each day's personal workspace**
  Becomes usable: Authenticated saved trips, today on fresh opening, sparse day persistence, profile/preferences, saved layouts and clock.
  Why now: Proves the central loop persists honestly before collaborative access is introduced.
  PRD ref: `prd.md > Trips and Dates`, `Personal Workspace and Persistence`, `Limits and Settings`
  Spec ref: `spec.md > Authenticated Planner Shell`, `Persistence and Live Updates`, `Settings and Clock`
  Build: Google/email auth, verification/reset, calendar/date bounds, layout save/navigation, drafts and settings.
  Verify (mechanical): Emulator authenticated round trip, no empty-day writes, browser reload/date switch, network interruption and DST tests.
  Learner check: Switch dates and reopen; confirm today's selection and each date's restored layout.
  Commit: `Persist authenticated trips and personal layouts`

- [ ] **3. Collaborate safely and remove trips with the correct scope**
  Becomes usable: Read-only/join links, live edits, conflicts, revocation, 100-trip enforcement and personal/global removal.
  Why now: Access and deletion are the largest shared-data risks and need independent multiaccount evidence.
  PRD ref: `prd.md > Sharing and Collaboration`, `Retention and Deletion`, `Limits and Settings`
  Spec ref: `spec.md > Membership, Sharing, and Cleanup`, `Persistence and Live Updates`
  Build: Transactional membership/limits, hashed revocable grants, versioned writes, live access loss and authenticated daily cleanup.
  Verify (mechanical): Two accounts/two browsers, denied foreign reads/writes, same-field conflict, expired/revoked links, five deletion scenarios, stale-save rejection, quota boundary.
  Learner check: Join from another account, observe an edit without refresh, personally remove, and confirm the original account still has the trip.
  Commit: `Add secure live collaboration and personal retention`

- [ ] **4. Publish and prepare the complete submission package**
  Becomes usable: Public repository, verified Vercel deployment, truthful docs, product screenshots and video instructions.
  Why now: Submission claims must describe the final tested product.
  PRD ref: `prd.md > The Core Journey`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `Failure Modes and Security`
  Build: Audit intended public files/history, finish setup documentation/assets, deploy and collect verification evidence.
  Verify (mechanical): Clean-install documented commands, final production auth/core flow, public repo/license, secret audit, no fabricated screenshots/links.
  Learner check: Open the deployed app and review screenshots/video; supply actual personal survey answers and eligible-user confirmation.
  Commit: `Publish Journas and document submission workflow`

## Hands-on Checkpoints

- [ ] Early connected workspace feedback completed
- [ ] Integrated live collaboration and removal feedback completed
- [ ] Final kick-the-tires feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — actual guided route, focused alternative, prior practice, or recap recorded
- [ ] Optional edit and transfer reflection addressed
- [ ] `devpost/app-map.html` generated from final code, checked, and shown

Activity and evidence: Not completed; no learning/mastery claim is made.
Route and stops: To be linked to the finished source files.
Edit outcome: Not established.
Reflection: User's personal reflections are not supplied.
Activity mode: To be recorded when performed.

## Revisions

- Automatic removal defaults to one year and affects only the current account; owner manual deletion alone is global — explicit user revision to the original retention plan.

## Mechanical verification record — 1 October 2026

These checks are separate from the creator's hands-on learning confirmations above.

- [x] Five automated suites / 34 checks pass, including Auth/Firestore emulators, rules, conflicts, quotas, deletion boundaries, sparse days and DST.
- [x] Two-account production API verification passes all personal/global removal and orphan-cleanup scenarios.
- [x] Actual browser planning, linked inheritance, checked tasks, sharing/joining, live edit/revocation, conflict resolution, date/layout restoration and mobile checks recorded in the locally maintained verification report (not published).
- [x] Public MIT repository, production deployment, setup guides, six real product images and exact DemoMotion instructions prepared.
- [ ] Creator's real Google sign-in and mailbox delivery confirmed.
- [ ] Creator's learning activity, eligibility/survey responses, public final video and Devpost submission completed.

Code routes are documented in `devpost/app-map.html` and `devpost/learning-record.md`. Their existence does not establish a learning checkpoint or creator sign-off.
