# Build and learning record

This records observed collaboration, not a claim of mastery or a substitute for the creator's exit survey.

The creator defined the complete trip-planning product and approved the React/TypeScript, Firebase Spark, Vercel, MapLibre and OpenFreeMap implementation plan. They explicitly revised retention: automatic removal is enabled after one year and remains personal even for owners; only an owner's manual deletion is global.

The creator created the Firebase project and Web app, kept the downloaded private service-account key outside the repository, configured sign-in and the database, and enabled the collection-group cleanup index. They asked who could see the Google sign-in support email; official documentation confirmed it is visible on the consent screen. The setup guidance was adjusted to the creator's actual Firebase console labels, Manual and Automatic.

Codex implemented and verified the product using skills `1-start` through `6-ship`. Testing found a deployment-only CommonJS/ESM dependency incompatibility, native time/color input state issues, and a floating panel that could move the toolbar out of view. Corrections were tested through real API/browser paths. These findings illustrate why successful compilation alone does not prove the product works.

## Follow an actual edit

1. In `src/App.tsx`, an editor calls `mutate` with only changed fields and their baseline versions.
2. `src/firebase.ts` attaches the signed-in account's Firebase ID token to `/api/origin`.
3. `server/http.ts` verifies the identity and email status and limits request size/rate.
4. `server/service.ts` checks active trip membership, validates links and performs a transaction with field-version comparisons.
5. `server/store.ts` commits the buffered mutations. Authorised Firestore snapshots deliver them to participants' interfaces.
6. `firestore.rules` restricts reads to verified retained members and rejects direct browser writes.

See [the app map](app-map.html) and [verification report](../docs/verification.md). The creator's personal reflection, confidence rating, actual event participation and eligibility remain for the creator to supply.
