# Journas monetization staging

Status: stopping intentionally near the user's 5% remaining usage threshold; INCOMPLETE. Resume independently at 01:00 Asia/Jerusalem on 27 October 2026 after checking quota. This qualifies for heartbeat journas-01-00.

- Branch: codex/monetization-staging. Regular production must remain frozen.
- New Vercel project created: journas-monetization-staging.
- Firebase project journas-monetization-2026, Auth, Firestore eur3, rules/indexes and four test accounts are provisioned.
- Live URL: https://journas-monetization-staging.vercel.app . Regular production baseline dpl_AxsppyAijfMhLdQqBftpBUpSeA1X was unchanged at last comparison.
- Billing must remain sandbox; ads must remain mock.
- Heartbeat journas-01-00 resumes after either a usage interruption OR the requested 5% cutoff. Check usage before working; do not consume reset credits.
- Implemented: shared plan catalog, server policy including history, quotas/dates/appearance, badges/custom SVGs, upgrade route, fixed test plans, sandbox billing adapter/webhook, retention queue, mock inventory, tutorial entitlements and paid substeps.
- Private Firebase credential stays server-side via auth proxy. Email/password works, Google login/linking is deliberately disabled in staging. Credentials are in STAGING_ACCOUNTS.local.md (ignored); never expose any API key. Do not deploy *.local* or .env*.
- Verification: 388 unit/source tests passed, 19 emulator tests skipped in that run; separate targeted emulator run passed 14 tests including competing quota joins/creations, Auth HTTP and rules. 20 live API checks passed; browser script passed 10 grouped checks for all three tiers and widths 360/390/430. Guide smoke passed: free user starts tutorial, paid substeps visible, no visible ads, exit preserves real trip count.
- Browser evidence: C:/Users/alont/.codex/visualizations/2026/10/26/01a179a9-fd4b-7091-8a0a-7be4306b1df9 . Scripts qa-monetization.local.mjs, qa-guide.local.mjs, verify-monetization-live.local.mjs; JSON evidence files are ignored.
- Setup guide MONETIZATION_SETUP.md and advertising research ADVERTISING_RESEARCH.md exist.
- Checkpoint commit 5281875 contains the main implementation. Follow-up checkpoint contains the final date-cap/counter and lifecycle fixes; check git log/status before editing. Final staging deploy may still be running; require READY before claiming it is current. Production baseline comparison was again unchanged after the implementation.
- Pending: complete full 29-step guided-tour runtime acceptance (including required basic/full emoji, advanced color, copied place and simulated nearby highlighting) and any defects; strengthen scheduled downgrade/cadence and retention-warning lifecycle tests; finish final review/deploy/baseline check and delivery. Do not claim the full plan finished while these remain.
- Billing tests now include cross-entity out-of-order events, duplicate events, full refunds and seven-day grace. A bug where a subscription event could suppress an earlier paid transaction was corrected. Actual Paddle Sandbox checkout still requires account configuration.
- Latest small UI fixes show actual trip quota and owner-plan date limits; verify the final deployed create/edit-trip screens and mobile topbar. The original source had CRCRLF line endings: preserve unrelated lines and strip trailing CR only on newly changed lines if git diff --check complains.
- Local Vite/API sessions may be running on 5173/3001; use .env.staging.local only. No secrets in committed sources or browser bundle (scans passed). Do not print full firebase-admin errors: their nested request metadata can include ephemeral authorization headers; print only sanitized error code/name.
- External dependencies: Paddle Sandbox account/prices/webhook secrets and separate SMTP are not connected. BILLING_NOT_CONFIGURED is verified instead of fake purchase success. Real AdSense is not approved or loaded; all ads remain mock and unsuitable navigation/settings screens are excluded.
