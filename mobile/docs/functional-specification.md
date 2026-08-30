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
- Support autofocus and capture actions
- Show async job progress and latest result preview

### Recent Captures

- Show recent capture records relevant to the operator workflow
- Allow navigation to capture detail

### Capture Detail

- Show large preview and key metadata
- Make verification of a capture result easy on a small screen

### My Device

- Show assigned device status, reachability, and recent capture context
- Show diagnostics entry points when supported

### Settings

- Show operator identity and assignment context
- Support lightweight preferences and sign out

## Non-Functional Requirements

- mobile-first
- English-only UI text
- operator-focused navigation
- resilient session persistence
- backend contract alignment with `docs/openapi.yaml`

## Current Known Constraint

Some mobile screens are still backed by mock data in the React app and must be wired to live APIs phase by phase.
