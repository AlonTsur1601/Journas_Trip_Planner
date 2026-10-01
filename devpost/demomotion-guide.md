# DemoMotion — exact input and recording plan

The public HTML at [DemoMotion WebMCP](https://demomotion-ai-web-c73vaqorlq-an.a.run.app/webmcp) was read on 1 October 2026. It exposes `Product URL`, `Goal`, `Narration language`, `Aspect ratio`, and `Create draft`. No draft or video was created. Generation limits, credits, authenticated recording support, and final exported duration must be checked inside the service rather than assumed.

## Paste into the first form

**Product URL:** `https://tevel-trip-planner.vercel.app`. Sign in with your own test account before recording. A remotely hosted recorder cannot use localhost.

**Goal:**

```text
Create an approximately 2 minute 30 second English narrated demo of Tevel, a collaborative trip planner. Use real recorded product interactions, with concise captions and a clean 16:9 screen recording. Show one coherent holiday-planning flow: open the daily workspace; create or select a trip; add two map pins with different colours, symbols, and notes; connect them with a gradient arrow; schedule a visit linked to a pin and show its inherited title, note, colour, and symbol; add and complete a task linked to that visit; resize the map/schedule split and move the floating checklist; switch dates and return to demonstrate saved planning and layout; open a join-enabled share link in a second signed-in account and show a live edit reaching the first account without a refresh. Finish with clock/theme settings and explain that automatic one-year removal is personal while an owner's manual delete affects everyone. Show only features that work in the actual session. If authenticated recording or two accounts cannot be captured, use supplied real browser recordings instead of inventing scenes. Keep the export below three minutes. Hide email addresses, credentials, private share tokens, and unrelated browser content. Use no copyrighted music or third-party branding beyond permitted product/map attribution.
```

**Narration language:** `English` (`en-US`).

**Aspect ratio:** `16:9 landscape`.

Then press **Create draft**. Inspect and adjust the generated scenes to match the recorded working product. DemoMotion generating polished scenes is not evidence that a feature was implemented or tested.

## Storyboard and narration draft

Use a prepared fictitious trip, such as “Lisbon weekend”, with no real travel plans/personal details. Sign in before recording. The demo does not need to expose a login credential or email verification flow. Narration is a technical product walkthrough prepared at the creator's request, not a claim about their personal learning.

| Time | Real action | Narration |
|---|---|---|
| 0:00–0:15 | Open Tevel's daily map/schedule workspace | “Tevel brings your places, time, and tasks together for every day of a trip.” |
| 0:15–0:40 | Create/select trip and date; add two pins, colours/symbols/notes | “Choose a trip and a day. Add places to the map, give each one its own identity, and keep useful notes one click away.” |
| 0:40–0:55 | Draw a gradient arrow between pins | “Connect your stops to make the day's plan easier to follow.” |
| 0:55–1:15 | Schedule linked visit, add independent block, show inherited fields | “A scheduled visit starts with the place's name, notes, colour, and symbol. You can adjust any detail or add time blocks without a location.” |
| 1:15–1:30 | Add linked task, check it, reveal strike-through | “Keep preparation beside the plan. Tasks can link to a place, a time block, both, or neither.” |
| 1:30–1:50 | Resize split/move tasks; switch date and return | “Arrange the workspace for the way you plan. Each day remembers your layout, and your view stays personal.” |
| 1:50–2:15 | Two actual accounts; read-only link, explicit join, live edit | “Sharing starts with a read-only view. Join-enabled links let travellers become editors. Changes appear in the shared trip without reloading.” |
| 2:15–2:30 | Settings and final product view | “Choose your clock and theme. Old trips are automatically removed from your account after a year, without removing them for other travellers. Tevel keeps the whole day's journey in one place.” |

If the real workflow needs more time, cut transitions rather than accelerating unreadable text. Include a final simple product title and verified URL. Preserve visible required map attribution.

## Export and submission

Watch the whole export: verify readable actions, English narration, actual live edits, and duration under 3:00 (target 2:30). Export the supported video format and upload it to YouTube or Vimeo with **public** visibility. Check playback in a signed-out/private browser and paste the resulting URL into Devpost's video field. The DemoMotion draft URL or downloadable file alone does not satisfy the rules.
