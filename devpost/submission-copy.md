# Tevel — English project-description draft

Prepared at the creator's request. This is a feature-description draft; verify every present-tense claim against final evidence before pasting. The personal-learning paragraph is intentionally left for the creator and prevents treating this as submission-ready copy.

## Inspiration

A holiday itinerary includes more than a list of destinations: it also needs times, notes, and things to remember. Tevel brings those pieces into one daily workspace so travellers can organise the same trip together.

## What it does

Tevel connects a map, a vertical schedule, and a checklist for each date of a trip. Map pins have a colour, symbol, and note. Connecting pins draws a line or arrow with a colour gradient. Scheduling a visit carries the place's identity and notes into a time block, while independent blocks support activities that do not need a location. Tasks can link to places, scheduled activities, both, or neither.

Travellers can show the panels they need, resize the map/schedule split, and move the floating checklist. Each person's workspace is saved separately. A month calendar helps find trips, and the app opens on today's date.

Share links begin in read-only mode. A join-enabled link lets a signed-in viewer explicitly join as an editor, and participants receive planning edits live. Automatic removal defaults to one year after the trip ends and removes it only from the relevant person's account. The owner's deliberate manual deletion removes the trip for everyone.

## How it is built

The project uses React and TypeScript for the interface, Firebase Authentication for accounts, Firestore for persistent shared planning, and MapLibre with OpenFreeMap for the map. Vercel hosts the website and authenticated server operations. The Devpost Learn Skill Pack provides the scope, product requirements, technical specification, build checklist, and shipping workflow. Codex assists implementation under the creator's approved requirements.

## Challenges and design choices

Shared planning and personal views need different ownership boundaries. Tevel keeps one shared itinerary while storing each participant's membership and workspace separately. That distinction also makes personal retention possible without deleting another traveller's trip. Sparse day storage avoids creating empty records just because someone opened a date. Field-version checks make concurrent-edit conflicts explicit.

## Accomplishments

Tevel is deployed on Vercel with an authenticated Firebase backend. Two-account production API checks verified joining, shared edits, conflict detection, personal removal and global owner deletion. An expired-trip production check verified that automatic removal preserves another participant's access and ownership metadata, then purges data after the final participant leaves. The connected map, visits and checked tasks were exercised through the deployed browser interface. Automated permission, domain and daylight-saving checks complement the real-product verification.

## What I learned

[Creator: write your actual learning experience in your own words. For example, describe a decision you made, a problem you investigated, and something you now understand. The agent cannot establish that you learned something or supply a truthful personal reflection for you.]

## What's next

The next priority is to gather feedback from travellers using the connected daily workflow and improve the experience based on what they observe. No unrequested booking, payment, or AI itinerary feature is promised.

## Pre-existing work disclosure

Third-party frameworks, SDKs, mapping data/services, and the Devpost Learn Skill Pack are used according to their licences. The creator must confirm the final dependency disclosures and that project-specific work was newly created during the event period. See package metadata, MIT licence, map attribution, and planning documents in the repository.
