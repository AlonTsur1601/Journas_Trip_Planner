---
doc: prd
status: approved
---

# Tevel — Product Requirements

Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `The POC Boundary`.

## The Core Journey

1. Sign in with Google or email/password; first-time users create a trip.
2. Open today's date, or select a trip/date from the always-visible header or monthly trip calendar.
3. Add places to the map, connect them, assign visits to times, and create linked tasks.
4. Show any nonempty combination of map, schedule, and tasks; resize the split and move/resize tasks.
5. Change date: the outgoing workspace saves immediately and the incoming workspace restores its own saved layout or the default map-and-schedule view.
6. Share a read-only link, optionally allow viewers to join as authenticated editors, and see their changes live.
7. Return on another day to today's planning. Manage preferences and personally remove old shared trips without deleting other people's plans.

## Screens and Layout

Authentication; daily planner with a persistent trip/date header; trip management/monthly calendar; settings. The map and vertical schedule share horizontal width; the task list is a movable/resizable floating panel. At least one planner panel remains open. Small screens must keep controls reachable and panels within the viewport.

## Look and Feel

English, compact, purple default accent, configurable brand colour, light/dark/system theme. Visible focus, labelled controls, usable contrast, and touch targets. Version appears unobtrusively in settings.

## Features and Behavior

### Trips and Dates

Trips have names and start/end dates; new planning is bounded by one calendar year ahead. Past plans remain accessible until removed. A month grid shows every saved trip, including overlaps. Opening an untouched date does not create a saved day. With no trip today, show a useful empty day and trip-selection/creation actions.

### Places and Connections

Pins have coordinates, place name, colour, symbol, and note shown on selection. Connections are lines or arrows with a source-to-destination colour gradient and update when endpoint colours change. Editing and deleting are explicit actions.

### Schedule and Linked Tasks

Schedule blocks have start/end time, title, description, colour, and symbol. They can be independent or linked to a place. Linked properties initially copy the place; each remains inherited until manually overridden. Deleting a place preserves its scheduled block as an independent block. Tasks link to a place, a block, both, or neither; completion checks a checkbox and strikes through text. Deleting a link target detaches the task without losing it.

### Personal Workspace and Persistence

The layout belongs to the user/trip/date, including open panels, split, floating task bounds, map centre/zoom, and schedule scroll. Save pending changes and the layout every five minutes and before date/trip changes. Show pending/saved/failed status; preserve local drafts across a failed save. Fresh daily entry selects today. A read-only viewer cannot write trip content.

### Sharing and Collaboration

The owner creates revocable view-only or join-enabled links. Link opening starts read-only. Joining requires sign-in and explicit consent. Editors can change the shared planning content; owner management privileges are separate. Live updates do not require page reload. Conflicting edits to the same field require a visible choice, rather than silent loss. A participant's layout changes never move another participant's panels.

### Retention and Deletion

Automatic removal is enabled by default, one year after a trip ends; users can disable it or choose one month, three months, or one year. Automatic removal affects only that account, including the owner's account, and does not transfer ownership. A nonowner's manual removal is personal. An owner's manual deletion is global, requires an explicit confirmation naming its effect on everyone, revokes links, and reaches open collaborator sessions. Personal removal revokes active participation; joining again requires a valid join link. Data is cleaned up when no accounts retain the trip.

### Limits and Settings

Each account can save 100 trips, including shared trips; warn at 80 and prevent creation/join at 100. Personal removal frees that user's slot. Settings include profile name and compressed image, clock mode (device, destination, UTC), explicit clock-zone label, manual destination-zone correction, theme/accent, retention, and version. Destination zone uses the first scheduled place, else the first pin, else a labelled local fallback. Show a text-free current-time line only when viewing today in the active zone; handle daylight-saving ambiguity.

## States and Boundaries

Empty days offer planning actions; invalid inputs receive actionable errors. Missing configuration shows setup guidance rather than pretending sign-in works. Offline/failed writes remain visibly pending. Removed access closes the live shared workspace. A removed trip is never recreated by a stale save. Security rules and server checks must reject unauthorised reads/writes independent of the interface.

## Product Decisions

All planner capabilities remain in scope. The accepted revision enables one-year automatic removal and distinguishes personal removal from the owner's deliberate global deletion. No personal learning outcomes or eligibility claims have been supplied.
