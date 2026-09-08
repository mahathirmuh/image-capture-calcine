# Mobile Functional Specification

## Product

Capture Calcine Mobile is an operator-only mobile application for daily sampling capture workflows in industrial environments.

## Actors

- `Operator`: primary and only mobile role in the current scope

## Primary Screens

1. `Login`
2. `Today Sessions`
3. `Capture`
4. `Recent Captures`
5. `Capture Detail`
6. `My Device`
7. `Settings`

## Functional Requirements

### Login

- Operator can log in with username or email plus password
- App restores a previously saved session when possible
- App refreshes tokens before access expiry
- Logout clears persisted session state

### Today Sessions

- Show today session items for the operator plant context
- Distinguish states such as completed, missing, upcoming, and retake
- Let operator move into capture workflow from a selected session

### Capture

- Show current session context
- Allow direct capture from the `Capture` menu by auto-detecting the active scheduled session window on the device clock
- When the operator opens `Capture` outside the defined two-hour session windows, block capture actions, grey out the primary action buttons, and show `Session not available, please take sample at defined sessions`
- When `Start Session` is rejected because the camera session is already leased by another client, show a blocking popup and warning notice telling the operator that the camera is currently in use on another device
- Show device/session readiness
- Support slot-aware capture and automatic save/finalize
- Show live preview, async job progress, and latest result preview

### Recent Captures

- Show recent capture records relevant to the operator workflow
- Allow navigation to capture detail

### Capture Detail

- Show large preview and key metadata
- Make verification of a capture result easy on a small screen

### My Device

- Show assigned device status, reachability, and recent capture context
- Show read-only diagnostics guidance plus manual status refresh

### Settings

- Show operator identity and assignment context
- Support lightweight persisted preferences, including `Light Mode`, runtime snapshot, and sign out

## Non-Functional Requirements

- mobile-first
- English-only UI text
- operator-focused navigation
- resilient session persistence
- backend contract alignment with `docs/openapi.yaml`

## Current Known Constraint

Some mobile screens are still backed by mock data in the React app and must be wired to live APIs phase by phase.

## Plant-camera assignment (post-M5)

The operator account must permit the selected scheduled session plant (matching plant or explicit `ALL` scope). Entering Capture automatically connects to its assigned camera. Missing or multiple active assignments block connection with an inline explanation; operators do not select another plant or an arbitrary device. A lease alone is not camera readiness: capture stays disabled until preview succeeds. Leaving or changing the context clears the preview and releases the lease, including late session responses. My Device reports the same active plant assignment. UI copy remains English.

### All-plant operator access (2026-09-08)

Explicit account scope `ALL` allows selecting a scheduled session from any plant. Camera destination is always that session's concrete plant, never `ALL`. Single-plant accounts remain restricted and missing account assignments remain blocked on mobile. For ALL accounts, Capture stays idle without a selected scheduled session. Single-plant accounts may use the active automatic session described below. Changing the selected context releases the previous camera before connecting the next. My Device uses the selected session's plant for `ALL` accounts and offers Open Today Sessions when none is selected. Access is based on account scope, not username or a special case for Widji. REST continues to recheck current database permissions and device placement.


## Direct Capture Integration — 2026-09-08

- A single-plant operator can open Capture directly; the device clock selects the active two-hour window at 02, 05, 08, 11, 14, 17, 20 or 23. The 23:00 window includes 00:00–00:59 of the following day.
- The existing camera lifecycle automatically connects for that context and enables capture only after a successful preview. No new device picker or fallback camera is introduced.
- Explicit Today Sessions selection retains the existing recovery workflow and takes precedence over automatic time selection. ALL accounts still require explicit plant/session selection.
- An idle automatic context is released when its window ends. A capture already started is allowed to finish polling and saving against its original slot, plant and device before context expiry takes effect; a new capture cannot start outside the window.
- Stop Session remains stopped within the same window until explicitly started again. A new automatic window receives a new context.
- Session conflict uses an accessible modal with Escape, focus containment and restoration. Light Mode and High Contrast remain persisted device preferences.
