# Journas monetization staging

Status: IMPLEMENTATION VERIFIED IN ISOLATED STAGING; external provider connections remain UNRESOLVED. Do not describe actual checkout, email delivery, AdSense approval or physical-phone keyboard testing as completed.

- Branch: codex/monetization-staging. Regular production remains frozen.
- Vercel project: journas-monetization-staging; URL https://journas-monetization-staging.vercel.app .
- Firebase project: journas-monetization-2026, Auth and Firestore eur3, isolated service account and four allowlisted test accounts.
- Regular production baseline dpl_AxsppyAijfMhLdQqBftpBUpSeA1X was checked again on 27 October and is unchanged.
- Billing is Sandbox only; ads are mock only. Exact Firebase project and build/runtime configuration guards reject accidental production services.
- Resume happened at 01:00 Asia/Jerusalem on 27 October after checking quota (96% primary remaining). Heartbeat journas-01-00 was deleted after successful resumption, as instructed. No reset credits consumed.
- Main implementation commit 5281875; lifecycle/tutorial completion 34fb95c; paid guide labels and popover ad suppression c4d6393. Check git log for final delivery/retention-test follow-up.
- Implemented catalog, all approved prices/limits, owner/personal enforcement, shared roles, transaction quotas/history, downgrade selections, retained appearance, badges/SVGs, upgrade, emoji tiers, isolated tutorial, signed billing events/Paddle.js, retention projection/cleanup/notices and mock placements.
- New fixes: early renewal retains old tier/cadence until the paid boundary; cadence preview preserves the existing billing date; replayed/stale previews are rejected; expired subscriptions retain portal identity; owner billing/settings updates refresh realtime expiry; overlapping cron invocations lease email work; test-only emails do not block the queue.
- Verification: 400 unit/source tests pass; 21 emulator-dependent tests skipped in that run. Separate targeted Auth/Firestore/rules/monetization emulator run: 16 pass. 20 live API checks pass. Prior browser tests cover three tiers and 360/390/430 widths. Full 29-stage guide completed, plus focused final proximity Next/label checks, real realtime synchronization without reload, and preserved legacy pins with persisted selection/removal.
- Icons verified visually at 16/20/24px in light and dark.
- Guide exit restores 3 real tourist trips and 0 home pins. Temporary traveler pin fixture was restored and confirmed to show 4 remaining pins; realtime task fixture was restored.
- Private credentials are only in ignored STAGING_ACCOUNTS.local.md / staging-credentials.local.json. Never print keys or deploy local/env files. Auth proxy keeps Firebase Web credential server-side.
- Deliverables: MONETIZATION_DELIVERY.md, MONETIZATION_SETUP.md, ADVERTISING_RESEARCH.md. Local JSON evidence and screenshots under C:/Users/alont/.codex/visualizations/2026/10/26/01a179a9-fd4b-7091-8a0a-7be4306b1df9 .
- External tasks: Paddle Sandbox account, products/prices/client token/API and webhook secrets, then real provider lifecycle acceptance; separate SMTP and actual authorized inbox delivery; AdSense/CMP approval before any real ads. No production rollout or real payments authorized for this implementation.
- Remaining device limitation: viewport tests do not establish physical-phone touch/OS keyboard behavior.
- Final code deployment READY: dpl_3gbixknWmppNBqfRk1orYYQiLYYs (implementation commit a16f7b2). Mobile dialog ad scroll flow and background suppression verified; desktop unit rendered through a body portal to avoid clipping by modal overflow.


## 27 October UI follow-up
- Removed the top testing notice (staging isolation, noindex, Sandbox/mock guards remain in place).
- Restyled upgrade using Journas surface/ink/line/accent tokens and its map background, consistent rounded buttons and aligned annual/monthly pricing blocks.
- Compact noninteractive plan symbols replace verbose upgrade requirements; included tiers disappear outside the tutorial. Home profile badge is horizontal.
- Home desktop ad sits below account actions without reducing content width; home ads remain visible and dimmed behind menus/dialogs, alongside eligible modal ads.
- Upgrade action is independent and left of the date picker, with a slow uneven accent halo; Ctrl+= schedule shortcut removed from handler/help/tutorial.
- Payment-management email queue added per paid transaction: cancel link for paid plans and an additional traveler downgrade link for adventurer. Links require sign-in and confirmation. SMTP/Paddle delivery remains externally unverified.
- Verification: full suite 403 pass / 0 fail / 21 pending, plus fourth focused billing-mail test passes (transaction retry deduplication); live IAB checks of all three tiers, advanced-color access, paired icon marks, menus/ads, dark/light upgrade and 360/390/430 widths. Actual physical phone not tested.

## Production-project Git isolation (27 October)
- The production Vercel project `journas-trip-planner` now has a project-level Ignored Build Step that exits 0 only when `VERCEL_GIT_COMMIT_REF` is exactly `codex/monetization-staging`; all other refs exit 1 and retain normal build behavior.
- This setting is scoped to production project `prj_gwUEDAaOWfIF8ihEGiskovutznbU`; it is deliberately not placed in shared vercel.json. The separate staging project, Firebase configuration and deployed application are unchanged.
- Vercel may show these skipped Git previews as CANCELED rather than removing their deployment records. They must not run the application build or fail its staging environment guard.
- Production remains `dpl_AxsppyAijfMhLdQqBftpBUpSeA1X`; staging remains `dpl_FojJ8qxY8LgL6PXb3kpajXCSSu1h`. Re-read and verified the production target after saving the setting.
