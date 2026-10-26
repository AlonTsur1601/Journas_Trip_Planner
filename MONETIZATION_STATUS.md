# Journas monetization staging

Status: implementing; user requested an intentional stop around 5% remaining and independent resumption at 01:00 Asia/Jerusalem if needed.

- Branch: codex/monetization-staging. Regular production must remain frozen.
- New Vercel project created: journas-monetization-staging.
- Firebase project journas-monetization-2026, Auth, Firestore eur3, rules/indexes and four test accounts are provisioned.
- Live URL: https://journas-monetization-staging.vercel.app . Regular production baseline dpl_AxsppyAijfMhLdQqBftpBUpSeA1X was unchanged at last comparison.
- Billing must remain sandbox; ads must remain mock.
- Heartbeat journas-01-00 resumes after either a usage interruption OR the requested 5% cutoff. Check usage before working; do not consume reset credits.
- Implemented: shared plan catalog, server policy including history, quotas/dates/appearance, badges/custom SVGs, upgrade route, fixed test plans, sandbox billing adapter/webhook, retention queue, mock inventory, tutorial entitlements and paid substeps.
- Private Firebase credential stays server-side via auth proxy. Email/password works, Google login/linking is deliberately disabled in staging. Credentials are in STAGING_ACCOUNTS.local.md (ignored); never expose any API key. Do not deploy *.local* or .env*.
- Verification: 385 unit/source tests passed, 19 emulator tests skipped in that run; separate targeted emulator run passed 14 tests including competing quota joins/creations, Auth HTTP and rules. 20 live API checks passed; browser script passed 10 grouped checks for all three tiers and widths 360/390/430.
- Browser evidence: C:/Users/alont/.codex/visualizations/2026/10/26/01a179a9-fd4b-7091-8a0a-7be4306b1df9 . Scripts qa-monetization.local.mjs, qa-guide.local.mjs, verify-monetization-live.local.mjs; JSON evidence files are ignored.
- Setup guide MONETIZATION_SETUP.md and advertising research ADVERTISING_RESEARCH.md exist.
- Pending: inspect running guide smoke result; complete full guided-tour runtime acceptance and any defects, strengthen billing simulated lifecycle tests/retention warnings, final regression/deploy/baseline check and code checkpoint. Do not claim the full plan finished while these remain.
- External dependencies: Paddle Sandbox account/prices/webhook secrets and separate SMTP are not connected. BILLING_NOT_CONFIGURED is verified instead of fake purchase success. Real AdSense is not approved or loaded; all ads remain mock and unsuitable navigation/settings screens are excluded.
