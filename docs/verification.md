# Verification — 1 October 2026

Evidence is separated by environment. A build alone is not counted as product verification.

## Automated checks

- `npm test` with both Firebase emulator host variables: **5 suites, 34 tests passed**. These exercise real Auth emulator tokens, Firestore Admin transactions, protected client snapshots/rules, personal/global deletion, orphan cleanup, expired rate limits, quota, sparse days, independent layouts, inheritance/detachment, field conflicts and DST.
- `npm run build`: TypeScript and Vite production build passed.
- `npm install` audit: **0 known vulnerabilities** in the locked dependency graph.

## Production service

`scripts/verify-live.mjs` called the deployed HTTPS API using two actual Firebase accounts with verified email flags. Output:

```json
{"deployedApi":true,"verifiedAccounts":2,"authentication":true,"sharing":true,"conflicts":true,"personalRemoval":true,"ownerDeletion":true,"automaticOwnerRemoval":true,"automaticParticipantRemoval":true,"orphanCleanup":true,"cleanupAuthentication":true}
```

It verifies unauthenticated denial, email/password login, trip creation, public share preview, editor joining, shared writes, stale-field rejection (409), personal removal preserving the other account's content, access denial after removal, explicit rejoining, and owner deletion invalidating the share.

Firestore rules were published and the release checked. The `trips.cleanupAt` collection-group index was confirmed configured after the creator enabled it. The production hostname is authorized in Firebase Authentication. Private credentials are in Vercel server environment variables and an external local file, never deployment source files.

## Browser evidence

The actual planner was exercised with email/password authentication, trip creation, custom place notes/symbols/colors, gradient connections, linked visits, linked checked tasks, destination-clock settings, date navigation, saved layouts and recovered local drafts. Emulator and production observations are identified below as further checks finish.

- Emulator: recovered a previously failed draft after reopening; saved it successfully. Completed tasks have strike-through. Switching to an untouched day restored the default panels; returning restored the previous checklist and content.
- Emulator: a native time-input event did not consistently reach the controlled React state during filling. Explicit `onInput` handling fixed it; changing 10:00 to 11:00 was observed in the saved timeline as 09:00–11:00.
- Emulator: 390×844 responsive check; document width and scroll width both 390. Trip/date controls and checklist remained reachable.
- Production: signed in through the real form and created a five-day trip, two places, a gradient arrow and a linked visit. Map tiles rendered with visible attribution.
- Production backend with two separate browser origins: the second account used a local frontend pointed at the production API/Firestore to keep its login separate. The share opened read-only, the participant signed in and explicitly joined. Their place-note edit reached the production owner's interface and inherited visit without a refresh. Revoking the participant's access cleared their interface while preserving the owner's plan. The local frontend is not presented as a second deployed site.
- Production: native time and color input changes were saved and reread, a completed linked task survived reload, and date switching restored the personal checklist/map/split. Dragging and resizing the checklist kept the toolbar visible.
- Final production camera check: after zooming, both marker transforms were identical before date navigation and after returning. Programmatic restoration/resize events no longer overwrite a saved day's camera.
- Final production mobile check: 390×844 viewport, document width 390, reachable trip/date controls, map and schedule. Icon-only panel and trip buttons have accessible names. The six gallery JPEGs show production with fictional QA data; no share tokens or credentials appear.
- Conflict UI: two accounts changed the same place note. The second save displayed the draft and latest value for explicit selection. Choosing the latest version cleared the old pending draft, confirmed after reload.

## Creator-dependent verification and submission

Google login with the creator's real Google account, delivery of real verification/reset emails, personal learning/survey answers and eligibility confirmation require the creator. Synthetic test accounts verify the server's verified-email gate, not delivery to a real mailbox. The final video must be exported and published to YouTube/Vimeo by the creator. No Devpost submission has been made.

The actual production cleanup endpoint was invoked with its secret: an already-expired synthetic trip lost its owner's membership while the other participant retained access and original ownership metadata. After the last participant removed it, cleanup purged the trip. Unauthorized cleanup was rejected. The next automatic scheduled invocation has not been observed; a manual authenticated invocation does not prove scheduler delivery.
