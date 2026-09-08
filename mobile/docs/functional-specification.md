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
- Support lightweight persisted preferences, runtime snapshot, and sign out

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

Explicit account scope `ALL` allows selecting a scheduled session from any plant. Camera destination is always that session's concrete plant, never `ALL`. Single-plant accounts remain restricted and missing account assignments remain blocked on mobile. Capture stays idle without a scheduled session, and changing the selected context releases the previous camera before connecting the next. My Device uses the selected session's plant for `ALL` accounts and offers Open Today Sessions when none is selected. Access is based on account scope, not username or a special case for Widji. REST continues to recheck current database permissions and device placement.
