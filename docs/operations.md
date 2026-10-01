# Origin — operations and verification

## Configuration ownership

The browser gets Firebase Web identification only. The API gets a private service-account credential. Vercel gets server secrets through its environment settings. The local ignored JSON and `.env.local` are never deployment source files. Restart local processes after changing local configuration; rebuild/redeploy when browser configuration changes.

Follow [README setup](../README.md) for the exact commands. Keep Firebase on Spark and Vercel on Hobby; this project must not silently enable billing.

## Daily retention

The authenticated `GET /api/cleanup` endpoint is invoked by the daily Vercel cron. A missing/wrong bearer secret receives an error; visiting its URL unauthenticated does not run cleanup. Inspect Vercel function/cron logs and Firestore usage after deployment. Cleanup is bounded so it does not attempt an unbounded database read or deletion in one server invocation. Any backlog must be monitored; a configured cron is not proof a particular trip has been removed.

Retention is personal: expired account membership/layout data are removed independently, while other members retain the shared content. An empty-member trip is marked inaccessible before recursive cleanup. The owner's intentional manual global deletion has a different code path and must be verified separately.

## Acceptance matrix

Record observed evidence and date for each check rather than converting this table into an assumed pass list.

| Scenario | Required observation | Evidence |
|---|---|---|
| Sparse dates | Opening an empty date creates no planning or layout record | Domain test passed; production empty-day UI checked |
| Personal workspace | Two users save different panel bounds; each restores their own | Independent layout test; production date/resize restoration checked |
| Inheritance | Linked visit inherits place fields; a manual override stays independent | Domain tests passed; live place-note inheritance observed in production |
| Detachment | Removing a place/block preserves tasks and standalone visits | Domain test passed |
| Read-only link | Viewer sees content; direct write is rejected | Real share preview UI and emulator rules passed |
| Live editing | Second account edit reaches first without refresh | Production browser owner + separate local frontend using production backend; observed shared note |
| Same-field conflict | Stale revision gets an explicit conflict rather than silent overwrite | Production HTTP 409 and browser conflict-choice dialog observed |
| Participant removal | Removing Bob's saved trip preserves Alice's shared content; Bob loses access | Production API passed; browser access revocation clears content |
| Owner automatic removal | Owner loses personal saved trip; another member retains content/ownership unchanged | Production cleanup test passed |
| Owner manual deletion | Everyone loses access; link is invalid and stale write cannot recreate data | Production API and emulator tests passed |
| Last member cleanup | Remaining shared records and grants are purged | Production Firestore absence asserted after cleanup |
| Trip quota | Warning at 80; creation and joining rejected at 100; personal removal restores a slot | Server boundary tests passed; warning/disable controls inspected in source |
| Clock/DST | Active zone always visible; line only on its current date; ambiguous/nonexistent times handled | Destination-clock browser check and DST tests passed |
| Network loss | Failed write stays visibly pending; navigation/reload does not silently discard draft | Recovered a failed-save draft in emulator browser and saved after reconnecting service |
| Production authentication | Actual Google and verified email login/reset work on authorised deployed domain | Email/password form passed; real Google login and mailbox delivery await creator |
| Mobile/browser | Planner controls and floating task bounds remain reachable | 390×844 browser check; desktop drag/resize and toolbar visibility checked |

The final checklist should link actual test outputs/browser captures and distinguish emulator from production. No row is passed just because its intended behaviour is documented.

## Troubleshooting

- **Firebase setup screen:** Web app identification is absent. Fill the four `VITE_FIREBASE_*` values and restart/rebuild.
- **`auth/unauthorized-domain`:** Add the exact frontend hostname in Firebase Auth authorised domains.
- **API unavailable/503:** Check the API process and private credential configuration; do not paste a key into logs or chat. Ensure browser/server project IDs match.
- **Verification required:** Complete the verification email and refresh the authentication session; emulator success is not proof of email delivery.
- **Firestore denied:** Confirm membership and published rules. Do not solve it with permissive test rules.
- **Emulator refused connection:** Start both Auth and Firestore emulators; client and server must explicitly use the same `demo-origin` project.
- **Cleanup denied:** Verify that Vercel has `CRON_SECRET` and that the caller is the authenticated scheduler.
- **Quota exceeded:** Inspect project-wide usage and retry after the provider's reset. Do not enable billing without a separate creator decision.

## Publishing safely

Review staged paths and history, not only `.gitignore`. Exclude private profile/context, `.env*` except the placeholder example, private JSON, account/session files, and unrelated working directories. Use allowlisted deployment files. Verify repository access signed out, final website behaviour, and public video playback before declaring the submission ready.
