# Origin — Devpost submission package

This is a preparation package, not a submitted entry. Product copy below is drafted at the creator's explicit request. Review it against the final working build before publishing; personal learning, residence, eligibility, and survey answers cannot be supplied by the agent.

## Authoritative requirements checked on 1 October 2026

The authenticated Devpost Hackathons connector returned the complete submission requirements for `learn-ai-basics` (event 30447). The unchanged response is in [submission-requirements.json](submission-requirements.json). General project limits were read from the connector's current create/update/upload tool descriptions. The authenticated browser form itself has not been inspected; any additional browser-only prompts must be checked when opening the submission editor.

Sources: [event](https://learn-ai-basics.devpost.com/), [official rules](https://learn-ai-basics.devpost.com/rules), [resources](https://learn-ai-basics.devpost.com/resources). The rules take precedence over the overview: prepare an English working-product video of about 2:30, publicly viewable on YouTube or Vimeo, and a public licensed source repository containing `scope.md`, `prd.md`, and `spec.md`. Website and ZIP are not required by the returned deliverables. A deployment does not replace the video.

The eligibility checkbox confirms age of majority, all teammates' eligibility, and a new project made during the submission period using the Devpost Learn Skill Pack. Its truth is not verified; the creator must personally review the rules before checking it. The event's listed submission deadline is 26 October 2026, 17:00 EDT (21:00 UTC).

## General project fields and prepared values

| Field | Prepared value / action |
|---|---|
| Project name (maximum 60 characters) | `Origin` |
| Elevator pitch / tagline (maximum 200 characters) | `Plan every day of your trip with a connected map, schedule, and checklist. Share the journey and build your itinerary together in real time.` |
| Full project description (maximum 50,000 characters) | Review the English draft in [submission-copy.md](submission-copy.md); fill the personal learning paragraph yourself. Remove any unverified feature claim. |
| Built with (maximum 25 tags) | `React`, `TypeScript`, `Vite`, `Firebase`, `Firestore`, `MapLibre`, `OpenFreeMap`, `Vercel`, `Codex` — verify these match the final repository. |
| Source repository link | `https://github.com/AlonTsur1601/Origin_Trip_Planner` — verify unauthenticated access before submission. |
| Website link | Use the actual verified production URL from the deployment result. `origin-trip-planner` is the requested project name, not evidence of an available URL. |
| Video URL | Paste the final public YouTube/Vimeo URL; no video has been uploaded by preparing this guide. |
| Thumbnail | Use `devpost/assets/cover.png` once generated and visually checked. |
| Image gallery | Use the real screenshots listed below once captured and checked. |
| Testing instructions | See the block below; change the URL only after verified deployment. |

### Testing instructions (English copy)

Open the deployed Origin website in a desktop browser. Create a free account using Google or email and password, and verify your email if prompted. Create a trip with a date within the next year. Add two map pins, assign a scheduled visit to one pin, and create a linked task. Switch dates and return to check that your planning and workspace are restored. For collaboration, create a join-enabled share link and open it in a second browser with a separate account. The second account initially views the trip read-only and can explicitly join to edit. An edit should appear in the first browser without reloading. This does not require payment. Use your own disposable test trip; the owner's manual delete removes it for all participants.

If the deployed app is restricted at submission time, do not invent access instructions or expose a real personal password: arrange a dedicated reviewer account through the submission's testing-instructions surface as required by the rules, or resolve access first. Public self-service registration should make that unnecessary.

## Every hackathon-specific field

Labels, options, required flags, and IDs below are copied from the current connector schema. The unusual missing closing parenthesis in option `1` is present in the source response.

| ID | Exact label | Required | Options / what to enter |
|---|---|---|---|
| 28614 | Are you submitting as an individual, a team, or an organization? | Yes | Select `Individual` or `Team` according to the actual authorship. |
| 28615 | Country of residence | Yes | Your actual country of residence; not inferred from language/timezone. |
| 28616 | Organization name (if applicable) | No | Actual organisation, or leave blank. |
| 28617 | Eligibility-confirmation | Yes | Check only after personally confirming the statement below. |
| 28618 | Which of these did you actually use? Check all that apply. | Yes | `Intro video`, `Live build session`, `Cup of Joe office hours`, `Discord`, `None`. Select only actual participation. |
| 28619 | Did the cost of AI (subscription, tokens, credits) affect what you did? | Yes | `No, I never thought about it`; `It made me cut scope or switch to a cheaper model`; `I hit a usage limit or paywall`; `It stopped me from doing something I wanted to do`. Multiple selection allowed; use your actual experience. |
| 28620 | Now, how confident are you that you could plan and build a small, maintainable project with a coding agent? | Yes | `1 (No idea where to start`, `2`, `3`, `4`, `5 (Easily)`. Your own assessment. |
| 28621 | If we could fix one thing before the next person tries this, what should it be? | No | Your feedback on the learning experience, or blank. |
| 28624 | What kind of value did your project create for you? (select all that apply) | Yes | `Saved me time`, `Made or saved me money`, `Created delight / was just fun`, `Let me do something I couldn't do before`. Only actual value experienced. |
| 28625 | Tell us more about the value your project provides for you? | No | Your own explanation; optional. |

Eligibility statement from the form:

> I confirm that I (and all teammates) meet the eligibility requirements in the Official Rules, including being the age of majority where we reside, and that this project was newly created during the Submission Period using the Devpost Learn Skill Pack.

## Images and exact placement

The current upload tools accept PNG/JPEG/GIF up to 5 MB per file and up to 15 gallery images, with captions up to 140 characters. No image dimensions or mandatory gallery count were returned, so the sizes below are production choices, not event requirements. Existing filenames alone do not imply an image was produced.

| Planned file | Size | Placement | Caption |
|---|---|---|---|
| `assets/cover.png` | 1280 × 720 | Project thumbnail | Origin — places, time, and tasks in one shared daily workspace. |
| `assets/planner-desktop.png` | Desktop screenshot | Gallery 1 | Plan a day with map pins, scheduled visits, and linked tasks. |
| `assets/planner-mobile.png` | Mobile screenshot | Gallery 2 | A compact planner that keeps trip controls accessible on a small screen. |
| `assets/calendar.png` | Desktop screenshot | Gallery 3 | Browse overlapping trips in a month-by-month calendar. |
| `assets/settings.png` | Desktop screenshot | Gallery 4 | Personalise the clock, theme, profile, and automatic trip retention. |
| `assets/live-collaboration.png` | Two-account real browser capture | Gallery 5 | Two travellers edit the same itinerary without refreshing. |

Record whether each image shows production, emulator, or labelled sample data. Do not present an emulator screenshot as proof that production Firebase is configured. Do not put email addresses, private share tokens, credentials, or unrelated windows in gallery images.

## Before clicking Submit

- [ ] Public repository opens without login, includes MIT and complete setup instructions and planning documents.
- [ ] Final feature claims match the working deployed/emulated product and verification report.
- [ ] English video shows the actual core loop, runs under three minutes, and plays publicly on YouTube/Vimeo.
- [ ] Final real screenshots/thumbnail exist and are visually checked.
- [ ] Creator supplies personal learning text and all required survey answers.
- [ ] Creator confirms actual eligibility and submits from their Devpost account.

No Devpost project has been created or submitted merely by generating this package.
