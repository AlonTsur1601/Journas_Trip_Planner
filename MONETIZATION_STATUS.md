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
- New fixes: early renewal retains old tier/cadence until the paid boundary; cadence-preview boundary assumption was disproved on 31 October (see investigation below); replayed/stale previews are rejected; expired subscriptions retain portal identity; owner billing/settings updates refresh realtime expiry; overlapping cron invocations lease email work; test-only emails do not block the queue.
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

## Staging refinements (28 October)
- Basic emoji sort first; free accounts cannot open or search the emoji catalog, paid locked actions stay inert, and marked staging demo copies are grouped in the trip selection interfaces while data remains separate.
- Manual save forces a fresh layout write; spinner geometry uses a square box and centered transform origin.
- Validation: local tourist and traveler checks, two consecutive manual saves, spinner geometry, grouped trip menus and 30 focused tests. Live staging and production verification follow deployment.
## Paddle investigation — 31 October 2026

- Reproduced the billing-account monthly-to-yearly preview rejection against real Paddle Sandbox. Provider reason: `not possible to change items and billing date in the same request` (HTTP 400).
- Removing the explicit date alone is NOT a valid fix: Paddle previews a new annual billing period starting now with no immediate charge, and next payment one year later. Journas had advertised the existing monthly paid boundary instead.
- Current staging rejects cadence previews unless both Paddle next_billed_at and next_transaction.billing_period.starts_at preserve the existing paid boundary and there is no immediate transaction. Legacy cadence previews without verification cannot be confirmed.
- Sandbox preview matrix: traveler/year and adventurer/year expose that schedule mismatch; adventurer/month previews a $5 prorated charge and $9.99 renewal, with the existing renewal boundary retained. These were PREVIEWS ONLY: no subscription change, charge, cancellation or provider update was executed. Billing state checked unchanged afterward.
- Safe provider error code/reason/request ID diagnostics are now retained; credentials and email strings are redacted.
- Pending: implement and verify a provider-compatible deferred cadence-change workflow. Do not claim cadence switching or future actual renewal billing is working. Sandbox preview success alone is not end-to-end payment acceptance.

## Combined cadence implementation - 31 October 2026

Supersedes the blocked-cadence investigation above. The workflow persists an intent and performs two separate do_not_bill provider updates: items first, then the original next_billed_at. It verifies both target items and renewal boundary before recording pendingPlan/pendingInterval. Leased jobs resume ambiguous failures from billing.status or reconciliation without repeating an applied item update. Paid access stays unchanged until payment confirmation. Reconciliation of the last paid transaction cannot clear the scheduled change.

Live Sandbox round-trip PASSED: traveler/month to adventurer/year quoted $0 now and $99.99 at the original renewal, confirmed at Paddle, then restored via traveler/month quoted $0 now and $4.99 at the same boundary. Final account has its original plan, cadence, periodEnd, lastPaidTransactionId and no pending change. No real payment or production service was used. Actual collection at a future renewal remains untested.

428 automated tests passed (22 skipped), including switches in both directions, upgrades/downgrades, lost provider responses, recovery after step two fails, replay rejection, paid-entitlement gating and duplicate transaction reconciliation. UI quote includes amount due now, next payment and date.

## End-of-paid-period policy and change emails - 31 October 2026

Latest user policy supersedes immediate/prorated upgrades: ALL existing-subscription plan and cadence changes take effect only at the paid boundary. Every paid-plan change uses do_not_bill, a verified zero-immediate-charge quote and the recoverable scheduling workflow, even when cadence is unchanged. Cancellation retains access until paid expiry.

Dated scheduled-change notices are queued atomically only after successful scheduling, with previous/new plan, cadence, UTC effective date, no-charge-now statement, quoted next amount and management links. Restoring the current plan generates a scheduled-change-canceled notice. Receipts also explain the end-of-paid-period policy. Successful confirmations attempt mail dispatch; cron retries failed sends. SMTP is still not configured, so actual delivery is NOT verified.

Live Sandbox same-cadence round trip PASSED: traveler/month to adventurer/month quoted $0 now, $9.99 at the original 30 November renewal, preserving current traveler access, then restored traveler/month ($4.99) with no pending change and original paid transaction. Read back both generated mail records and verified dates, amounts and text; records remain pending because SMTP is disconnected. Automated suite: 434 passed plus an additional passing cancellation case (435 total expected on next full run).

## Immediate paid upgrades - 31 October 2026 (current policy)

Supersedes the all-deferred policy above: higher-tier upgrades charge the unused-period difference immediately and grant the new tier only after verified successful payment. Downgrades, cancellations and same-tier cadence-only changes retain paid access until the original period ends. Combined higher-tier and cadence upgrades are supported.

Fallback for previously modified Sandbox subscriptions without Paddle proration metadata uses a verified paid-transaction unused-period credit, restricted to the target price and one billing interval; it is removed after the paid upgrade so renewals retain their normal price. Discounts read/write permission is configured. No public coupon is exposed.

Live staging Paddle Sandbox previews verified: traveler/month to traveler/year $0 now / $49.99 renewal at original boundary; adventurer/month $4.98 now / $9.99 renewal; adventurer/year $95.02 now / $99.99 renewal. Current subscription plan, cadence and paid boundary remained unchanged. These were previews only; no payment was submitted in this check. Automated suite previously passed 438 tests (22 skipped); final focused billing run passed 16 tests and build succeeded.

Top overview card features follow the same relative order across plans. Code commit 9d3fde7 is deployed READY to journas-monetization-staging.vercel.app (dpl_AejMPYr9mVruozoDiz2X431Y7agp). Production remains outside this work. SMTP remains unconfigured; actual email delivery is unresolved.
